import type { FilmProfile, FluidEvent, FluidWorld, LiquidId, StainTint, Vec3 } from '@adatechnology/game-fluids'
import { FILM_PROFILES } from '@adatechnology/game-fluids'
import type { FilmSurfaces, FilmManager } from './manager'

const DEFAULT_DROP_LITERS = 0.00015
const DEFAULT_DROP_RADIUS = 3.2
const MAX_DROPS_PER_FRAME = 6
const RADIUS_SPREAD = 0.3
const RADIUS_BASE = 0.85
const DEFAULT_SPLAT_SPEED = 2.5

/** A splash on the ground or a wall (a wound, a body falling): the film draws it as a drop landing, in the colours of `tint` when given. */
export interface FilmSplat {
  fluid: LiquidId
  point: Vec3
  /** The way the liquid travels (default straight down). */
  direction?: Vec3
  /** Metres per second (default 2.5). */
  speed?: number
  /** Drop radius in millimetres (default 3.2). */
  radius?: number
  /** Drops thrown (default 1). */
  count?: number
  surfaces?: FilmSurfaces
  tint?: StainTint
}

export interface FilmBridgeOptions {
  fluids: FluidWorld
  manager: FilmManager
  /** The seeded stream that spreads the drops (the film never calls `Math.random`). */
  random: () => number
  /** Which film profile a world liquid runs as: by default the liquids that have one (`blood`, `old_blood`, `bile`, `motor_oil`, `fuel`). Map `diesel` to `fuel`, say. */
  liquids?: Readonly<Record<string, LiquidId>>
  /** Litres of one drop of a leak (default 0.00015). */
  dropLiters?: number
  surfaceAt?: (point: Vec3) => FilmSurfaces | null
}

export interface FilmBridge {
  /** Throws drops of a splash into the film. Returns how many found a grid. */
  splat(splat: FilmSplat): number
  /** Weather of the film (the Phase 6 hook): while it rains the film does not dry and spreads 1.5 times faster. */
  setWeather(weather: { rain: number }): void
  /** Streams of the world that feed the film right now. */
  readonly leaks: number
  /** Feeds the leaks: call it each frame with the frame's seconds, before or after `manager.update`. */
  update(dt: number): void
  dispose(): void
}

const filmLiquids = (): Record<string, LiquidId> => Object.fromEntries(FILM_PROFILES.map((profile: FilmProfile) => [profile.id, profile.id]))

/**
 * Joins a fluid world to the film: a `leak` of a liquid that has a film (blood, fuel, oil) drips onto the ground or wall below as drops thrown from the
 * hole, at the rate the world gives, until the stream ends. `splat` is what the characters use for a wound (with the colours of the infection age as
 * `tint`), and `setWeather` is the rain hook.
 */
export function createFilmBridge(options: FilmBridgeOptions): FilmBridge {
  const { fluids, manager, random } = options
  const liquids = options.liquids ?? filmLiquids()
  const dropLiters = options.dropLiters ?? DEFAULT_DROP_LITERS
  const leaks = new Map<string, { fluid: LiquidId; owed: number }>()

  const offLeak = fluids.on('leak', (event: FluidEvent) => {
    if (event.type !== 'leak') return
    const fluid = liquids[event.liquid]
    if (fluid) leaks.set(event.stream, { fluid, owed: 0 })
  })
  const offEnd = fluids.on('stream_end', (event: FluidEvent) => {
    if (event.type === 'stream_end') leaks.delete(event.stream)
  })

  const surfaces = (point: Vec3): FilmSurfaces | undefined => options.surfaceAt?.(point) ?? undefined

  return {
    get leaks() {
      return leaks.size
    },
    splat(splat) {
      const count = splat.count ?? 1
      const speed = splat.speed ?? DEFAULT_SPLAT_SPEED
      const direction = splat.direction ?? [0, -1, 0]
      const length = Math.hypot(direction[0], direction[1], direction[2]) || 1
      const velocity: Vec3 = [(direction[0] / length) * speed, (direction[1] / length) * speed, (direction[2] / length) * speed]
      let landed = 0
      for (let i = 0; i < count; i++) {
        const grid = manager.launch({
          fluid: splat.fluid,
          point: splat.point,
          velocity,
          radius: (splat.radius ?? DEFAULT_DROP_RADIUS) * (RADIUS_BASE + random() * RADIUS_SPREAD),
          ...(splat.surfaces ? { surfaces: splat.surfaces } : {}),
          ...(splat.tint ? { tint: splat.tint } : {}),
        })
        if (grid) landed++
      }
      return landed
    },
    setWeather: (weather) => manager.setWeather(weather),
    update(dt) {
      if (leaks.size === 0) return
      const streams = new Map(fluids.streams().map((stream) => [stream.id, stream]))
      for (const [id, leak] of leaks) {
        const stream = streams.get(id)
        if (!stream) continue
        leak.owed += (stream.rate * dt) / dropLiters
        let thrown = 0
        while (leak.owed >= 1 && thrown < MAX_DROPS_PER_FRAME) {
          leak.owed -= 1
          thrown++
          manager.launch({
            fluid: leak.fluid,
            point: stream.origin,
            velocity: stream.velocity,
            radius: DEFAULT_DROP_RADIUS * (RADIUS_BASE + random() * RADIUS_SPREAD),
            ...(surfaces(stream.origin) ? { surfaces: surfaces(stream.origin)! } : {}),
          })
        }
        if (thrown === MAX_DROPS_PER_FRAME) leak.owed = 0
      }
    },
    dispose() {
      offLeak()
      offEnd()
      leaks.clear()
    },
  }
}
