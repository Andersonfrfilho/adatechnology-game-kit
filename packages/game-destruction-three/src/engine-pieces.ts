import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'
import type { BodyId, Material, Quat, Rolling, SeamWorld, ShapeDesc } from '@adatechnology/game-physics'

import { buildGroundTile, sameGround } from './engine-ground'
import type { GroundTile } from './engine-ground'
import { sameSolid } from './engine-ground-solid'
import type { SolidVolume } from './engine-ground-solid'
import { EngineStatics } from './engine-statics'
import type { StaticSolid } from './engine-statics'
import type { PartBox, PieceBody, PieceRound, PieceSweepHit } from './internal'

export type { StaticSolid } from './engine-statics'

export interface EnginePieceOptions {
  readonly groundAt: (x: number, z: number) => number
  readonly gravity: number
  /** The fixed boxes per object; a new array for an object means it changed (measured again, broken, gone). */
  readonly staticSolids?: () => ReadonlyMap<string, readonly StaticSolid[]>
  readonly sweep?: (piece: PieceBody, from: Vec3, to: Vec3) => PieceSweepHit | null
  readonly onSlam?: (piece: PieceBody, hit: PieceSweepHit, speed: number) => void
  readonly onKnock?: (a: PieceBody, b: PieceBody, point: Vec3, speed: number) => void
  readonly onHardLanding: (piece: PieceBody, point: Vec3, speed: number) => void
}

/** A piece's box seen from above (`EnginePieces.footprint`). */
interface Footprint {
  readonly corners: Float64Array
  readonly normals: Float64Array
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Side of a tile of ground (m); how far around an awake piece tiles are laid (m). */
const TILE = 2
const TILE_MARGIN = 0.5
/** The most (m) a piece's tips swinging in one update widen the tiles laid around its footprint. */
const MAX_SWING = 3
/** The most stops along a piece's path in one update where its footprint's tiles are laid (a piece that crosses a tile or more in an update lands on ground not laid yet). */
const MAX_PATH_STOPS = 6
/** A tile's key: its column and row from `TILE_KEY_ORIGIN`, in one number (no text made per tile per update). */
const TILE_KEY = 65536
const TILE_KEY_ORIGIN = 32768
const MU_STATIC = 0.7
const ROLLING_RESISTANCE = 0.015
const MU_DYNAMIC = 0.6
const GROUND: Material = { frictionStatic: MU_STATIC, frictionDynamic: MU_DYNAMIC, restitution: 0, rolling: ROLLING_RESISTANCE }
const STILL_SPEED = 0.12
const STILL_SPIN = 0.45
const HARD_LANDING = 3
const SLAM_MIN_SPEED = 2
const SLAM_BOUNCE = 0.2
/** Slower than this (m/s) into a wall the engine does not have, a piece does not bounce off it: the engine's own threshold (Jolt's `mMinVelocityForRestitution`). */
const BOUNCE_SPEED = 1
const SLAM_FLOOR_NORMAL = 0.7
const KNOCK_EVERY = 0.15
/** Sleeping pieces whose ground is looked at again each update, and how far (m) it must have dropped for one to wake. */
const GROUND_CHECKS = 16
const GROUND_DROP = 0.02
/** The kit's balancing rule: a support narrower than this share of the height of the centre of mass is a balancing act, and the push (rad/s^2 per metre) that ends it. */
const NARROW = 0.3
/** Radii of a round piece's profile that differ by less than this (m) are one cylinder; the segments of the ring each profile point makes in the engine's shape. */
const TAPER_MIN = 0.002
const RING_SEGMENTS = 16
const TOPPLE = 3
/** How many times the point-mass bound on gravity's hold the push is: the engine held a 5 cm leg against 2.5 times it, and tipped it at 3 (measured). */
const HOLD_MARGIN = 4
/** A support whose middle is closer than this (m) to the centre of mass is under it: which way it goes over is then not read from the contact points, which flicker. */
const SIDE_DEAD = 0.01
/** The strong push stops once it has turned a column this fast (rad/s): a 5 cm leg tips from it; measured on the bowl, 0.1 made 4.2 cm in seed 57 and 1 made 31 cm in seed 61, 0.3 is clean in all 128. */
const PUSH_SPIN = 0.3
/** Corners this close (m) to the lowest one are what it stands on. */
const STEADY_TURN = 0.1
const STEADY_SECONDS = 1.5
/** A piece on a narrow support that has not turned for this long (s) is propped by something its contact points do not read as support (a tent of two plates on their edges). */
const PROPPED_SECONDS = 0.3
/** What is left of its friction while propped: it slips, and gravity, not the kit's push, brings it down. */
const PROPPED_GRIP = 0.1
/** How far (m) a new piece may reach into the ground and be left to the engine's contact (over its slop, under a thin plate's half), and how far above it one lifted is put. */
const SINK = 0.005
const LIFT_MARGIN = 0.001
/** Ground that rises under a piece by up to this (m) is cleared by the engine's contact within an update (2 mm of push-out in each of 2 passes a step, 2 to 6 steps): the kit does not lift the piece. */
const ENGINE_CLEARS = 0.01
/** Two numbers of a pose further apart than this differ (the centre comes back through the root: equal within rounding is the same). */
const far = (a: number, b: number): boolean => Math.abs(a - b) > 1e-6
/** How many times a piece made inside fixed things is moved out of the deepest one (it may be inside two, or wedged between them). */
const OUT_TRIES = 8
/** The first step (m) a wedged piece is lifted by (`outOfStatics`). */
const WEDGE_LIFT = 0.1
/** A lift that leaves more than this share of the depth it had is no way out of that fixed thing: the piece is in two (`outOfStatics`). */
const NO_PROGRESS = 0.75
/** How far apart (m) the poses are that a wedge lift is checked at on its way up: about the piece's thinnest half, so it cannot step over a slab it would cross. */
const WAY_STEP_MIN = 0.02
const WAY_STEP_MAX = 0.1

interface Link {
  readonly id: BodyId
  /** The ground under its centre when it went to sleep: the engine does not see `groundAt` change, the kit looks (`groundTurn`). */
  groundAtSleep: number
  readonly user: number
  shapeKey: readonly unknown[]
  /** What `shapeKey` was made from, by reference: the same objects need no new key (most updates). */
  shapeFrom: readonly unknown[]
  readonly pos: number[]
  readonly quat: number[]
  readonly vel: number[]
  readonly ang: number[]
  held: boolean
  sleeping: boolean
  /** The update it was last handed in (`update`): one not handed any more is removed. */
  seen: number
  /** Its centre and vertical speed before the step, when it was awake (`readBack`). */
  readonly before: Vec3
  beforeVy: number
  stepped: boolean
  /** The side (x, z) the balancing push goes to: kept while the support is centred under the piece, where the contact points only flicker either way (`topple`). */
  readonly side: [number, number]
  isSlipping: boolean
}

interface Tile {
  /** The ground body: a slab when the tile is level, else a height field; kept across changes so what lies on it keeps its contacts. */
  ground: BodyId
  slab: boolean
  /** The step boxes' body, if the tile has steps, and the boxes it was made from. */
  steps: BodyId | null
  boxes: readonly number[]
  /** The solid body under the height field (not under a slab) and the boxes it was made from: a second body, so the height field keeps its own shape across changes. */
  solid: BodyId | null
  volume: SolidVolume
  samples: Float64Array
  dirty: boolean
}

/**
 * Steps the loose pieces through the kit's physics contract (`game-physics`): each piece a dynamic body at its centre of mass with its parts' boxes (or its box, or
 * its round shape), its mass, and its surface's static and dynamic friction (the engine adapter applies Coulomb per contact). The ground is `groundAt` as triangles
 * that keep its steps (`engine-ground`); the fixed things are their drawn boxes, turned as drawn. On top stay the kit's rules the engine does not know: the sweep
 * against walls, hard landings, falling over (`tip`), the knock sound, and (in `PieceSystem`) the budget of awake pieces and their rest points.
 */
export class EnginePieces {
  private readonly links = new Map<PieceBody, Link>()
  private readonly byUser = new Map<number, PieceBody>()
  /** The pieces by object id: what the sweep meets that the engine already has (`sweepOn`). */
  private readonly byObject = new Map<string, PieceBody>()
  private nextUser = 1
  private updates = 0
  private turn = 0
  /**
   * Pieces found wholly under the ground after a step (through a one-sided ground triangle: the engine has no solid below it) and put back on it: the invariant
   * of §12 (nothing goes under the floor), counted so a test or the room log can fail on it. A net, not a cure: none in a healthy run.
   */
  fellThrough = 0
  private readonly tiles = new Map<number, Tile>()
  /** The host's fixed things (`staticSolids`) as static bodies. */
  readonly statics: EngineStatics
  private readonly ignored = new Set<string>()
  private readonly knocks = new Map<string, number>()
  private readonly footprintOut: Footprint = { corners: new Float64Array(16), normals: new Float64Array(6), minX: 0, maxX: 0, minZ: 0, maxZ: 0 }
  private readonly pose = new Float64Array(7)
  private readonly velocity = new Float64Array(6)
  private readonly contactXYZ = new Float32Array(48)
  private readonly outAxis = new Float64Array(3)
  private readonly wayAxis = new Float64Array(3)
  /** The centre `readBack` reads into (the sweep may move it). */
  private readonly readPos: Vec3 = [0, 0, 0]
  private readonly v: THREE_NS.Vector3
  private readonly u: THREE_NS.Vector3
  private readonly w: THREE_NS.Vector3
  private readonly turn3: THREE_NS.Quaternion

  constructor(
    THREE: typeof THREE_NS,
    private readonly world: SeamWorld,
    private readonly o: EnginePieceOptions,
  ) {
    this.v = new THREE.Vector3()
    this.u = new THREE.Vector3()
    this.w = new THREE.Vector3()
    this.turn3 = new THREE.Quaternion()
    this.statics = new EngineStatics(world, GROUND)
  }

  /** A piece not handed in this update goes (`update`; a callback made once, so the walk makes no entry per piece). */
  private readonly removeUnseen = (link: Link, b: PieceBody): void => {
    if (link.seen !== this.updates) this.remove(b)
  }

  remove(b: PieceBody): void {
    const link = this.links.get(b)
    if (!link) return
    this.world.removeBody(link.id)
    this.byUser.delete(link.user)
    if (this.byObject.get(b.objectId) === b) this.byObject.delete(b.objectId)
    this.links.delete(b)
  }

  clear(): void {
    for (const b of [...this.links.keys()]) this.remove(b)
    for (const t of this.tiles.values()) {
      this.world.removeBody(t.ground)
      if (t.steps !== null) this.world.removeBody(t.steps)
      if (t.solid !== null) this.world.removeBody(t.solid)
    }
    this.tiles.clear()
    this.statics.clear()
    this.ignored.clear()
  }

  /**
   * The ground under the disc changed (the host dug or heaped it): its tiles are laid again before the next step, and what the new ground reaches into is lifted
   * onto it once, as one made in the ground is (`underGround`): the engine pushes a deep one out too slowly and puts it to sleep half way.
   */
  groundChanged(x: number, z: number, radius: number): void {
    this.markDirty(x, z, radius)
    for (const [b, link] of this.links) {
      if (b.held) continue
      const c = this.centre(b)
      if (Math.hypot(c.x - x, c.z - z) > radius + Math.hypot(...b.halfExtents)) continue
      // lifted, a 1 t pole whose wire tip meets settling rubble would gain its weight times the rise from nowhere
      const under = this.underGround(b)
      if (under <= ENGINE_CLEARS) continue
      b.root.position.y += under
      b.root.updateMatrixWorld(true)
      link.groundAtSleep = NaN
    }
  }

  /** The tiles the disc touches are laid again before the next step. */
  private markDirty(x: number, z: number, radius: number): void {
    for (const [key, tile] of this.tiles) {
      const ix = Math.floor(key / TILE_KEY) - TILE_KEY_ORIGIN
      const iz = (key % TILE_KEY) - TILE_KEY_ORIGIN
      const nx = Math.max(ix * TILE, Math.min(x, (ix + 1) * TILE))
      const nz = Math.max(iz * TILE, Math.min(z, (iz + 1) * TILE))
      if (Math.hypot(nx - x, nz - z) <= radius) tile.dirty = true
    }
  }

  /**
   * Before the frame's fixed steps: the pairs in `apart` (by object id, `a\0b`) do not meet in the engine; the kit puts them apart along the ground. `dt` is the frame's
   * time, `h` the fixed step a kinematic target is reached in.
   */
  prepare(list: readonly PieceBody[], dt: number, h: number, apart: ReadonlySet<string>): void {
    // nothing here is made anew per piece per update (the collector's pauses were the worst frames: gate 0 B5)
    const n = ++this.updates
    for (const b of list) {
      const link = this.links.get(b)
      if (link) link.seen = n
    }
    this.links.forEach(this.removeUnseen)
    this.groundTurn(list)
    // the fixed things first: a piece made or put this update is checked against them (`outOfStatics`)
    this.layStatics()
    for (const b of list) this.sync(b, dt, h)
    this.layGround(list, dt)
    this.keepApart(apart)
    for (const b of list) {
      const link = this.links.get(b)
      if (!link) continue
      link.stepped = !b.held && !b.sleeping
      if (!link.stepped) continue
      const c = this.centre(b)
      link.before[0] = c.x
      link.before[1] = c.y
      link.before[2] = c.z
      link.beforeVy = b.velocity[1]
    }
  }

  /** Before each fixed step after the first of a frame: a held piece's target again, so it moves by `h`, not by the frame's `dt`. */
  moveHeld(list: readonly PieceBody[], h: number): void {
    for (const b of list) {
      const link = this.links.get(b)
      if (!link || !b.held) continue
      const c = this.centre(b)
      const q = b.root.quaternion
      this.world.moveKinematic(link.id, [c.x, c.y, c.z], [q.x, q.y, q.z, q.w], h)
    }
  }

  /** After the frame's fixed steps: each piece read back with the kit's rules on it, then the knock sounds from the frame's contact rows. */
  finish(list: readonly PieceBody[], dt: number, time: number): void {
    for (const b of list) this.readBack(b, dt, time)
    this.knock(time)
  }

  /**
   * A few sleeping pieces each update (`GROUND_CHECKS`, in turn) look at the ground under them again: dug or slid away since they slept (and nobody called
   * `wakeRegion`), they wake and the ground there is laid again. Their other supports are the engine's: it wakes what lay on a body that moves.
   */
  private groundTurn(list: readonly PieceBody[]): void {
    const n = list.length
    for (let k = 0; k < Math.min(GROUND_CHECKS, n); k++) {
      this.turn = (this.turn + 1) % n
      const b = list[this.turn]
      const link = this.links.get(b)
      if (!link || !b.sleeping || b.held || Number.isNaN(link.groundAtSleep)) continue
      const c = this.centre(b)
      if (Math.abs(this.o.groundAt(c.x, c.z) - link.groundAtSleep) <= GROUND_DROP) continue
      b.sleeping = false
      b.still = 0
      this.groundChanged(c.x, c.z, Math.hypot(...b.halfExtents))
    }
  }

  /** A round piece whose radius changes along its axis (a bottle, a cup): its shape is not the straight cylinder at its widest, or it would roll straight. */
  private isTapered(round: PieceRound): boolean {
    const radii = round.profile?.map(([, radius]) => radius) ?? []
    return radii.length > 1 && Math.max(...radii) - Math.min(...radii) > TAPER_MIN
  }

  /** The hull of the rings of its profile (`PieceRound.profile`), in the piece's frame: a cone, or a bottle, rolls round its narrow end. */
  private ringPoints(round: PieceRound): number[] {
    const points: number[] = []
    const across = [0, 1, 2].filter((axis) => axis !== round.axis)
    for (const [at, radius] of round.profile ?? []) {
      for (let k = 0; k < RING_SEGMENTS; k++) {
        const angle = (2 * Math.PI * k) / RING_SEGMENTS
        const point = [0, 0, 0]
        point[round.axis] = at
        point[across[0]!] = Math.cos(angle) * radius
        point[across[1]!] = Math.sin(angle) * radius
        points.push(point[0]!, point[1]!, point[2]!)
      }
    }
    return points
  }

  private shapeOf(b: PieceBody): ShapeDesc {
    const round = b.round
    if (round) {
      if (round.kind === 'sphere') return { kind: 'sphere', radius: round.radius }
      if (this.isTapered(round)) return { kind: 'compound', children: [{ shape: { kind: 'convex', points: this.ringPoints(round) }, position: [0, 0, 0] }] }
      // a cylinder stands along its own y: turned onto x or z
      const rotation: Quat = round.axis === 0 ? [0, 0, Math.SQRT1_2, Math.SQRT1_2] : round.axis === 2 ? [Math.SQRT1_2, 0, 0, Math.SQRT1_2] : [0, 0, 0, 1]
      return { kind: 'compound', children: [{ shape: { kind: 'cylinder', halfHeight: b.halfExtents[round.axis], radius: round.radius }, position: [0, 0, 0], rotation }] }
    }
    if (b.partBoxes && b.partBoxes.length > 0) {
      return { kind: 'compound', children: b.partBoxes.map((part, i) => ({ shape: { kind: 'box', half: part.half }, position: part.center, ...(part.rotation ? { rotation: part.rotation } : {}), tag: i })) }
    }
    return { kind: 'box', half: b.halfExtents }
  }

  /**
   * How far (m) a new piece reaches under the ground: its part boxes' corners (a round piece: the lowest points of its rim) below `groundAt`. The ground is a surface
   * to the engine, and a piece made through it is caught by its sides and pushed down, not out; so it is lifted out once, when its body is made, never later.
   */
  private underGround(b: PieceBody): number {
    // from the root's own position and turn: its world matrix may not be up to date yet when the piece is new
    const c = this.centre(b)
    const cx = c.x, cy = c.y, cz = c.z
    const q = b.root.quaternion
    const p = this.u
    let under = 0
    const at = (x: number, y: number, z: number, below = 0): void => {
      p.set(x, y, z).applyQuaternion(q)
      under = Math.max(under, this.o.groundAt(cx + p.x, cz + p.z) - (cy + p.y - below))
    }
    const round = b.round
    if (round) {
      const axis: Vec3 = [round.axis === 0 ? 1 : 0, round.axis === 1 ? 1 : 0, round.axis === 2 ? 1 : 0]
      const tilt = p.set(axis[0], axis[1], axis[2]).applyQuaternion(q).y
      const reach = round.kind === 'sphere' ? round.radius : round.radius * Math.sqrt(Math.max(0, 1 - tilt * tilt))
      const h = round.kind === 'sphere' ? 0 : b.halfExtents[round.axis]
      for (const s of [-1, 1]) at(axis[0] * h * s, axis[1] * h * s, axis[2] * h * s, reach)
      return this.liftFor(b, under)
    }
    // the part boxes sit about the centre of mass, as the body's compound does
    const boxes: readonly PartBox[] = b.partBoxes && b.partBoxes.length > 0 ? b.partBoxes : [{ center: [0, 0, 0], half: b.halfExtents }]
    const corner = this.w
    for (const box of boxes) {
      const r = box.rotation
      for (let k = 0; k < 8; k++) {
        corner.set((k & 1 ? 1 : -1) * box.half[0], (k & 2 ? 1 : -1) * box.half[1], (k & 4 ? 1 : -1) * box.half[2])
        if (r) corner.applyQuaternion(this.turn3.set(r[0], r[1], r[2], r[3]))
        at(box.center[0] + corner.x, box.center[1] + corner.y, box.center[2] + corner.z)
      }
    }
    return this.liftFor(b, under)
  }

  /**
   * Made through the ground by more than a contact's sink and less than its own size: lifted onto it. Deeper than its largest half size it is not lying in the
   * ground but under something `groundAt` folds into it (a box on the floor half under a table top), and it is left where it is.
   */
  private liftFor(b: PieceBody, under: number): number {
    return under > SINK && under <= Math.max(...b.halfExtents) ? under + LIFT_MARGIN : 0
  }

  /** A round piece turns about its axis by its own k (a full can, an empty one); about the others, and for a box, the engine's from the shape. */
  private inertiaOf(b: PieceBody): Vec3 | undefined {
    const round = b.round
    if (!round) return undefined
    const [hx, hy, hz] = b.halfExtents
    const m = b.mass
    const out: [number, number, number] = [(m * (hy * hy + hz * hz)) / 3, (m * (hx * hx + hz * hz)) / 3, (m * (hx * hx + hy * hy)) / 3]
    const about = round.inertia * m * round.radius * round.radius
    if (round.kind === 'sphere') return [about, about, about]
    out[round.axis] = about
    return out
  }

  /** A round piece rolls to a stop by its surface's rolling resistance (the adapter's rule; the engine has none). */
  private rollingOf(b: PieceBody): Rolling | undefined {
    return b.round ? { coefficient: b.friction?.rolling ?? ROLLING_RESISTANCE, radius: b.round.radius } : undefined
  }

  private material(b: PieceBody): Material {
    return {
      frictionStatic: b.friction?.static ?? MU_STATIC,
      frictionDynamic: b.friction?.dynamic ?? MU_DYNAMIC,
      // a box lands dead (the kit never bounced them); a round piece bounces by its material
      restitution: b.round ? (b.restitution ?? SLAM_BOUNCE) : 0,
      rolling: b.friction?.rolling ?? ROLLING_RESISTANCE,
    }
  }

  /** Makes the body of a piece, or brings it up to date with what changed on the piece since the last step (moved, pushed, picked up, put to sleep). */
  private sync(b: PieceBody, dt: number, h: number): void {
    let c = this.centre(b)
    const q = b.root.quaternion
    let link = this.links.get(b)
    if (!link) {
      const under = this.underGround(b)
      if (under > 0) {
        b.root.position.y += under
        b.root.updateMatrixWorld(true)
        c = this.centre(b)
      }
      const user = this.nextUser++
      const id = this.world.createBody({
        shape: this.shapeOf(b),
        motion: b.held ? 'kinematic' : 'dynamic',
        position: [c.x, c.y, c.z],
        rotation: [q.x, q.y, q.z, q.w],
        mass: b.mass,
        inertia: this.inertiaOf(b),
        centreAtOrigin: true,
        material: this.material(b),
        layer: 'debris',
        // no air drag: the kit's pieces never had any (a round piece's rolling resistance is the adapter's, `rolling`)
        angularDamping: 0,
        linearDamping: 0,
        // swept (Jolt's linear cast) so nothing the engine has is passed through, now that the kit's sweep no longer sets a piece back from it (`sweepOn`); the
        // engine casts only a body that moves more than most of its own thickness in a step, so one at rest costs nothing more
        continuous: true,
        rolling: this.rollingOf(b),
        sleeping: b.sleeping,
        user,
        linearVelocity: [b.velocity[0], b.velocity[1], b.velocity[2]],
        angularVelocity: [b.angularVelocity[0], b.angularVelocity[1], b.angularVelocity[2]],
      })
      link = {
        id, groundAtSleep: NaN, user, shapeKey: this.shapeKey(b), shapeFrom: this.shapeFrom(b), pos: [c.x, c.y, c.z], quat: [q.x, q.y, q.z, q.w], vel: [...b.velocity], ang: [...b.angularVelocity],
        held: b.held, sleeping: b.sleeping, seen: this.updates, before: [0, 0, 0], beforeVy: 0, stepped: false, side: [1, 1], isSlipping: false,
      }
      this.links.set(b, link)
      this.byUser.set(user, b)
      this.byObject.set(b.objectId, b)
      this.outOfStatics(b, link)
      return
    }
    // by value: the renderer hands new arrays for the same boxes when it measures a piece again, and a new shape wakes the body; the same objects as last time
    // are the same shape, and are not turned into text again (it was a sixth of an update with 200 pieces)
    if (!this.sameFrom(b, link.shapeFrom)) this.reshape(b, link)
    if (b.held !== link.held) {
      link.held = b.held
      this.world.setMotion(link.id, b.held ? 'kinematic' : 'dynamic')
    }
    if (b.held) {
      this.world.moveKinematic(link.id, [c.x, c.y, c.z], [q.x, q.y, q.z, q.w], h)
      return
    }
    // the centre comes back through the root (position minus the turned centre, then plus it again): equal within rounding is not moved
    const moved = far(c.x, link.pos[0]) || far(c.y, link.pos[1]) || far(c.z, link.pos[2]) || far(q.x, link.quat[0]) || far(q.y, link.quat[1]) || far(q.z, link.quat[2]) || far(q.w, link.quat[3])
    if (moved) this.world.setPose(link.id, [c.x, c.y, c.z], [q.x, q.y, q.z, q.w], !b.sleeping)
    // `tip` is the kit solver's push for a piece whose feet are thinner than its box; here the engine stands it on its parts as drawn, so it goes over by itself
    b.tipping = null
    if (!b.round && b.onGround && !b.sleeping) this.topple(b, dt)
    else this.slip(b, link, false)
    const v = b.velocity
    const w = b.angularVelocity
    const pushed = v[0] !== link.vel[0] || v[1] !== link.vel[1] || v[2] !== link.vel[2] || w[0] !== link.ang[0] || w[1] !== link.ang[1] || w[2] !== link.ang[2]
    if (pushed) this.world.setVelocity(link.id, [v[0], v[1], v[2]], [w[0], w[1], w[2]])
    if (b.sleeping && !link.sleeping) this.world.sleep(link.id)
    else if (!b.sleeping && link.sleeping) {
      // woken from outside (its support looked at again, a blow): the ground under it may have been dug while it slept
      this.world.wake(link.id)
      this.markDirty(c.x, c.z, Math.hypot(...b.halfExtents))
    } else if (pushed) this.world.wake(link.id)
  }

  /**
   * A piece made or put by the kit or the host (not moved by the engine) inside a fixed thing goes out of it at once, the shortest way, as one made in the ground is
   * lifted (`underGround`). Left to the engine it is pushed out a little each step (`maxPushOut`), which reads as the piece rising by itself: a roof sheet made 1 m
   * into a shelf rose 0.83-0.94 m over the room's 11 s. Only past a contact's sink (`SINK`): resting on a shelf it is not moved.
   */
  private outOfStatics(b: PieceBody, link: Link): void {
    if (!this.world.penetration) return
    const axis = this.outAxis
    let px = 0, py = 0, pz = 0
    let wedged = false
    let lifts = 0
    // what the piece was made inside, how deep it was where it turned out to be wedged, and how far the tries moved it in all: a way out that is no better is put back (`putBack`)
    let found = 0
    let wedge = 0
    let previous = 0
    const moved = [0, 0, 0]
    for (let i = 0; i < OUT_TRIES; i++) {
      // the host's fixed things only: a piece made in the ground is the ground's rule (`underGround`; out of a step the shortest way too, the bowl's seed 39 made 3 mm)
      const depth = this.world.penetration(link.id, axis, this.statics.ids)
      if (depth <= SINK) return
      if (i === 0) found = depth
      // out of one the shortest way put it back into the other (a door made between its frame and a car parked against the wall), or no shallower for it (a door whose jamb it overlaps the same at any height rode up 0.4 m): it goes up out of both
      wedged ||= i > 0 && (axis[0] * px + axis[1] * py + axis[2] * pz < -0.5 || depth > previous * NO_PROGRESS)
      previous = depth
      px = axis[0]
      py = axis[1]
      pz = axis[2]
      if (wedged) {
        axis[0] = 0
        axis[1] = 1
        axis[2] = 0
      }
      // up out of a wedge, the depth across tells nothing of how high the two reach: a step that doubles each try, at most twice as high as it had to go
      const d = wedged ? depth + WEDGE_LIFT * 2 ** lifts++ : depth + LIFT_MARGIN
      this.world.readPose(link.id, this.pose, 0)
      // a lift that goes through a third fixed thing on its way (a door made in its doorway, lifted past the lintel, the ceiling slab and into the attic) is no exit
      if (wedged && wedge === 0) wedge = depth + SINK
      if (wedged && !this.isWayClear(b, link, d, wedge)) {
        this.putBack(b, link, moved)
        return
      }
      this.moveBy(b, link, axis, d, moved)
    }
    if (this.world.penetration(link.id, axis, this.statics.ids) > found) this.putBack(b, link, moved)
  }

  /** The piece is moved by `d` along `axis`, in the engine and on its root (`this.pose` is where it stands); `moved` adds it up. */
  private moveBy(b: PieceBody, link: Link, axis: Float64Array, d: number, moved: number[]): void {
    const p = this.pose
    p[0] += axis[0] * d
    p[1] += axis[1] * d
    p[2] += axis[2] * d
    this.world.setPose(link.id, [p[0], p[1], p[2]], [p[3], p[4], p[5], p[6]], !b.sleeping)
    for (let k = 0; k < 3; k++) moved[k] += axis[k] * d
    b.root.position.x += axis[0] * d
    b.root.position.y += axis[1] * d
    b.root.position.z += axis[2] * d
    b.root.updateMatrixWorld(true)
    link.pos[0] = p[0]
    link.pos[1] = p[1]
    link.pos[2] = p[2]
  }

  /** Back to where the piece was made: the tries moved it by `moved`, and the engine is left to push it out of what it is in (a little each step). */
  private putBack(b: PieceBody, link: Link, moved: number[]): void {
    const back = this.wayAxis
    back[0] = -moved[0]
    back[1] = -moved[1]
    back[2] = -moved[2]
    this.world.readPose(link.id, this.pose, 0)
    this.moveBy(b, link, back, 1, moved)
  }

  /** Whether going up by `d` from `this.pose` meets no fixed thing deeper than `limit` (m): sampled about every thinnest half of the piece, which leaves the body where it was. */
  private isWayClear(b: PieceBody, link: Link, d: number, limit: number): boolean {
    const p = this.pose
    const up = this.outAxis
    const step = Math.min(WAY_STEP_MAX, Math.max(WAY_STEP_MIN, Math.min(...b.halfExtents)))
    let isClear = true
    for (let s = step; s < d && isClear; s += step) {
      this.world.setPose(link.id, [p[0] + up[0] * s, p[1] + up[1] * s, p[2] + up[2] * s], [p[3], p[4], p[5], p[6]], false)
      isClear = (this.world.penetration?.(link.id, this.wayAxis, this.statics.ids) ?? 0) <= limit
    }
    this.world.setPose(link.id, [p[0], p[1], p[2]], [p[3], p[4], p[5], p[6]], false)
    return isClear
  }

  /**
   * Its shape, mass, friction or bounce changed (by value: the renderer hands new arrays for the same boxes when it measures a piece again, and a new shape wakes the
   * body; the same objects as last time are the same shape, and are not turned into text again: it was a sixth of an update with 200 pieces).
   */
  private reshape(b: PieceBody, link: Link): void {
    const from = this.shapeFrom(b)
    link.shapeFrom = from
    const shapeKey = this.shapeKey(b)
    if (!shapeKey.some((x, i) => x !== link.shapeKey[i])) return
    link.shapeKey = shapeKey
    // the piece's mass and moments go with its new shape: left to the engine, they would be the new shape's volume at 1000 kg/m^3
    const inertia = this.inertiaOf(b)
    this.world.setShape(link.id, this.shapeOf(b), inertia ? { mass: b.mass, inertia } : { mass: b.mass })
    this.world.setMaterial(link.id, this.material(b))
    this.world.setRolling(link.id, this.rollingOf(b))
  }

  /** Whether the objects its shape is made from are the ones it was made from (by reference, as `shapeFrom` lists them). */
  private sameFrom(b: PieceBody, from: readonly unknown[]): boolean {
    return (
      from[0] === b.halfExtents && from[1] === b.partBoxes && from[2] === b.round && from[3] === b.mass && from[4] === b.localCenter[0] && from[5] === b.localCenter[1] &&
      from[6] === b.localCenter[2] && from[7] === b.friction && from[8] === b.restitution
    )
  }

  private shapeFrom(b: PieceBody): unknown[] {
    return [b.halfExtents, b.partBoxes, b.round, b.mass, b.localCenter[0], b.localCenter[1], b.localCenter[2], b.friction, b.restitution]
  }

  private shapeKey(b: PieceBody): unknown[] {
    return [JSON.stringify(b.halfExtents), JSON.stringify(b.partBoxes), JSON.stringify(b.round), b.mass, b.localCenter[0], b.localCenter[1], b.localCenter[2], JSON.stringify(b.friction), b.restitution]
  }

  /**
   * The kit's balancing rule (§12: what stands on less than its centre of mass needs goes over): the points the engine has it touching by are its support; narrower than `NARROW` of the height of the centre of mass above them, or not under it, the piece gets the kit's push toward the side
   * it leans to. The engine alone keeps a door balanced on its 4 cm edge for ever.
   */
  /**
   * The push (rad/s2) that turns a piece about the edge of its support at `edge` (m from its centre, `height` m above it): the kit's `TOPPLE`, and on a support narrow both ways (a leg, a pole: a plate on its
   * edge is narrow one way only) at least what beats gravity's hold (at most `g |edge| / (height^2 + edge^2)` for any shape: a 5 cm leg 74 cm tall held against `TOPPLE` alone and stood for ever). Not where only
   * the contacts of one instant sit off its centre: a box rocking on a table's edge reads like that, and stays.
   */
  private topplePush(edge: number, height: number, isNarrow: boolean): number {
    const push = TOPPLE * Math.min(height, 1)
    return isNarrow ? Math.max(push, (HOLD_MARGIN * this.o.gravity * Math.abs(edge)) / (height * height + edge * edge)) : push
  }

  private topple(b: PieceBody, dt: number): void {
    const link = this.links.get(b)
    if (!link) return
    // where the engine has it touching (the floor, a step, another piece), from its centre of mass
    const n = this.world.contactPoints(link.id, this.contactXYZ)
    if (n === 0) {
      this.slip(b, link, false)
      return
    }
    const c = this.centre(b)
    const q = b.root.quaternion
    let low = Infinity
    for (let i = 0; i < n; i++) low = Math.min(low, this.contactXYZ[i * 3 + 1] - c.y)
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (let i = 0; i < n; i++) {
      const rx = this.contactXYZ[i * 3] - c.x
      const rz = this.contactXYZ[i * 3 + 2] - c.z
      x0 = Math.min(x0, rx); x1 = Math.max(x1, rx)
      z0 = Math.min(z0, rz); z1 = Math.max(z1, rz)
    }
    const height = -low
    const wx = x1 - x0
    const wz = z1 - z0
    const isNarrow = Math.min(wx, wz) < NARROW * height
    const isColumn = Math.max(wx, wz) < NARROW * height
    b.balancing = isNarrow || x0 > 0 || x1 < 0 || z0 > 0 || z1 < 0
    // held up at an angle by something (leant on a wall, on another piece): once it has kept its tilt for `STEADY_SECONDS` the push stops and it may sleep. The
    // tilt is timed whether or not this update's contact points read as balancing: they come and go between the engine's steps at rest, and a timer started
    // again on each flicker kept a leaning plate pushed, and awake, for good
    const was = b.steady
    if (!was || Math.abs(was.quaternion[0] * q.x + was.quaternion[1] * q.y + was.quaternion[2] * q.z + was.quaternion[3] * q.w) < Math.cos(STEADY_TURN / 2)) {
      b.steady = { quaternion: [q.x, q.y, q.z, q.w], seconds: 0 }
    } else was.seconds += dt
    const held = b.steady?.seconds ?? 0
    this.slip(b, link, isNarrow && held >= PROPPED_SECONDS)
    if (!b.balancing || held >= STEADY_SECONDS) return
    if (Math.abs(x0 + x1) > SIDE_DEAD) link.side[0] = x0 + x1 > 0 ? -1 : 1
    if (Math.abs(z0 + z1) > SIDE_DEAD) link.side[1] = z0 + z1 > 0 ? -1 : 1
    const [dirX, dirZ] = link.side
    const w = b.angularVelocity
    const v = b.velocity
    // turned about the edge of its support it goes over (about its centre of mass it would press that edge into the floor, and the contact would take it back):
    // the spin, and the speed of the centre of mass that goes with it about that edge. Only while the centre is still over the edge it turns about: once past it,
    // gravity takes it over; pushed on through the fall, a 3 kg sheet 5 m wide was driven down faster than it falls (4 cm of energy made in the room)
    if (wx <= wz) {
      const edge = dirX > 0 ? x1 : x0
      const dw = edge * dirX > 0 ? -dirX * this.topplePush(edge, height, isColumn && Math.abs(w[2]!) < PUSH_SPIN) * dt : 0
      const rx = -edge
      const ry = -low
      w[2] += dw
      v[0] += -dw * ry
      v[1] += dw * rx
    } else {
      const edge = dirZ > 0 ? z1 : z0
      const dw = edge * dirZ > 0 ? dirZ * this.topplePush(edge, height, isColumn && Math.abs(w[0]!) < PUSH_SPIN) * dt : 0
      const rz = -edge
      const ry = -low
      w[0] += dw
      v[1] += -dw * rz
      v[2] += dw * ry
    }
  }

  /** Propped pieces lose most of their friction until they move or sleep (the push only presses them into the prop: an energy-free way to end a wedge). */
  private slip(b: PieceBody, link: Link, isSlipping: boolean): void {
    if (link.isSlipping === isSlipping) return
    link.isSlipping = isSlipping
    const m = this.material(b)
    this.world.setMaterial(link.id, isSlipping ? { ...m, frictionStatic: m.frictionStatic * PROPPED_GRIP, frictionDynamic: m.frictionDynamic * PROPPED_GRIP } : m)
  }

  private centre(b: PieceBody): THREE_NS.Vector3 {
    return this.v.copy(b.centerV).applyQuaternion(b.root.quaternion).add(b.root.position)
  }

  /**
   * Lays the tiles of ground under and around what is awake, and lays again those whose region changed (only if their ground did change). "Around" is the piece's own footprint
   * (its box as it stands now, seen from above) plus `TILE_MARGIN` and how far its tips swing in this update (up to `MAX_SWING`): a 45 m wire that fell lies on 23 tiles, not under the 625 of the
   * circle around it (a 480 ms update in the room).
   */
  private layGround(list: readonly PieceBody[], dt: number): void {
    for (const b of list) {
      if (b.sleeping) continue
      const c = this.centre(b)
      const reach = Math.hypot(b.halfExtents[0], b.halfExtents[1], b.halfExtents[2])
      const swing = Math.hypot(b.angularVelocity[0] as number, b.angularVelocity[1] as number, b.angularVelocity[2] as number) * reach * Math.max(dt, 1 / 60)
      // a 45 m wire the blast spun to 47 rad/s swings 53 m a frame: the circle around it was 4290 tiles (2.4 s), and it is 4 m up; past a few metres the next update lays what it reached
      const margin = TILE_MARGIN + Math.min(swing, MAX_SWING)
      // a fast one (a blast's chip) moves further than the margin in an update, and would land on ground not laid yet: the tiles are laid along its path too, a tile apart
      const travel = Math.hypot(b.velocity[0] as number, b.velocity[1] as number, b.velocity[2] as number) * dt
      const stops = travel > TILE_MARGIN ? Math.min(MAX_PATH_STOPS, Math.ceil(travel / TILE)) : 0
      const x0 = c.x, y0 = c.y, z0 = c.z
      for (let stop = 0; stop <= stops; stop++) {
        const fraction = stops === 0 ? 0 : stop / stops
        const at = stop === 0 ? c : this.u.set(x0 + (b.velocity[0] as number) * dt * fraction, y0, z0 + (b.velocity[2] as number) * dt * fraction)
        this.layAround(this.footprint(b, at), margin)
      }
    }
  }

  /** The tiles within `margin` of the footprint are laid, or laid again when their ground changed. */
  private layAround(foot: Footprint, margin: number): void {
    for (let ix = Math.floor((foot.minX - margin) / TILE); ix <= Math.floor((foot.maxX + margin) / TILE); ix++) {
      for (let iz = Math.floor((foot.minZ - margin) / TILE); iz <= Math.floor((foot.maxZ + margin) / TILE); iz++) {
        const key = (ix + TILE_KEY_ORIGIN) * TILE_KEY + (iz + TILE_KEY_ORIGIN)
        const tile = this.tiles.get(key)
        if (tile && !tile.dirty) continue
        if (!this.footprintReaches(foot, ix * TILE, iz * TILE, margin)) continue
        this.layTile(key, ix, iz, tile)
      }
    }
  }

  /** The piece's box seen from above: its 8 corners in x and z, the box around them, and the directions its edges run (the axes that tell a tile apart from it). */
  private footprint(b: PieceBody, c: THREE_NS.Vector3): Footprint {
    const q = b.root.quaternion
    const h = b.halfExtents
    const out = this.footprintOut
    let k = 0
    out.minX = out.minZ = Infinity
    out.maxX = out.maxZ = -Infinity
    for (let corner = 0; corner < 8; corner++) {
      this.w.set(corner & 1 ? h[0] : -h[0], corner & 2 ? h[1] : -h[1], corner & 4 ? h[2] : -h[2]).applyQuaternion(q)
      const x = c.x + this.w.x
      const z = c.z + this.w.z
      out.corners[k++] = x
      out.corners[k++] = z
      out.minX = Math.min(out.minX, x)
      out.maxX = Math.max(out.maxX, x)
      out.minZ = Math.min(out.minZ, z)
      out.maxZ = Math.max(out.maxZ, z)
    }
    // the three box axes seen from above: a tile and the footprint are apart when a gap shows along the x axis, the z axis or the normal of one of these
    for (let axis = 0; axis < 3; axis++) {
      this.w.set(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0).applyQuaternion(q)
      const length = Math.hypot(this.w.x, this.w.z)
      out.normals[axis * 2] = length > 1e-6 ? -this.w.z / length : 0
      out.normals[axis * 2 + 1] = length > 1e-6 ? this.w.x / length : 0
    }
    return out
  }

  /** Whether the tile at (x0, z0) is within `margin` of the footprint (a gap wider than that along any axis rules it out; narrower, it is laid). */
  private footprintReaches(foot: Footprint, x0: number, z0: number, margin: number): boolean {
    const gap = (nx: number, nz: number): number => {
      if (nx === 0 && nz === 0) return 0
      let low = Infinity, high = -Infinity
      for (let i = 0; i < 16; i += 2) {
        const p = foot.corners[i]! * nx + foot.corners[i + 1]! * nz
        low = Math.min(low, p)
        high = Math.max(high, p)
      }
      let tileLow = Infinity, tileHigh = -Infinity
      for (let i = 0; i < 4; i++) {
        const p = (x0 + (i & 1 ? TILE : 0)) * nx + (z0 + (i & 2 ? TILE : 0)) * nz
        tileLow = Math.min(tileLow, p)
        tileHigh = Math.max(tileHigh, p)
      }
      return Math.max(tileLow - high, low - tileHigh)
    }
    if (gap(1, 0) > margin || gap(0, 1) > margin) return false
    for (let axis = 0; axis < 3; axis++) if (gap(foot.normals[axis * 2]!, foot.normals[axis * 2 + 1]!) > margin) return false
    return true
  }

  /**
   * A tile of ground, made or brought up to date on the same bodies: the height field is swapped in place (`setShape` keeps the body's id, so the engine still
   * warm-starts the contacts of what lies on it), the slab moved, the step boxes made again only when they changed. Unchanged ground is left alone.
   */
  private layTile(key: number, ix: number, iz: number, tile: Tile | undefined): void {
    const t = buildGroundTile(this.o.groundAt, ix * TILE, iz * TILE, TILE)
    if (tile && sameGround(tile.samples, t.samples)) {
      tile.dirty = false
      return
    }
    const slab = t.level !== null
    let ground: BodyId
    if (tile && tile.slab === slab) {
      ground = tile.ground
      if (slab) this.world.setPose(ground, [(ix + 0.5) * TILE, (t.level ?? 0) - 0.5, (iz + 0.5) * TILE], [0, 0, 0, 1], false)
      else this.world.setShape(ground, this.heightField(t, ix, iz))
    } else {
      if (tile) this.world.removeBody(tile.ground)
      ground = slab
        ? this.world.createBody({ shape: { kind: 'box', half: [TILE / 2, 0.5, TILE / 2] }, motion: 'static', position: [(ix + 0.5) * TILE, (t.level ?? 0) - 0.5, (iz + 0.5) * TILE], material: GROUND, user: 0 })
        : this.world.createBody({ shape: this.heightField(t, ix, iz), motion: 'static', position: [0, 0, 0], material: GROUND, user: 0 })
    }
    let steps = tile?.steps ?? null
    const same = tile !== undefined && tile.boxes.length === t.boxes.length && tile.boxes.every((x, i) => x === t.boxes[i])
    if (!same) {
      if (steps !== null) this.world.removeBody(steps)
      steps = t.boxes.length === 0 ? null : this.world.createBody({ shape: this.stepBoxes(t.boxes), motion: 'static', position: [0, 0, 0], material: GROUND, user: 0 })
    }
    this.tiles.set(key, { ground, slab, steps, boxes: t.boxes, solid: this.layVolume(t, tile), volume: t.solid, samples: t.samples, dirty: false })
  }

  /** The solid under a height field, on its own body, swapped in place when the ground changed; none under a slab. */
  private layVolume(t: GroundTile, tile: Tile | undefined): BodyId | null {
    const id = tile?.solid ?? null
    if (t.level !== null) {
      if (id !== null) this.world.removeBody(id)
      return null
    }
    if (id === null) return this.world.createBody({ shape: this.solidShape(t.solid), motion: 'static', position: [0, 0, 0], material: GROUND, user: 0 })
    if (tile && !sameSolid(tile.volume, t.solid)) this.world.setShape(id, this.solidShape(t.solid))
    return id
  }

  private solidShape(solid: SolidVolume): ShapeDesc {
    const children: Array<{ shape: ShapeDesc; position: Vec3 }> = []
    const { boxes, prisms } = solid
    for (let i = 0; i < boxes.length; i += 6) children.push({ shape: { kind: 'box', half: [boxes[i + 3]!, boxes[i + 4]!, boxes[i + 5]!] }, position: [boxes[i]!, boxes[i + 1]!, boxes[i + 2]!] })
    for (let i = 0; i < prisms.length; i += 24) {
      // about the block's own centre, so the hull's points stay small numbers
      const cx = (prisms[i]! + prisms[i + 3]!) / 2, cy = prisms[i + 13]!, cz = (prisms[i + 2]! + prisms[i + 8]!) / 2
      const points: number[] = []
      for (let k = 0; k < 24; k += 3) points.push(prisms[i + k]! - cx, prisms[i + k + 1]! - cy, prisms[i + k + 2]! - cz)
      children.push({ shape: { kind: 'convex', points }, position: [cx, cy, cz] })
    }
    return { kind: 'compound', children }
  }

  private heightField(t: GroundTile, ix: number, iz: number): ShapeDesc {
    return { kind: 'heightfield', origin: [ix * TILE, 0, iz * TILE], cell: TILE / t.cells, size: t.cells + 1, heights: t.heights }
  }

  private stepBoxes(boxes: readonly number[]): ShapeDesc {
    const children: Array<{ shape: ShapeDesc; position: Vec3 }> = []
    for (let i = 0; i < boxes.length; i += 6) children.push({ shape: { kind: 'box', half: [boxes[i + 3], boxes[i + 4], boxes[i + 5]] }, position: [boxes[i], boxes[i + 1], boxes[i + 2]] })
    return { kind: 'compound', children }
  }

  /** The host's fixed boxes, one static body per object (`EngineStatics`). */
  private layStatics(): void {
    const now = this.o.staticSolids?.()
    if (now) this.statics.lay(now)
  }

  private keepApart(apart: ReadonlySet<string>): void {
    for (const key of this.ignored) {
      if (apart.has(key)) continue
      this.ignored.delete(key)
      this.ignore(key, false)
    }
    for (const key of apart) {
      if (this.ignored.has(key)) continue
      this.ignored.add(key)
      this.ignore(key, true)
    }
  }

  /** The engine leaves the pair (`a\0b` by object id) alone, or meets it again. */
  private ignore(key: string, ignore: boolean): void {
    const cut = key.indexOf('\u0000')
    const a = this.byObject.get(key.slice(0, cut))
    const b = this.byObject.get(key.slice(cut + 1))
    const x = a && this.links.get(a)
    const y = b && this.links.get(b)
    if (x && y) this.world.ignorePair(x.id, y.id, ignore)
  }

  /** Writes the body back to the piece, then the kit's rules: the sweep against walls, hard landings, `still` for the budget. */
  private readBack(b: PieceBody, dt: number, time: number): void {
    const link = this.links.get(b)
    if (!link || b.held) return
    // asleep on both sides since the last update: the engine has not moved it, there is nothing to read
    if (link.sleeping && b.sleeping && this.world.isSleeping(link.id)) {
      b.still = 0
      return
    }
    this.world.readPose(link.id, this.pose, 0)
    this.world.readVelocity(link.id, this.velocity, 0)
    const pos = this.readPos
    pos[0] = this.pose[0]
    pos[1] = this.pose[1]
    pos[2] = this.pose[2]
    const v = b.velocity
    const w = b.angularVelocity
    for (let i = 0; i < 3; i++) {
      v[i] = this.velocity[i]
      w[i] = this.velocity[i + 3]
    }
    b.sleeping = this.world.isSleeping(link.id)
    if (!b.sleeping) b.onGround = this.world.touching(link.id)
    // the tilt it kept while asleep says nothing of the new fall, and what it stands on is judged now: the budget put a board back to sleep in the frame its step went
    if (link.sleeping && !b.sleeping) {
      b.steady = undefined
      if (b.onGround && !b.round) this.topple(b, 0)
    }
    let moved = false
    const reach = Math.hypot(b.halfExtents[0], b.halfExtents[1], b.halfExtents[2])
    const floor = this.o.groundAt(pos[0], pos[2])
    if (pos[1] + reach < floor - 0.05) {
      this.fellThrough++
      pos[1] = floor + reach
      v[1] = Math.max(0, v[1])
      moved = true
    }
    if (link.stepped && !b.sleeping) {
      if (this.o.sweep) moved = this.sweepOn(b, link.before, pos, time)
      const impact = -link.beforeVy
      if (b.onGround && impact > HARD_LANDING && v[1] > link.beforeVy + impact * 0.5 && time - b.lastHit > 0.15) {
        b.lastHit = time
        this.o.onHardLanding(b, [pos[0], pos[1] - Math.min(...b.halfExtents), pos[2]], impact)
      }
    }
    b.root.quaternion.set(this.pose[3], this.pose[4], this.pose[5], this.pose[6])
    const off = this.v.copy(b.centerV).applyQuaternion(b.root.quaternion)
    b.root.position.set(pos[0] - off.x, pos[1] - off.y, pos[2] - off.z)
    b.root.updateMatrixWorld(true)
    if (!b.sleeping) {
      const still = b.onGround && !b.tipping && Math.hypot(v[0], v[1], v[2]) < STILL_SPEED && Math.hypot(w[0], w[1], w[2]) < STILL_SPIN
      b.still = still ? b.still + dt : 0
    } else {
      b.still = 0
    }
    // only what the kit changed goes back: writing the pose wakes the body and starts its sleep timer again
    if (moved) this.world.setPose(link.id, pos, [this.pose[3], this.pose[4], this.pose[5], this.pose[6]], true)
    if (moved) this.world.setVelocity(link.id, [v[0], v[1], v[2]], [w[0], w[1], w[2]])
    // what is written back is what the next update compares against: a change from outside differs from it
    link.pos[0] = pos[0]
    link.pos[1] = pos[1]
    link.pos[2] = pos[2]
    const q = b.root.quaternion
    link.quat[0] = q.x
    link.quat[1] = q.y
    link.quat[2] = q.z
    link.quat[3] = q.w
    for (let i = 0; i < 3; i++) {
      link.vel[i] = v[i]
      link.ang[i] = w[i]
    }
    if (b.sleeping && !link.sleeping) {
      const c = this.centre(b)
      link.groundAtSleep = this.o.groundAt(c.x, c.z)
    }
    link.sleeping = b.sleeping
  }

  /**
   * A piece that ran into a wall on its way (`sweep`). Into what the engine has as a body (a fixed thing's drawn boxes, another piece) the engine already met it, so
   * the sweep only tells the blow (`onSlam`): setting it back there as well put a door sliding down a table edge back up every update, for good, and threw pieces
   * off a wall the engine was already holding them against. Into what the engine does not have (a wall left out of `staticSolids`), the kit's rule as before:
   * back to where it met it, the speed into it reflected.
   */
  private sweepOn(b: PieceBody, start: Vec3, pos: Vec3, time: number): boolean {
    const travel = Math.hypot(pos[0] - start[0], pos[1] - start[1], pos[2] - start[2])
    if (travel < 1e-3) return false
    const hit = this.o.sweep?.(b, start, pos)
    if (!hit || hit.normal[1] > SLAM_FLOOR_NORMAL) return false
    const v = b.velocity
    const n = hit.normal
    const into = -(v[0] * n[0] + v[1] * n[1] + v[2] * n[2])
    if (into <= 0) return false
    const engineHas = this.byObject.has(hit.object) || this.statics.has(hit.object)
    if (!engineHas) {
      const k = Math.min(1, hit.distance / travel)
      // below the engine's restitution threshold the speed into it is only taken away: reflected, a door pressed into a parked car (which the engine does not
      // have) by its own weight was sent back off it every update and never slept
      const bounce = into >= BOUNCE_SPEED ? Math.sqrt((b.restitution ?? SLAM_BOUNCE) * (hit.restitution ?? SLAM_BOUNCE)) : 0
      // up to where it met it, then the rest of the way along it: only the part into it is taken out (set back the whole way, a door sliding down a parked car
      // was put back up on every update)
      const rest = [0, 1, 2].map((i) => (pos[i] - start[i]) * (1 - k))
      const restInto = Math.min(0, rest[0] * n[0] + rest[1] * n[1] + rest[2] * n[2])
      for (let i = 0; i < 3; i++) {
        pos[i] = start[i] + (pos[i] - start[i]) * k + rest[i] - restInto * n[i]
        v[i] += (1 + bounce) * into * n[i]
      }
      for (let i = 0; i < 3; i++) b.angularVelocity[i] *= 0.5
    }
    if (into >= SLAM_MIN_SPEED && time - b.lastHit > 0.15) {
      b.lastHit = time
      this.o.onSlam?.(b, hit, into)
    }
    return !engineHas
  }

  /** Two pieces that hit each other hard enough sound (`onKnock`), from the engine's contact rows, once per pair per `KNOCK_EVERY`. */
  private knock(time: number): void {
    const on = this.o.onKnock
    if (!on) return
    const c = this.world.contacts
    for (let i = 0; i < c.count; i++) {
      if (c.approach[i] < SLAM_MIN_SPEED) continue
      const a = this.byUser.get(c.userA[i])
      const b = this.byUser.get(c.userB[i])
      if (!a || !b) continue
      const key = a.objectId < b.objectId ? `${a.objectId}\u0000${b.objectId}` : `${b.objectId}\u0000${a.objectId}`
      if (time - (this.knocks.get(key) ?? -Infinity) < KNOCK_EVERY) continue
      this.knocks.set(key, time)
      on(a, b, [c.point[i * 3], c.point[i * 3 + 1], c.point[i * 3 + 2]], c.approach[i])
    }
  }
}
