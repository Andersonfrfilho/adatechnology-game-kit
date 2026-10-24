import type { WorkshopEngine } from './engine'
import type { Vec3Tuple } from './types'

/** The most drops the field keeps (`RAINMAX`, W312). */
export const RAIN_CAPACITY = 4000
/** Metres per second a drop falls (W322: `15 * dt`). */
const FALL_SPEED = 15
/** How far the wind slants a drop per metre it falls (W322: `.07`), and the slant of the streak itself (W321: `.04`). */
const WIND_PER_FALL = 0.07
const STREAK_SLANT = 0.04
const STREAK_LENGTH = 0.6
/** Where a drop starts, in a box of the field's own: x -15..15, z -6..16, height 0..16 at first and 14..17 when it comes back (W321, W328). */
const BOX_X: readonly [number, number] = [-15, 15]
const BOX_Z: readonly [number, number] = [-6, 16]
const START_HEIGHT: readonly [number, number] = [0, 16]
const REENTRY_HEIGHT: readonly [number, number] = [14, 17]
/** A drop that lands makes a splash 35% of the time, within `12 / (1 + quality)` metres of the camera (W324). */
const SPLASH_CHANCE = 0.35
const SPLASH_RANGE = 12
const SPRITE_CHANCE = 0.5
const UP: Vec3Tuple = [0, 1, 0]

/** An ellipse of the ground a puddle covers: centre x, centre z and the two half-axes (W332 `PUD`). */
export type Puddle = readonly [x: number, z: number, radiusX: number, radiusZ: number]

/** The Workshop's four puddles (W332): the rings of the rain show only in them. */
export const WORKSHOP_PUDDLES: readonly Puddle[] = [
  [-1.5, 2.2, 1.6, 0.9],
  [3.0, 3.6, 1.1, 0.7],
  [-6, 3.2, 1.3, 0.8],
  [1.4, -2.2, 0.9, 0.5],
]

export const inPuddle = (puddles: readonly Puddle[], x: number, z: number): boolean => puddles.some((p) => ((x - p[0]) / p[2]) ** 2 + ((z - p[1]) / p[3]) ** 2 < 1)

/**
 * The Workshop's rain (W313-331): up to 4000 streaks (two points each, in a Float32Array as the page keeps them) that fall in a box, slanted by the
 * wind. A streak that reaches the ground may leave a splash (a sprite of the `normal` pool, and a ring where there is a puddle) when it is near the
 * camera, and comes back at the top. It draws its random numbers in the page's order, so the weather and the Workshop see the same rain.
 */
export class RainField {
  /** Two points per streak: x, y, z of the top and x, y, z of the bottom. */
  readonly positions = new Float32Array(RAIN_CAPACITY * 6)
  /** Streaks alive. */
  count = 0
  /** The slant (the wind along x in the Workshop's units). */
  wind = 1
  on = false
  /** Where the box is centred (the Workshop leaves it at the origin; a game follows the camera). */
  centerX = 0
  centerZ = 0
  puddles: readonly Puddle[] = WORKSHOP_PUDDLES
  /** Replaces the puddle test (a game knows its own wet spots). */
  puddleAt: ((x: number, z: number) => boolean) | undefined

  constructor(private readonly engine: WorkshopEngine) {}

  /** `initRain` (W321): `count` streaks (thinned by the quality), each drawn at a random place in the box. */
  init(count: number, wind: number): void {
    const { random } = this.engine
    this.count = Math.min(RAIN_CAPACITY, Math.round(count * this.engine.context.quality.mult))
    this.wind = wind
    this.on = true
    for (let index = 0; index < this.count; index++) {
      const offset = index * 6
      const x = random.between(BOX_X[0], BOX_X[1])
      const y = random.between(START_HEIGHT[0], START_HEIGHT[1])
      const z = random.between(BOX_Z[0], BOX_Z[1])
      this.set(offset, x, y, z)
    }
  }

  /**
   * What a game does with the field every frame: the box follows the camera (`centerX`, `centerZ`), the streaks thin or thicken to `count` (a new streak
   * starts at a random place of the box, as `init` draws it) and the wind slants them. The golden never calls it.
   */
  drive(count: number, wind: number, centerX: number, centerZ: number): void {
    const { random } = this.engine
    const target = Math.max(0, Math.min(RAIN_CAPACITY, Math.round(count * this.engine.context.quality.mult)))
    this.wind = wind
    this.centerX = centerX
    this.centerZ = centerZ
    this.on = target > 0
    for (let index = this.count; index < target; index++) {
      this.set(index * 6, random.between(BOX_X[0], BOX_X[1]) + centerX, random.between(START_HEIGHT[0], START_HEIGHT[1]), random.between(BOX_Z[0], BOX_Z[1]) + centerZ)
    }
    this.count = target
  }

  /** `updateRain` (W322-329). `camera` is where the eye is; `splash` lets the drops that land leave a splash. */
  update(dt: number, splash: boolean, camera: Vec3Tuple): void {
    if (!this.on) return
    const { random, context } = this.engine
    const positions = this.positions
    const fall = FALL_SPEED * dt
    const slant = this.wind * fall * WIND_PER_FALL
    const reach = SPLASH_RANGE / (1 + context.quality.level)
    for (let index = 0; index < this.count; index++) {
      const o = index * 6
      positions[o]! += slant
      positions[o + 3]! += slant
      positions[o + 1]! -= fall
      positions[o + 4]! -= fall
      const ground = context.groundAt(positions[o]!, positions[o + 2]!)
      if (positions[o + 4]! < ground) {
        const x = positions[o]!
        const z = positions[o + 2]!
        if (splash && random.next() < SPLASH_CHANCE) {
          const distance = Math.hypot(x - camera[0], z - camera[2])
          if (distance < reach) {
            if (random.next() < SPRITE_CHANCE) {
              this.engine.spawn('normal', { p: [x, ground + 0.01, z], dir: UP, cone: 0.6, sp: [0.6, 1.3], life: [0.18, 0.3], size: 0.035, c0: 0xb8c8dc, a: 0.6, g: 9.8, fi: 0 })
            }
            if (this.puddleAt ? this.puddleAt(x, z) : inPuddle(this.puddles, x, z)) {
              this.engine.ring([[x, ground + 0.012, z], 0.01, random.between(0.12, 0.25), random.between(0.4, 0.6), 0x6a7a90])
            }
          }
        }
        const nx = random.between(BOX_X[0], BOX_X[1]) + this.centerX
        const ny = random.between(REENTRY_HEIGHT[0], REENTRY_HEIGHT[1])
        const nz = random.between(BOX_Z[0], BOX_Z[1]) + this.centerZ
        this.set(o, nx, ny, nz)
      }
    }
  }

  /** `rain.visible = false; RN.on = false` (W440): the field stops; the streaks stay where they were. */
  clear(): void {
    this.on = false
  }

  private set(offset: number, x: number, y: number, z: number): void {
    const positions = this.positions
    positions[offset] = x
    positions[offset + 1] = y
    positions[offset + 2] = z
    positions[offset + 3] = x + this.wind * STREAK_SLANT
    positions[offset + 4] = y - STREAK_LENGTH
    positions[offset + 5] = z
  }
}
