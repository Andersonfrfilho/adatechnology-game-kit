import { PROFILES } from '../budget'
import type { RandomStream } from '../random'
import { createScreenState, resetScreenState, updateScreen } from '../screen'
import type { ScreenState, VfxProfile } from '../types'
import { DebrisPool } from './debris'
import { DecalPool } from './decals'
import { SpritePool } from './sprites'
import { StreakPool } from './streaks'
import type { DebrisSpawn, DecalOptions, SpriteSpawn, SpriteSystem, Vec3Tuple, WorkshopContext, WorkshopTrace } from './types'
import { FlashLightPool, WaveRingPool } from './waves'

const QUALITY_MULTIPLIERS = [1, 0.5, 0.2] as const
const FIRE_FLICKER_SWAY = 0.25
const FIRE_FLICKER_JITTER = 0.08
const LENS_FADE = 0.16

/** Water or blood on the camera lens: a soft blob that fades and runs down (W351-352). */
export interface LensBlob {
  x: number
  y: number
  radius: number
  color: string
  alpha: number
  fall: number
}

/** The page's `P0` (W347, W1277): what an effect asks of the post-process for this frame only; it is emptied before every frame's tick. */
export interface PostProcess {
  desat?: number
  tunnel?: number
  blur?: number
  cold?: number
  chroma?: number
  hue?: number
  red?: number
  tintAlpha?: number
  tintColor?: string
}

/**
 * Where an effect is put when it is played at a point instead of on the Workshop's set: what the recipe wrote at `anchor` lands at `origin`, turned
 * about the vertical axis by `yaw`. Positions are moved and turned, directions and velocities only turned.
 */
export interface Placement {
  readonly origin: Vec3Tuple
  readonly anchor: Vec3Tuple
  readonly yaw: number
}

export interface WorkshopOptions {
  readonly random: RandomStream
  readonly profile?: VfxProfile
  readonly groundAt?: (x: number, z: number) => number
  readonly trace?: WorkshopTrace
}

/** The default ground of the Workshop scene: a raised kerb 12 cm high between z -4.5 and -2.9 (W29). */
export function workshopGround(x: number, z: number): number {
  return z < -2.9 && z > -4.5 && Math.abs(x) < 13 ? 0.12 : 0
}

/**
 * Everything the Workshop's recipes spawn into and the loop that ages it (W168-371, W1285-1287): sprites, streaks, debris, decals, rings, lights, the
 * screen state and the lens blobs, plus the quality level that thins what a recipe asks for and the accumulators that turn a rate into spawns.
 */
export class WorkshopEngine {
  readonly context: WorkshopContext
  readonly add: SpritePool
  readonly normal: SpritePool
  readonly streaks: StreakPool
  readonly debris: DebrisPool
  readonly decals: DecalPool
  readonly rings = new WaveRingPool()
  readonly lights: FlashLightPool
  readonly screen: ScreenState = createScreenState()
  readonly lens: LensBlob[] = []
  post: PostProcess = {}
  /** Set by whoever runs an effect for the time it runs; `undefined` leaves every number as the recipe wrote it. */
  placement: Placement | undefined
  private readonly accumulators = new Map<string, number>()

  constructor(options: WorkshopOptions) {
    const profile = options.profile ?? PROFILES.high
    this.context = { random: options.random, groundAt: options.groundAt ?? workshopGround, quality: { level: 0, mult: 1 }, trace: options.trace }
    this.add = new SpritePool(profile.sprites.add, this.context)
    this.normal = new SpritePool(profile.sprites.normal, this.context)
    this.streaks = new StreakPool(profile.streaks, this.context)
    this.debris = new DebrisPool(this.context)
    this.decals = new DecalPool(this.context)
    this.lights = new FlashLightPool(this.context)
  }

  get random(): RandomStream {
    return this.context.random
  }

  get quality(): number {
    return this.context.quality.level
  }

  setQuality(level: number): void {
    this.context.quality.level = level
    this.context.quality.mult = QUALITY_MULTIPLIERS[level] ?? 1
  }

  /** `n` (W340): a count thinned by the quality level, never to zero when something was asked. */
  scaled(count: number): number {
    return Math.max(count > 0 ? 1 : 0, Math.round(count * this.context.quality.mult))
  }

  /** A point of the recipe's space in the world (`undefined` placement: as is). */
  place(point: Vec3Tuple): Vec3Tuple {
    const placement = this.placement
    if (!placement) return point
    const { anchor, origin, yaw } = placement
    const x = point[0] - anchor[0]
    const z = point[2] - anchor[2]
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)
    return [origin[0] + cos * x + sin * z, origin[1] + point[1] - anchor[1], origin[2] - sin * x + cos * z]
  }

  /** A direction or velocity of the recipe's space in the world. */
  turn(vector: Vec3Tuple): Vec3Tuple {
    const placement = this.placement
    if (!placement) return vector
    const cos = Math.cos(placement.yaw)
    const sin = Math.sin(placement.yaw)
    return [cos * vector[0] + sin * vector[2], vector[1], -sin * vector[0] + cos * vector[2]]
  }

  private placed<T extends { readonly p: Vec3Tuple; readonly dir?: Vec3Tuple; readonly v?: Vec3Tuple }>(options: T): T {
    if (!this.placement) return options
    return { ...options, p: this.place(options.p), ...(options.dir ? { dir: this.turn(options.dir) } : {}), ...(options.v ? { v: this.turn(options.v) } : {}) }
  }

  spawn(system: SpriteSystem, recipe: SpriteSpawn): void {
    const options = this.placed(recipe)
    this.context.trace?.(system, [options])
    if (system === 'add') this.add.spawn(options)
    else if (system === 'normal') this.normal.spawn(options)
    else this.streaks.spawn(options)
  }

  burst(system: SpriteSystem, count: number, options: SpriteSpawn): void {
    const total = this.scaled(count)
    for (let spawned = 0; spawned < total; spawned++) this.spawn(system, options)
  }

  /** `emit` (W343-345): `rate` per second, thinned by the quality, carried over between frames under `key`. `options` is read again for every particle. */
  emit(key: string, system: SpriteSystem, rate: number, dt: number, options: () => SpriteSpawn): void {
    let carried = (this.accumulators.get(key) ?? 0) + rate * this.context.quality.mult * dt
    while (carried >= 1) {
      carried -= 1
      this.spawn(system, options())
    }
    this.accumulators.set(key, carried)
  }

  debrisPiece(recipe: DebrisSpawn): void {
    const options = this.placed(recipe)
    this.context.trace?.('debris', [options])
    this.debris.spawn(options)
  }

  decal(recipe: readonly [number, number, number, number, number, DecalOptions?]): void {
    let args = recipe
    if (this.placement) {
      const [x, y, z] = this.place([recipe[0], recipe[1], recipe[2]])
      const options = recipe[5]
      args = [x, y, z, recipe[3], recipe[4], options?.n ? { ...options, n: this.turn(options.n) } : options]
    }
    this.context.trace?.('decal', args)
    this.decals.add(args[0], args[1], args[2], args[3], args[4], args[5])
  }

  ring(recipe: readonly [Vec3Tuple, number, number, number, number, Vec3Tuple?, number?]): void {
    const args = this.placement ? ([this.place(recipe[0]), recipe[1], recipe[2], recipe[3], recipe[4], recipe[5] && this.turn(recipe[5]), recipe[6]] as const) : recipe
    this.context.trace?.('ring', args)
    this.rings.add(args[0], args[1], args[2], args[3], args[4], args[5], args[6])
  }

  flash(recipe: readonly [Vec3Tuple, number, number, number, number?, (boolean | 'boom')?]): void {
    const args = this.placement ? ([this.place(recipe[0]), recipe[1], recipe[2], recipe[3], recipe[4], recipe[5]] as const) : recipe
    this.context.trace?.('flash', args)
    this.lights.flash(args[0], args[1], args[2], args[3], args[4], args[5])
  }

  /** `fireLight` (W400): sways with the clock and flickers with one draw. */
  fireLight(slot: 0 | 1, recipe: Vec3Tuple, intensity: number, time: number): void {
    const light = this.lights.fire[slot]!
    const point = this.place(recipe)
    light.x = point[0]
    light.y = point[1]
    light.z = point[2]
    light.intensity = intensity * (0.75 + FIRE_FLICKER_SWAY * Math.sin(time * 23) * Math.sin(time * 7.3) + this.random.between(-FIRE_FLICKER_JITTER, FIRE_FLICKER_JITTER))
  }

  lensBlob(x: number, y: number, radius: number, color: string, alpha: number): void {
    this.lens.push({ x, y, radius, color, alpha, fall: this.random.between(2, 8) })
  }

  /** The order of the page's loop (W1285-1287): the sprites, streaks, debris, decals, rings and lights, then the screen and its lens. */
  update(dt: number): void {
    const leaveDecal = (x: number, y: number, z: number, size: number, color: number, options: DecalOptions): void => {
      this.decal([x, y, z, size, color, options])
    }
    this.add.update(dt, leaveDecal)
    this.normal.update(dt, leaveDecal)
    this.streaks.update(dt)
    this.debris.update(dt)
    this.decals.update(dt)
    this.rings.update(dt)
    this.lights.update(dt)
    updateScreen(this.screen, dt)
    for (let index = this.lens.length - 1; index >= 0; index--) {
      const blob = this.lens[index]!
      blob.alpha -= dt * LENS_FADE
      blob.y += blob.fall * dt
      if (blob.alpha <= 0) this.lens.splice(index, 1)
    }
  }

  clear(): void {
    this.add.clear()
    this.normal.clear()
    this.streaks.clear()
    this.debris.clear()
    this.decals.clear()
    this.rings.clear()
    this.lights.clear()
    this.accumulators.clear()
    resetScreenState(this.screen)
    this.lens.length = 0
    this.post = {}
  }
}
