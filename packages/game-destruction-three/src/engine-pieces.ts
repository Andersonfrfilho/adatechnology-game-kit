import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'
import type { BodyId, Material, PhysicsWorld, Quat, Rolling, ShapeDesc } from '@adatechnology/game-physics'

import { buildGroundTile, sameGround } from './engine-ground'
import type { GroundTile } from './engine-ground'
import type { PieceBody } from './internal'
import type { PieceSweepHit } from './pieces'

/** A fixed box of what does not move, as it is drawn: centre, half sizes and rotation (world). */
export interface StaticSolid {
  readonly center: Vec3
  readonly half: Vec3
  readonly rotation: Quat
}

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

/** Side of a tile of ground (m); how far around an awake piece tiles are laid (m). */
const TILE = 2
const TILE_MARGIN = 0.5
const MU_STATIC = 0.7
const MU_DYNAMIC = 0.6
const GROUND: Material = { frictionStatic: MU_STATIC, frictionDynamic: MU_DYNAMIC, restitution: 0 }
const ROLLING_RESISTANCE = 0.015
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
const TOPPLE = 3
/** Corners this close (m) to the lowest one are what it stands on. */
const STEADY_TURN = 0.1
const STEADY_SECONDS = 1.5
/** How far (m) a new piece may reach into the ground and be left to the engine's contact (over its slop, under a thin plate's half), and how far above it one lifted is put. */
const SINK = 0.005
const LIFT_MARGIN = 0.001

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
}

interface Tile {
  /** The ground body: a slab when the tile is level, else a height field; kept across changes so what lies on it keeps its contacts. */
  ground: BodyId
  slab: boolean
  /** The step boxes' body, if the tile has steps, and the boxes it was made from. */
  steps: BodyId | null
  boxes: readonly number[]
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
  private turn = 0
  /**
   * Pieces found wholly under the ground after a step (through a one-sided ground triangle: the engine has no solid below it) and put back on it: the invariant
   * of §12 (nothing goes under the floor), counted so a test or the room log can fail on it. A net, not a cure: none in a healthy run.
   */
  fellThrough = 0
  private readonly tiles = new Map<string, Tile>()
  private readonly statics = new Map<string, { solids: readonly StaticSolid[]; id: BodyId | null }>()
  private ignored = new Set<string>()
  private readonly knocks = new Map<string, number>()
  private readonly pose = new Float64Array(7)
  private readonly velocity = new Float64Array(6)
  private readonly contactXYZ = new Float32Array(48)
  private readonly v: THREE_NS.Vector3
  private readonly u: THREE_NS.Vector3

  constructor(
    THREE: typeof THREE_NS,
    private readonly world: PhysicsWorld,
    private readonly o: EnginePieceOptions,
  ) {
    this.v = new THREE.Vector3()
    this.u = new THREE.Vector3()
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
    }
    this.tiles.clear()
    for (const s of this.statics.values()) if (s.id !== null) this.world.removeBody(s.id)
    this.statics.clear()
    this.ignored.clear()
  }

  /** The ground under the disc changed: its tiles are laid again before the next step, and what lies there wakes. */
  groundChanged(x: number, z: number, radius: number): void {
    for (const [key, tile] of this.tiles) {
      const [ix, iz] = key.split(',').map(Number)
      const nx = Math.max(ix * TILE, Math.min(x, (ix + 1) * TILE))
      const nz = Math.max(iz * TILE, Math.min(z, (iz + 1) * TILE))
      if (Math.hypot(nx - x, nz - z) <= radius) tile.dirty = true
    }
  }

  /** One update: the pairs in `apart` (by object id, `a\0b`) do not meet in the engine; the kit puts them apart along the ground. */
  update(list: readonly PieceBody[], dt: number, time: number, apart: ReadonlySet<string>): void {
    if (dt <= 0) return
    const present = new Set(list)
    for (const b of [...this.links.keys()]) if (!present.has(b)) this.remove(b)
    this.groundTurn(list)
    for (const b of list) this.sync(b, dt)
    this.layStatics()
    this.layGround(list)
    this.keepApart(apart)
    const before = new Map<PieceBody, { c: Vec3; vy: number }>()
    for (const b of list) {
      if (b.held || b.sleeping) continue
      const c = this.centre(b)
      before.set(b, { c: [c.x, c.y, c.z], vy: b.velocity[1] })
    }
    this.world.step(dt)
    for (const b of list) this.readBack(b, dt, time, before.get(b))
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
      if (this.o.groundAt(c.x, c.z) >= link.groundAtSleep - GROUND_DROP) continue
      b.sleeping = false
      b.still = 0
      this.groundChanged(c.x, c.z, Math.hypot(...b.halfExtents))
    }
  }

  private shapeOf(b: PieceBody): ShapeDesc {
    const round = b.round
    if (round) {
      if (round.kind === 'sphere') return { kind: 'sphere', radius: round.radius }
      // a cylinder stands along its own y: turned onto x or z
      const rotation: Quat = round.axis === 0 ? [0, 0, Math.SQRT1_2, Math.SQRT1_2] : round.axis === 2 ? [Math.SQRT1_2, 0, 0, Math.SQRT1_2] : [0, 0, 0, 1]
      return { kind: 'compound', children: [{ shape: { kind: 'cylinder', halfHeight: b.halfExtents[round.axis], radius: round.radius }, position: [0, 0, 0], rotation }] }
    }
    if (b.partBoxes && b.partBoxes.length > 0) {
      return { kind: 'compound', children: b.partBoxes.map((part, i) => ({ shape: { kind: 'box', half: part.half }, position: part.center, tag: i })) }
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
    const boxes = b.partBoxes && b.partBoxes.length > 0 ? b.partBoxes : [{ center: [0, 0, 0] as Vec3, half: b.halfExtents }]
    for (const box of boxes) {
      for (let k = 0; k < 8; k++) at(box.center[0] + (k & 1 ? 1 : -1) * box.half[0], box.center[1] + (k & 2 ? 1 : -1) * box.half[1], box.center[2] + (k & 4 ? 1 : -1) * box.half[2])
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
    }
  }

  /** Makes the body of a piece, or brings it up to date with what changed on the piece since the last step (moved, pushed, picked up, put to sleep). */
  private sync(b: PieceBody, dt: number): void {
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
      link = { id, groundAtSleep: NaN, user, shapeKey: this.shapeKey(b), shapeFrom: this.shapeFrom(b), pos: [c.x, c.y, c.z], quat: [q.x, q.y, q.z, q.w], vel: [...b.velocity], ang: [...b.angularVelocity], held: b.held, sleeping: b.sleeping }
      this.links.set(b, link)
      this.byUser.set(user, b)
      this.byObject.set(b.objectId, b)
      return
    }
    // by value: the renderer hands new arrays for the same boxes when it measures a piece again, and a new shape wakes the body; the same objects as last time
    // are the same shape, and are not turned into text again (it was a sixth of an update with 200 pieces)
    const from = this.shapeFrom(b)
    const shapeKey = from.some((x, i) => x !== link.shapeFrom[i]) ? this.shapeKey(b) : link.shapeKey
    link.shapeFrom = from
    if (shapeKey.some((s, i) => s !== link.shapeKey[i])) {
      link.shapeKey = shapeKey
      // the piece's mass and moments go with its new shape: left to the engine, they would be the new shape's volume at 1000 kg/m^3
      const inertia = this.inertiaOf(b)
      this.world.setShape(link.id, this.shapeOf(b), inertia ? { mass: b.mass, inertia } : { mass: b.mass })
      this.world.setMaterial(link.id, this.material(b))
      this.world.setRolling(link.id, this.rollingOf(b))
    }
    if (b.held !== link.held) {
      link.held = b.held
      this.world.setMotion(link.id, b.held ? 'kinematic' : 'dynamic')
    }
    if (b.held) {
      this.world.moveKinematic(link.id, [c.x, c.y, c.z], [q.x, q.y, q.z, q.w], dt)
      return
    }
    // the centre comes back through the root (position minus the turned centre, then plus it again): equal within rounding is not moved
    const far = (a: number, b: number): boolean => Math.abs(a - b) > 1e-6
    const moved = far(c.x, link.pos[0]) || far(c.y, link.pos[1]) || far(c.z, link.pos[2]) || far(q.x, link.quat[0]) || far(q.y, link.quat[1]) || far(q.z, link.quat[2]) || far(q.w, link.quat[3])
    if (moved) this.world.setPose(link.id, [c.x, c.y, c.z], [q.x, q.y, q.z, q.w], !b.sleeping)
    // `tip` is the kit solver's push for a piece whose feet are thinner than its box; here the engine stands it on its parts as drawn, so it goes over by itself
    b.tipping = null
    if (!b.round && b.onGround && !b.sleeping) this.topple(b, dt)
    const v = b.velocity
    const w = b.angularVelocity
    const pushed = v[0] !== link.vel[0] || v[1] !== link.vel[1] || v[2] !== link.vel[2] || w[0] !== link.ang[0] || w[1] !== link.ang[1] || w[2] !== link.ang[2]
    if (pushed) this.world.setVelocity(link.id, [v[0], v[1], v[2]], [w[0], w[1], w[2]])
    if (b.sleeping && !link.sleeping) this.world.sleep(link.id)
    else if (!b.sleeping && link.sleeping) {
      // woken from outside (its support looked at again, a blow): the ground under it may have been dug while it slept
      this.world.wake(link.id)
      this.groundChanged(c.x, c.z, Math.hypot(...b.halfExtents))
    } else if (pushed) this.world.wake(link.id)
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
  private topple(b: PieceBody, dt: number): void {
    const link = this.links.get(b)
    if (!link) return
    // where the engine has it touching (the floor, a step, another piece), from its centre of mass
    const n = this.world.contactPoints(link.id, this.contactXYZ)
    if (n === 0) return
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
    b.balancing = Math.min(wx, wz) < NARROW * height || x0 > 0 || x1 < 0 || z0 > 0 || z1 < 0
    // held up at an angle by something (leant on a wall, on another piece): once it has kept its tilt for `STEADY_SECONDS` the push stops and it may sleep. The
    // tilt is timed whether or not this update's contact points read as balancing: they come and go between the engine's steps at rest, and a timer started
    // again on each flicker kept a leaning plate pushed, and awake, for good
    const was = b.steady
    if (!was || Math.abs(was.quaternion[0] * q.x + was.quaternion[1] * q.y + was.quaternion[2] * q.z + was.quaternion[3] * q.w) < Math.cos(STEADY_TURN / 2)) {
      b.steady = { quaternion: [q.x, q.y, q.z, q.w], seconds: 0 }
    } else was.seconds += dt
    if (!b.balancing || (b.steady?.seconds ?? 0) >= STEADY_SECONDS) return
    const dirX = x0 + x1 > 0 ? -1 : 1
    const dirZ = z0 + z1 > 0 ? -1 : 1
    const k = TOPPLE * Math.min(height, 1) * dt
    const w = b.angularVelocity
    const v = b.velocity
    // turned about the edge of its support it goes over (about its centre of mass it would press that edge into the floor, and the contact would take it back):
    // the spin, and the speed of the centre of mass that goes with it about that edge. Only while the centre is still over the edge it turns about: once past it,
    // gravity takes it over; pushed on through the fall, a 3 kg sheet 5 m wide was driven down faster than it falls (4 cm of energy made in the room)
    if (wx <= wz) {
      const edge = dirX > 0 ? x1 : x0
      const dw = edge * dirX > 0 ? -dirX * k : 0
      const rx = -edge
      const ry = -low
      w[2] += dw
      v[0] += -dw * ry
      v[1] += dw * rx
    } else {
      const edge = dirZ > 0 ? z1 : z0
      const dw = edge * dirZ > 0 ? dirZ * k : 0
      const rz = -edge
      const ry = -low
      w[0] += dw
      v[1] += -dw * rz
      v[2] += dw * ry
    }
  }

  private centre(b: PieceBody): THREE_NS.Vector3 {
    return this.v.copy(b.centerV).applyQuaternion(b.root.quaternion).add(b.root.position)
  }

  /** Lays the tiles of ground under and around what is awake, and lays again those whose region changed (only if their ground did change). */
  private layGround(list: readonly PieceBody[]): void {
    for (const b of list) {
      if (b.sleeping) continue
      const c = this.centre(b)
      const r = Math.hypot(...b.halfExtents) + TILE_MARGIN
      for (let ix = Math.floor((c.x - r) / TILE); ix <= Math.floor((c.x + r) / TILE); ix++) {
        for (let iz = Math.floor((c.z - r) / TILE); iz <= Math.floor((c.z + r) / TILE); iz++) {
          const key = `${ix},${iz}`
          const tile = this.tiles.get(key)
          if (tile && !tile.dirty) continue
          this.layTile(key, ix, iz, tile)
        }
      }
    }
  }

  /**
   * A tile of ground, made or brought up to date on the same bodies: the height field is swapped in place (`setShape` keeps the body's id, so the engine still
   * warm-starts the contacts of what lies on it), the slab moved, the step boxes made again only when they changed. Unchanged ground is left alone.
   */
  private layTile(key: string, ix: number, iz: number, tile: Tile | undefined): void {
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
    this.tiles.set(key, { ground, slab, steps, boxes: t.boxes, samples: t.samples, dirty: false })
  }

  private heightField(t: GroundTile, ix: number, iz: number): ShapeDesc {
    return { kind: 'heightfield', origin: [ix * TILE, 0, iz * TILE], cell: TILE / t.cells, size: t.cells + 1, heights: t.heights }
  }

  private stepBoxes(boxes: readonly number[]): ShapeDesc {
    const children: Array<{ shape: ShapeDesc; position: Vec3 }> = []
    for (let i = 0; i < boxes.length; i += 6) children.push({ shape: { kind: 'box', half: [boxes[i + 3], boxes[i + 4], boxes[i + 5]] }, position: [boxes[i], boxes[i + 1], boxes[i + 2]] })
    return { kind: 'compound', children }
  }

  /** The host's fixed boxes, one static body per object, made again when the object's boxes changed; what lay on a removed one wakes. */
  private layStatics(): void {
    const now = this.o.staticSolids?.()
    if (!now) return
    for (const [id, s] of this.statics) {
      if (now.get(id) === s.solids) continue
      if (s.id !== null) {
        this.wakeAround(s.solids)
        this.world.removeBody(s.id)
      }
      this.statics.delete(id)
    }
    for (const [id, solids] of now) {
      if (this.statics.has(id)) continue
      const kept = solids.filter((s) => s.half[0] > 0 && s.half[1] > 0 && s.half[2] > 0)
      const body =
        kept.length === 0
          ? null
          : this.world.createBody({
              shape: { kind: 'compound', children: kept.map((s, i) => ({ shape: { kind: 'box', half: s.half }, position: s.center, rotation: s.rotation, tag: i })) },
              motion: 'static',
              position: [0, 0, 0],
              material: GROUND,
              user: 0,
            })
      this.statics.set(id, { solids, id: body })
    }
  }

  private wakeAround(solids: readonly StaticSolid[]): void {
    for (const s of solids) {
      const r = Math.hypot(s.half[0], s.half[1], s.half[2]) + 0.05
      this.world.wakeInBox([s.center[0] - r, s.center[1] - r, s.center[2] - r], [s.center[0] + r, s.center[1] + r, s.center[2] + r])
    }
  }

  private keepApart(apart: ReadonlySet<string>): void {
    const ids = new Map<string, BodyId>()
    for (const [b, link] of this.links) ids.set(b.objectId, link.id)
    const pair = (key: string): [BodyId, BodyId] | null => {
      const [a, b] = key.split('\u0000')
      const x = ids.get(a)
      const y = ids.get(b)
      return x !== undefined && y !== undefined ? [x, y] : null
    }
    for (const key of this.ignored) {
      if (apart.has(key)) continue
      const p = pair(key)
      if (p) this.world.ignorePair(p[0], p[1], false)
    }
    for (const key of apart) {
      if (this.ignored.has(key)) continue
      const p = pair(key)
      if (p) this.world.ignorePair(p[0], p[1], true)
    }
    this.ignored = new Set(apart)
  }

  /** Writes the body back to the piece, then the kit's rules: the sweep against walls, hard landings, `still` for the budget. */
  private readBack(b: PieceBody, dt: number, time: number, before: { c: Vec3; vy: number } | undefined): void {
    const link = this.links.get(b)
    if (!link || b.held) return
    // asleep on both sides since the last update: the engine has not moved it, there is nothing to read
    if (link.sleeping && b.sleeping && this.world.isSleeping(link.id)) {
      b.still = 0
      return
    }
    this.world.readPose(link.id, this.pose, 0)
    this.world.readVelocity(link.id, this.velocity, 0)
    const pos: Vec3 = [this.pose[0], this.pose[1], this.pose[2]]
    const v = b.velocity
    const w = b.angularVelocity
    for (let i = 0; i < 3; i++) {
      v[i] = this.velocity[i]
      w[i] = this.velocity[i + 3]
    }
    b.sleeping = this.world.isSleeping(link.id)
    if (!b.sleeping) b.onGround = this.world.touching(link.id)
    let moved = false
    const reach = Math.hypot(b.halfExtents[0], b.halfExtents[1], b.halfExtents[2])
    const floor = this.o.groundAt(pos[0], pos[2])
    if (pos[1] + reach < floor - 0.05) {
      this.fellThrough++
      pos[1] = floor + reach
      v[1] = Math.max(0, v[1])
      moved = true
    }
    if (before && !b.sleeping) {
      if (this.o.sweep) moved = this.sweepOn(b, before.c, pos, time)
      const impact = -before.vy
      if (b.onGround && impact > HARD_LANDING && v[1] > before.vy + impact * 0.5 && time - b.lastHit > 0.15) {
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
    const engineHas = this.byObject.has(hit.object) || (this.statics.get(hit.object)?.id ?? null) !== null
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
