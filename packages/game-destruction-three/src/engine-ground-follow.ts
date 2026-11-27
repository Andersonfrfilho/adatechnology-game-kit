import { AWAKE_BOUNDS_STRIDE } from '@adatechnology/game-physics'
import type { BodyId, Layer, SeamWorld } from '@adatechnology/game-physics'

/** How far ahead (s) of an outside body, past the update, its path is asked of the ground. */
export const AHEAD_S = 0.15
/** Updates a tile may go unasked by any awake body before it is looked at for removal, and between two such looks. */
export const IDLE_UPDATES = 600
const SWEEP_EVERY = 30
/** The most tiles looked at (`overlapShape`) in one sweep: the rest wait for the next. */
const MOST_PER_SWEEP = 64
/** Half of the height (m) of the box a tile is asked about: more than any ground the kit makes. */
const HALF_HEIGHT = 2000
const INITIAL_ROWS = 64
const OCCUPANTS: readonly Layer[] = ['debris', 'prop', 'character', 'agent', 'vehicle', 'corpse']

/** What the follower needs of the pieces that own the tiles (`EnginePieces`): the tiles are theirs, the follower only says which and when. */
export interface GroundFollowHost {
  readonly world: SeamWorld
  /** The bodies the pieces own: they keep their own ground. */
  readonly skip: ReadonlySet<BodyId>
  readonly tile: number
  readonly margin: number
  readonly maxStops: number
  readonly keyOrigin: number
  readonly keyStride: number
  /** The tile is not laid, or its ground changed. */
  needs(key: number): boolean
  has(key: number): boolean
  /** Laid before this returns. */
  layNow(key: number, ix: number, iz: number): void
  /** Laid now, or asked of the ground worker when there is one. */
  layLater(key: number, ix: number, iz: number): void
  drop(key: number): void
}

/**
 * Ground under what the engine moves that the pieces do not own (a vehicle a module made a body of, a character): the engine's own view of its awake bodies
 * (`readAwakeBounds`) says where they are and how fast they go, and the tiles under them and ahead of them are laid, the ones that were nobody's for long taken away.
 * Under a body a missing tile is laid at once, even with a ground worker: it falls through what is not there yet. Ahead of it the worker has the time.
 */
export class GroundFollow {
  private rows = new Float64Array(INITIAL_ROWS * AWAKE_BOUNDS_STRIDE)
  /** The update each tile was last asked for by an outside body: the tiles that only the pieces use are not in it, and are never taken away. */
  private readonly askedAt = new Map<number, number>()
  private readonly occupants: BodyId[] = []
  private readonly sweepFilter = { layers: OCCUPANTS }
  private stamp = 0
  private readonly box = { kind: 'box' as const, half: [0, HALF_HEIGHT, 0] as [number, number, number] }

  constructor(private readonly host: GroundFollowHost) {
    this.box.half[0] = this.box.half[2] = host.tile / 2
  }

  /** The tile count the follower is keeping an eye on. */
  get watched(): number {
    return this.askedAt.size
  }

  clear(): void {
    this.askedAt.clear()
  }

  update(dt: number, stamp: number): void {
    this.stamp = stamp
    const { world, skip } = this.host
    let count = world.readAwakeBounds(this.rows, skip)
    if (count * AWAKE_BOUNDS_STRIDE > this.rows.length) {
      this.rows = new Float64Array(count * 2 * AWAKE_BOUNDS_STRIDE)
      count = world.readAwakeBounds(this.rows, skip)
    }
    for (let row = 0; row < count; row++) this.cover(row * AWAKE_BOUNDS_STRIDE, dt)
    if (stamp % SWEEP_EVERY === 0) this.sweep()
  }

  /** The tiles under the row's box laid now, the ring around it and the path ahead of it as the host lays them. */
  private cover(o: number, dt: number): void {
    const r = this.rows
    const { margin, tile, maxStops } = this.host
    const minX = r[o + 2] as number, minZ = r[o + 4] as number, maxX = r[o + 5] as number, maxZ = r[o + 7] as number
    const vx = r[o + 8] as number, vz = r[o + 9] as number
    this.visit(minX, maxX, minZ, maxZ, true)
    const time = dt + AHEAD_S
    const travel = Math.hypot(vx, vz) * time
    const stops = travel > margin ? Math.min(maxStops, Math.ceil(travel / tile)) : 0
    for (let stop = 0; stop <= stops; stop++) {
      const fraction = stops === 0 ? 0 : stop / stops
      const dx = vx * time * fraction
      const dz = vz * time * fraction
      this.visit(minX + dx - margin, maxX + dx + margin, minZ + dz - margin, maxZ + dz + margin, false)
    }
  }

  private visit(minX: number, maxX: number, minZ: number, maxZ: number, now: boolean): void {
    const host = this.host
    const { tile: size, keyOrigin, keyStride } = host
    for (let ix = Math.floor(minX / size); ix <= Math.floor(maxX / size); ix++) {
      for (let iz = Math.floor(minZ / size); iz <= Math.floor(maxZ / size); iz++) {
        const key = (ix + keyOrigin) * keyStride + (iz + keyOrigin)
        this.askedAt.set(key, this.stamp)
        if (!host.needs(key)) continue
        if (now) host.layNow(key, ix, iz)
        else host.layLater(key, ix, iz)
      }
    }
  }

  /** The tiles unasked for `IDLE_UPDATES` with nothing that moves on them are taken away; one with something on it is asked again later. */
  private sweep(): void {
    const host = this.host
    let looked = 0
    for (const [key, last] of this.askedAt) {
      if (!host.has(key)) {
        this.askedAt.delete(key)
        continue
      }
      if (this.stamp - last < IDLE_UPDATES) continue
      if (looked++ >= MOST_PER_SWEEP) return
      if (this.isOccupied(key)) {
        this.askedAt.set(key, this.stamp)
        continue
      }
      this.askedAt.delete(key)
      host.drop(key)
    }
  }

  private isOccupied(key: number): boolean {
    const { tile, keyOrigin, keyStride, world } = this.host
    const ix = Math.floor(key / keyStride) - keyOrigin
    const iz = (key % keyStride) - keyOrigin
    return world.overlapShape(this.box, [(ix + 0.5) * tile, 0, (iz + 0.5) * tile], [0, 0, 0, 1], this.occupants, this.sweepFilter) > 0
  }
}
