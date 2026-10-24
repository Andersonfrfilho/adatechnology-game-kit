import { AREA_CAP_GAME, createAreaCap } from './area-cap'
import { PROFILES } from './budget'
import { EXPLOSIONS, EXPLOSION_ALIASES } from './catalog'
import { hexToLinearRgb } from './color'
import { DEFAULT_GRAVITY, DEFAULT_WIND } from './constants'
import type { RandomMode, VfxCore } from './core'
import { addFire, createFirePool, updateFires } from './emitters/fire'
import type { Fire } from './emitters/fire'
import { composeExplosion } from './explosion'
import type { GroundField } from './ground'
import { createLightPool, resetLightPool, updateLights } from './lights'
import type { LightPool } from './lights'
import { LOD_GAME } from './lod'
import { createMarkStore } from './marks'
import type { MarkEvent, MarkStore } from './marks'
import type { OrderedPool } from './pool'
import { updateChunks } from './pools/chunk-motion'
import { createChunkPool } from './pools/chunks'
import type { Chunk } from './pools/chunks'
import { createGlowPool, updateGlows } from './pools/glows'
import type { Glow } from './pools/glows'
import { createPuffPool, updatePuffs } from './pools/puffs'
import type { Puff, Ring } from './pools/puffs'
import { createRingPool, updateRings } from './pools/rings'
import { createShockPool, updateShocks } from './pools/shocks'
import type { Shock } from './pools/shocks'
import { createSparkPool, updateSparks } from './pools/sparks'
import type { Spark } from './pools/sparks'
import { lehmer, streamFor } from './random'
import type { MutableVec3, RandomStream } from './random'
import { createSchedule } from './schedule'
import { createScreenState, resetScreenState, updateScreen } from './screen'
import type { VfxTrace } from './trace'
import type { AreaCap, ExplosionDef, Follow, LodBands, ScreenState, VfxLayer, VfxProfile, VfxProfileName, VfxSideRequest, VfxStats, Vec3Like } from './types'
import { VFX_LAYERS } from './types'

export interface VfxOptions {
  readonly seed?: number
  /** `per_event` (default): every explosion draws from a stream of its own seed, so a LAN client repeats it from a few bytes. `shared`: one stream for everything, like the Lab page (the goldens). */
  readonly randomMode?: RandomMode
  readonly profile?: VfxProfileName | VfxProfile
  readonly lod?: LodBands
  /** The cap on explosions in one area; `false` turns it off. Default the game's: 6 in 4 s within 40 m, the extra ones at 0.3. */
  readonly areaCap?: AreaCap | false
  /** Height of the ground for what bounces. Default: the `ground` field, else flat at 0. */
  readonly groundAt?: (x: number, z: number) => number
  /** A deformable ground the craters dig into (see `createGroundField`). */
  readonly ground?: GroundField
  readonly wind?: Vec3Like
  readonly gravity?: number
  /** The catalogue by id (default the Lab's 16 and `generic`); build another with `patchExplosions(EXPLOSIONS, ...)`. */
  readonly explosions?: Readonly<Record<string, ExplosionDef>>
  readonly aliases?: Readonly<Record<string, string>>
  readonly reducedMotion?: boolean
  /** Hears everything that spawns, in order (the goldens use it). */
  readonly trace?: VfxTrace
  readonly onRequest?: (request: VfxSideRequest) => void
}

export interface ExplosionOptions {
  readonly direction?: Vec3Like
  /** Repeats the same visual: used in `per_event` mode. */
  readonly seed?: number
  /** Multiplies the size of the effect (radius, marks, mushroom, fires). */
  readonly scale?: number
  /** Seconds from now until it goes off (a chain). */
  readonly delay?: number
}

export interface FireOptions {
  readonly point: Vec3Like
  readonly radius: number
  readonly life: number
  /** Flames per second per square-ish metre (the Lab's `rate`, default 22) and smoke puffs (default .6). */
  readonly rate?: number
  readonly smoke?: number
  /** Grows from `startRadius` to `radius` over `grow` seconds. */
  readonly startRadius?: number
  readonly grow?: number
  /** `0xRRGGBB` of the smoke (default soot black). */
  readonly smokeColor?: number
  /** Moves with a thing (a burning part): the fire sits at its position plus `offset`. */
  readonly follow?: Follow
  readonly offset?: Vec3Like
  readonly seed?: number
}

/** The pools as the renderer reads them: live records, oldest first. */
export interface VfxPoolsView {
  readonly puffs: OrderedPool<Puff>
  readonly sparks: OrderedPool<Spark>
  readonly glows: OrderedPool<Glow>
  readonly chunks: OrderedPool<Chunk>
  readonly shocks: OrderedPool<Shock>
  readonly rings: OrderedPool<Ring>
  readonly lights: LightPool
  readonly marks: MarkStore
  readonly ground: GroundField | undefined
}

export interface VfxWorld {
  /** Sets off an explosion of the catalogue by id (an explosive id or an alias); `null` when the id is unknown. */
  explosion(id: string, point: Vec3Like, options?: ExplosionOptions): number | null
  /** A lingering area fire (a molotov's pool, a burning part). Returns a handle for `stop`. */
  fire(options: FireOptions): number
  /** Pushes the smoke and dust within `radius` of `point` outwards, as fast as `speed` at the centre. */
  push(point: Vec3Like, radius: number, speed: number): void
  stop(handle: number): void
  setLayer(layer: VfxLayer, on: boolean): void
  layer(layer: VfxLayer): boolean
  setCamera(position: Vec3Like): void
  /** Forces the scale of every explosion from now on (`null`: back to the distance bands and the cap). */
  forceLod(scale: number | null): void
  update(dt: number): void
  screen(): Readonly<ScreenState>
  stats(): VfxStats
  pools(): VfxPoolsView
  /** The live lingering fires, oldest first. */
  fires(): readonly Fire[]
  /** Hears every mark the moment it is made, and when they are cleared. Returns the function that stops listening. */
  onMarks(listener: (event: MarkEvent) => void): () => void
  /** Seconds the world has run since it was created or cleared. */
  time(): number
  /** The state of the shared stream (`randomMode: 'shared'`): what a golden compares after a run. */
  randomState(): number
  /** Takes everything away (pools, marks, ground, timers, lights, screen) and restarts the clock. */
  clear(): void
  /** The catalogue ids `explosion` accepts, aliases included. */
  catalog(): readonly string[]
}

const FIRE_CAPACITY = 64
const RING_CAPACITY = 16
const SHOCK_CAPACITY = 16
const AUTO_SEED = 0x2545f491

function resolveProfile(profile: VfxOptions['profile']): VfxProfile {
  if (profile === undefined) return PROFILES.medium
  return typeof profile === 'string' ? PROFILES[profile] : profile
}

function scaleDefinition(def: ExplosionDef, factor: number): ExplosionDef {
  if (factor === 1) return def
  const mushroom = def.mushroom && { ...def.mushroom, height: def.mushroom.height * factor, radius: def.mushroom.radius * factor }
  const residual = def.residualFires?.map((fire) => ({ ...fire, radius: fire.radius * factor, dx: (fire.dx ?? 0) * factor, dz: (fire.dz ?? 0) * factor }))
  return {
    ...def,
    lethal: def.lethal * factor,
    injury: def.injury * factor,
    visualRadius: def.visualRadius * factor,
    mark: { scorch: def.mark.scorch && def.mark.scorch * factor, crater: def.mark.crater && def.mark.crater * factor, dent: def.mark.dent && def.mark.dent * factor },
    ...(mushroom ? { mushroom } : {}),
    ...(residual ? { residualFires: residual } : {}),
  }
}

export function createVfx(options: VfxOptions = {}): VfxWorld {
  const profile = resolveProfile(options.profile)
  const sharedRandom = lehmer(options.seed ?? 1)
  const explosions = options.explosions ?? EXPLOSIONS
  const aliases = options.aliases ?? EXPLOSION_ALIASES
  const randomMode = options.randomMode ?? 'per_event'
  const wind: MutableVec3 = { x: DEFAULT_WIND.x, y: DEFAULT_WIND.y, z: DEFAULT_WIND.z }
  if (options.wind) [wind.x, wind.y, wind.z] = options.wind
  const camera: MutableVec3 = { x: 0, y: 1.6, z: 0 }
  const layers = Object.fromEntries(VFX_LAYERS.map((layer) => [layer, true])) as Record<VfxLayer, boolean>
  const ground = options.ground
  const groundAt = options.groundAt ?? (ground ? (x: number, z: number) => ground.heightAt(x, z) : () => 0)
  const handles = { next: 0, events: 0 }
  const core: VfxCore = {
    profile,
    puffs: createPuffPool(profile.puffs),
    sparks: createSparkPool(profile.sparks),
    glows: createGlowPool(profile.glows),
    chunks: createChunkPool(profile.chunks, sharedRandom),
    fires: createFirePool(FIRE_CAPACITY, sharedRandom),
    shocks: createShockPool(SHOCK_CAPACITY),
    rings: createRingPool(RING_CAPACITY),
    lights: createLightPool(),
    marks: createMarkStore(),
    screen: createScreenState(),
    layers,
    schedule: createSchedule(),
    wind,
    camera,
    ground,
    bands: options.lod ?? LOD_GAME,
    areaCap: options.areaCap === false ? undefined : createAreaCap(options.areaCap ?? AREA_CAP_GAME),
    randomMode,
    sharedRandom,
    reducedMotion: options.reducedMotion ?? false,
    gravity: options.gravity ?? DEFAULT_GRAVITY,
    trace: options.trace,
    spawned: { puffs: 0, sparks: 0, chunks: 0, lights: 0 },
    clock: { time: 0, lastBlast: -1, lod: 1, forcedLod: null },
    groundAt,
    emit: (request) => options.onRequest?.(request),
  }

  function definitionOf(id: string): ExplosionDef | undefined {
    return explosions[id] ?? explosions[aliases[id] ?? '']
  }

  function streamOf(seed: number | undefined): RandomStream {
    if (randomMode === 'shared') return sharedRandom
    handles.events++
    return streamFor(seed ?? Math.imul(handles.events, AUTO_SEED) + (options.seed ?? 0))
  }

  function detonate(def: ExplosionDef, point: Vec3Like, call: { direction: MutableVec3 | undefined; random: RandomStream; handle: number }): void {
    composeExplosion(core, def, { x: point[0], y: point[1], z: point[2], direction: call.direction, random: call.random, handle: call.handle })
  }

  return {
    explosion(id, point, explosionOptions = {}) {
      const base = definitionOf(id)
      if (!base) return null
      const def = scaleDefinition(base, explosionOptions.scale ?? 1)
      const handle = ++handles.next
      const direction = explosionOptions.direction && { x: explosionOptions.direction[0], y: explosionOptions.direction[1], z: explosionOptions.direction[2] }
      const random = streamOf(explosionOptions.seed)
      if (explosionOptions.delay) core.schedule.at(core.clock.time + explosionOptions.delay, () => detonate(def, point, { direction, random, handle }))
      else detonate(def, point, { direction, random, handle })
      return handle
    },
    fire(fireOptions) {
      const handle = ++handles.next
      const { point, offset, seed, radius, smokeColor, ...rest } = fireOptions
      addFire(core, streamOf(seed), {
        ...rest, r: radius, x: point[0], y: point[1], z: point[2], fx: offset?.[0] ?? 0, fy: offset?.[1] ?? 0, fz: offset?.[2] ?? 0,
        ...(smokeColor !== undefined ? { color: hexToLinearRgb(smokeColor) } : {}),
      }, handle)
      return handle
    },
    push(point, radius, speed) {
      for (const puff of core.puffs.items) {
        const dx = puff.x - point[0]
        const dy = puff.y - point[1]
        const dz = puff.z - point[2]
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (distance >= radius) continue
        const strength = (speed * (1 - distance / radius)) / (distance + 0.001)
        puff.vx += dx * strength
        puff.vy += dy * strength
        puff.vz += dz * strength
      }
    },
    stop(handle) {
      const fires = core.fires
      for (let index = fires.items.length - 1; index >= 0; index--) if (fires.items[index]!.handle === handle) fires.removeAt(index)
    },
    setLayer(layer, on) {
      layers[layer] = on
    },
    layer: (layer) => layers[layer],
    setCamera(position) {
      camera.x = position[0]
      camera.y = position[1]
      camera.z = position[2]
    },
    forceLod(scale) {
      core.clock.forcedLod = scale
    },
    update(dt) {
      core.clock.time += dt
      core.schedule.update(core.clock.time)
      updateRings(core.rings, dt)
      updatePuffs(core.puffs, dt, wind)
      updateSparks(core.sparks, { dt, groundAt })
      updateGlows(core.glows, dt)
      updateShocks(core.shocks, core.puffs.items, dt)
      updateChunks(core, dt)
      updateFires(core, dt)
      updateLights(core.lights, { dt, flashLayer: layers.flash ? 1 : 0, clock: core.clock.time, fires: core.fires.items })
      updateScreen(core.screen, dt)
    },
    screen: () => core.screen,
    stats() {
      const lights = core.lights
      return {
        puffs: core.puffs.count,
        sparks: core.sparks.count,
        glows: core.glows.count,
        chunks: core.chunks.count,
        fires: core.fires.count,
        shocks: core.shocks.count,
        rings: core.rings.count,
        blastLights: lights.blast.filter((light) => light.intensity > 0.05).length,
        fireLights: lights.fire.filter((light) => light.intensity > 0.05).length,
        lastBlast: { ...core.spawned },
        lod: core.clock.lod,
        blastTime: core.clock.lastBlast < 0 ? -1 : core.clock.time - core.clock.lastBlast,
      }
    },
    pools: () => ({
      puffs: core.puffs, sparks: core.sparks, glows: core.glows, chunks: core.chunks, shocks: core.shocks, rings: core.rings, lights: core.lights, marks: core.marks, ground,
    }),
    fires: () => core.fires.items,
    onMarks: (listener) => core.marks.subscribe(listener),
    time: () => core.clock.time,
    randomState: () => sharedRandom.state,
    clear() {
      for (const pool of [core.puffs, core.sparks, core.glows, core.chunks, core.fires, core.shocks, core.rings] as OrderedPool<object>[]) pool.clear()
      core.marks.clear()
      core.schedule.clear()
      core.areaCap?.clear()
      ground?.reset()
      resetLightPool(core.lights)
      resetScreenState(core.screen)
      core.clock.time = 0
      core.clock.lastBlast = -1
      core.clock.lod = 1
      core.spawned.puffs = core.spawned.sparks = core.spawned.chunks = core.spawned.lights = 0
    },
    catalog: () => [...new Set([...Object.keys(explosions), ...Object.keys(aliases)])],
  }
}
