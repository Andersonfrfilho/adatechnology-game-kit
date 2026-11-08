import { LOD_GAME, lodScale } from '../lod'
import { lehmer } from '../random'
import type { RandomStream } from '../random'
import type { LodBands } from '../types'
import { stepWaterPools } from './motion'
import type { MotionContext } from './motion'
import { planWaterBlast, planWaterShot } from './plan'
import { WATER_LIMITS, createWaterPools } from './records'
import type { WaterBubble, WaterColumn, WaterDrop, WaterFoam, WaterMist, WaterRing, WaterWave } from './records'
import { addRing, spawnBlast, spawnShot } from './spawn'
import type { SpawnContext } from './spawn'
import type { WaterBlastParams, WaterBlastPlan, WaterEffectsLimits, WaterShotParams, WaterShotPlan, WaterShotProfile, WaterVec3, WaterWaveSample } from './types'

/** Longest step one update takes: a hitch of the frame does not throw the drops through the surface. */
const STEP_LIMIT = 0.05
/** Directions the shore is looked for in. */
const SHORE_DIRECTIONS = 8
/** Halvings of the last step that find the shore to within a few centimetres. */
const SHORE_HALVINGS = 5
/** Two levels further apart than this are not the same water. */
const SAME_WATER = 0.2
/** Share of the ring pool small rings of falling drops may fill: the rings of the shots and blasts keep the rest. */
const DROP_RING_SHARE = 0.75
/** Metres per second a wave crest pushes per metre of its height, per metre per second of its speed. */
const WAVE_PUSH = 2

export interface WaterEffectsOptions {
  readonly seed?: number
  /** Upper bound of each pool (the default `WATER_LIMITS`). */
  readonly limits?: Partial<WaterEffectsLimits>
  /** The water surface at (x, z), or null where there is none: rings, foam and waves stop at the shore, and only drops falling on water ring. */
  readonly levelAt?: (x: number, z: number) => number | null
  /** Distance bands for fewer drops and bubbles far from the camera (default `LOD_GAME`). */
  readonly lod?: LodBands
  /** The shot profiles by class (default `WATER_SHOT_PROFILES`; `patchWaterShotProfiles` to change them). */
  readonly profiles?: Readonly<Record<string, WaterShotProfile>>
}

export interface WaterEffectsStats {
  readonly drops: number
  readonly rings: number
  readonly foam: number
  readonly columns: number
  readonly bubbles: number
  readonly mist: number
  readonly waves: number
}

/** Splashes of rounds and blasts on water, renderer-free: plain pools a renderer draws (`createWaterEffectsLayer` of game-vfx-three). */
export interface WaterEffects {
  /** A round meets the water at `point`. */
  shot(params: WaterShotParams): WaterShotPlan
  /** A charge goes off in or over the water. */
  blast(params: WaterBlastParams): WaterBlastPlan
  update(dt: number): void
  setCamera(position: WaterVec3): void
  /** The waves going through (x, z): how high they lift the surface and how hard they push what floats there. */
  waveAt(x: number, z: number): WaterWaveSample
  readonly drops: readonly WaterDrop[]
  readonly rings: readonly WaterRing[]
  readonly foam: readonly WaterFoam[]
  readonly columns: readonly WaterColumn[]
  readonly bubbles: readonly WaterBubble[]
  readonly mist: readonly WaterMist[]
  readonly waves: readonly WaterWave[]
  readonly limits: WaterEffectsLimits
  stats(): WaterEffectsStats
  clear(): void
}

export function createWaterEffects(options: WaterEffectsOptions = {}): WaterEffects {
  const limits: WaterEffectsLimits = { ...WATER_LIMITS, ...options.limits }
  const pools = createWaterPools(limits)
  const random: RandomStream = lehmer(options.seed ?? 1)
  const lod = options.lod ?? LOD_GAME
  const camera: [number, number, number] = [0, 0, 0]
  let hasCamera = false

  const reach = (x: number, z: number, limit: number): number => {
    const levelAt = options.levelAt
    if (!levelAt) return limit
    const here = levelAt(x, z)
    if (here === null) return 0
    const step = Math.max(0.05, limit / 10)
    const isWater = (cos: number, sin: number, distance: number): boolean => {
      const level = levelAt(x + cos * distance, z + sin * distance)
      return level !== null && Math.abs(level - here) <= SAME_WATER
    }
    let nearest = limit
    for (let index = 0; index < SHORE_DIRECTIONS; index++) {
      const angle = (index / SHORE_DIRECTIONS) * Math.PI * 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      for (let distance = step; distance < nearest; distance += step) {
        if (isWater(cos, sin, distance)) continue
        // the shore is between the last step on water and this one: halve the gap a few times
        let wet = distance - step
        let dry = distance
        for (let halving = 0; halving < SHORE_HALVINGS; halving++) {
          const middle = (wet + dry) / 2
          if (isWater(cos, sin, middle)) wet = middle
          else dry = middle
        }
        nearest = Math.min(nearest, wet)
        break
      }
    }
    return nearest
  }
  const detailAt = (point: WaterVec3, radius: number): number => (hasCamera ? lodScale(lod, Math.hypot(point[0] - camera[0], point[1] - camera[1], point[2] - camera[2]), radius) : 1)
  const contextAt = (point: WaterVec3, radius: number): SpawnContext => ({ pools, random, detail: detailAt(point, radius), reach })

  const motion: MotionContext = {
    dt: 0,
    landed: (drop) => {
      if (pools.rings.count >= limits.rings * DROP_RING_SHARE) return
      const level = options.levelAt ? options.levelAt(drop.x, drop.z) : drop.level
      if (level === null || Math.abs(level - drop.level) > SAME_WATER) return
      addRing({ pools, random, detail: 1, reach }, { x: drop.x, y: level, z: drop.z, kind: 0, start: drop.size, max: 0.04 + drop.size * 6, life: 0.5, delay: 0, strength: 0.35 })
    },
  }

  const shot = (params: WaterShotParams): WaterShotPlan => {
    const plan = planWaterShot(params, random, options.profiles)
    spawnShot(contextAt(params.point, plan.ringRadius), params.point, plan)
    return plan
  }

  /** The fragments of a charge that bursts at or over the water pepper it all round. */
  const pepper = (params: WaterBlastParams, plan: WaterBlastPlan): void => {
    const spread = 1.5 + 3 * Math.cbrt(plan.tnt)
    for (let index = 0; index < plan.fragments; index++) {
      const angle = random.next() * Math.PI * 2
      const distance = random.between(0.6, spread)
      const x = params.point[0] + Math.cos(angle) * distance
      const z = params.point[2] + Math.sin(angle) * distance
      const level = options.levelAt ? options.levelAt(x, z) : params.level
      if (level === null || Math.abs(level - params.level) > SAME_WATER) continue
      const fall = random.between(0.4, 1)
      const length = Math.hypot(Math.cos(angle), fall, Math.sin(angle))
      const point: WaterVec3 = [x, level, z]
      const fragment = planWaterShot({ point, direction: [Math.cos(angle) / length, -fall / length, Math.sin(angle) / length], profile: 'fragment', depth: params.depth }, random, options.profiles)
      spawnShot(contextAt(point, fragment.ringRadius), point, fragment)
    }
  }

  const blast = (params: WaterBlastParams): WaterBlastPlan => {
    const plan = planWaterBlast(params)
    spawnBlast(contextAt(params.point, plan.shockRadius), params.point, params.level, plan)
    pepper(params, plan)
    return plan
  }

  const waveAt = (x: number, z: number): WaterWaveSample => {
    let height = 0
    let pushX = 0
    let pushZ = 0
    for (const wave of pools.waves.items) {
      if (wave.delay > 0) continue
      const dx = x - wave.x
      const dz = z - wave.z
      const r = Math.hypot(dx, dz)
      if (r > wave.reach) continue
      const off = (r - wave.speed * wave.age) / wave.width
      if (Math.abs(off) > 3) continue
      const crest = (wave.amplitude * Math.exp(-off * off) * (1 - wave.age / wave.life)) / Math.sqrt(Math.max(1, r))
      height += crest
      if (r > 1e-3) {
        const push = crest * wave.speed * WAVE_PUSH
        pushX += (dx / r) * push
        pushZ += (dz / r) * push
      }
    }
    return { height, push: [pushX, pushZ] }
  }

  return {
    shot,
    blast,
    update(dt) {
      let left = Math.max(0, dt)
      while (left > 1e-6) {
        motion.dt = Math.min(STEP_LIMIT, left)
        stepWaterPools(pools, motion)
        left -= motion.dt
      }
    },
    setCamera(position) {
      camera[0] = position[0]
      camera[1] = position[1]
      camera[2] = position[2]
      hasCamera = true
    },
    waveAt,
    drops: pools.drops.items,
    rings: pools.rings.items,
    foam: pools.foam.items,
    columns: pools.columns.items,
    bubbles: pools.bubbles.items,
    mist: pools.mist.items,
    waves: pools.waves.items,
    limits,
    stats: () => ({ drops: pools.drops.count, rings: pools.rings.count, foam: pools.foam.count, columns: pools.columns.count, bubbles: pools.bubbles.count, mist: pools.mist.count, waves: pools.waves.count }),
    clear() {
      for (const pool of Object.values(pools)) pool.clear()
    },
  }
}
