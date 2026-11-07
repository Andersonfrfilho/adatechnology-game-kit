import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'
import type { PieceBody, PieceFriction } from './internal'
import { clamp } from './math'
import { shapeContact } from './piece-contacts'
import type { ContactShape } from './piece-contacts'

export interface PieceSystemOptions {
  groundAt: (x: number, z: number) => number
  /**
   * The highest top of what does not move (furniture, scenery) under `(x, z)` that a corner at height `y` can land on (at most `step` above it),
   * `-Infinity` when none. The ground and the other pieces are added by the system.
   */
  staticTopAt?: (x: number, z: number, y: number, step: number) => number
  gravity: number
  /** A piece hit the ground faster than 3 m/s (throttled per piece). */
  onHardLanding: (piece: PieceBody, point: Vec3, speed: number) => void
  /** Notified when a piece is about to be removed. */
  scene: THREE_NS.Scene
  /**
   * What a piece moving from `from` to `to` (its centre, world) runs into on the way: a wall, a car, a cupboard (`distance` along the way, the `normal` of what it met).
   * Without it a piece only meets the ground, the tops of fixed things and the other pieces.
   */
  sweep?: (piece: PieceBody, from: Vec3, to: Vec3) => PieceSweepHit | null
  /** A piece ran into something (`sweep`) faster than `SLAM_MIN_SPEED` m/s into it (throttled per piece): for the blow on both and the sound. */
  onSlam?: (piece: PieceBody, hit: PieceSweepHit, speed: number) => void
  /** Two pieces knocked into each other faster than `SLAM_MIN_SPEED` m/s (throttled per pair): for the sound. */
  onKnock?: (a: PieceBody, b: PieceBody, point: Vec3, speed: number) => void
}

/** What a moving piece ran into (`PieceSystemOptions.sweep`). */
export interface PieceSweepHit {
  readonly object: string
  readonly part: string
  /** Metres along the way from the centre where the piece meets it. */
  readonly distance: number
  readonly point: Vec3
  readonly normal: Vec3
  /** Coefficient of restitution of what it met (by its material); mixed with the piece's (geometric mean). */
  readonly restitution?: number
}

/** Slower than this (m/s) into a wall a piece only stops against it: no blow, no sound. */
export const SLAM_MIN_SPEED = 2
/** Share of the speed into a wall a piece keeps, bouncing back, when neither surface says otherwise (`PieceBody.restitution`, `PieceSweepHit.restitution`). */
const SLAM_BOUNCE = 0.2
/** Normals steeper than this (y) are a floor or a top: the support of the pieces answers those, not the sweep. */
const SLAM_FLOOR_NORMAL = 0.7

const SUB_DT = 1 / 120
/** Coulomb friction of a piece when no material says otherwise: what holds it still (static) and what drags it while it slides (dynamic). */
const MU_STATIC = 0.7
const MU_DYNAMIC = 0.6
/** Sliding faster than this (m/s) along the surface, a contact drags with the dynamic friction; slower, it holds with the static one. */
const SLIP_SPEED = 0.02
/** Rolling resistance coefficient of the ground and of a surface that does not say (`PieceFriction.rolling`): a can or a bottle on a hard floor (0.01-0.02). */
const ROLLING_RESISTANCE = 0.015
/** A round piece whose axis leans more than 45 degrees from upright lies on its side (the share of the world's down across its axis). */
const ROUND_LYING = Math.SQRT1_2
const SLEEP_AFTER = 0.5
/**
 * A piece on the ground that neither moves farther than `CALM_DRIFT` (m) nor turns more than `CALM_TURN` (rad) in `CALM_SLEEP_AFTER` seconds sleeps, however
 * its speed flickers: a book propped on another, or trembling where its corners rest on two pieces, stays in place; a fall or a slide leaves the window sooner.
 */
const CALM_DRIFT = 0.01
const CALM_TURN = 0.05
const CALM_SLEEP_AFTER = 1.5
const HARD_LANDING = 3
/** Contact tolerance in metres: corners this close to the ground count as touching, which keeps the contact set (and a resting box) stable. */
const SLOP = 0.002
/** A resting support narrower than this fraction of the centre-of-mass height is a balancing act, not a rest: the piece topples. */
const NARROW = 0.3
/** Angular acceleration (rad/s^2 per metre of height) that pushes a balancing piece off its edge, toward the side its centre of mass leans to. */
const TOPPLE = 3
/** Angular acceleration (rad/s^2) of a piece that falls over (`tip`), beyond what the box of its bounds would allow, and the height of the centre of mass (m) at which it lies. */
const TIP_ACCELERATION = 30
const TIP_LYING = 0.25
const TIP_SECONDS = 3
/** How far (m) above a corner a top may be and still catch it (on top of what the corner falls in one sub-step): higher is beside it, not under it. */
const STEP = 0.03
/** Slots of the warm start: the 8 corners and the points along the 12 edges. */
const WARM_SLOTS = 8 + 12 * 7
/** Passes of the contact solver over the points that touch the ground, each substep. */
const SOLVER_PASSES = 10
/** Restitution of a piece against the side of a step of the ground. */
const SIDE_BOUNCE = 0.1
/**
 * Points along each edge of the box, between its corners (fractions of the half edge), that also touch the ground when the support under the corners is not level
 * (the piece is over a step): the edge of a table under a box's bottom is a support between its corners. On level ground the corners are enough.
 */
const EDGE_POINTS = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]
/** Sleeping pieces whose support is looked at again each update, in turn: what held one up may have broken, fallen over or been carried off. */
const SUPPORT_CHECKS = 16
/** A sleeping piece none of whose lowest points has a support within this many metres under it wakes and falls. */
const SUPPORT_GAP = 0.02
/** A piece moving faster than this (m/s) or turning faster than this (rad/s) wakes what lies asleep on it. */
const WAKE_ABOVE_SPEED = 0.05
const WAKE_ABOVE_SPIN = 0.1
/** Side (m) of the cells of the grid the surfaces are found by (`surfaceGrid`). */
const SURFACE_CELL = 0.5
/** Most cells across one surface goes into; a wider one is looked at for every point (`wideSurfaces`). */
const SURFACE_CELLS_ACROSS = 24
const cellKey = (ix: number, iz: number): number => (ix + 32768) * 65536 + (iz + 32768)
/** Most steps an update is split into while round pieces roll fast (`collisionSteps`). */
const MAX_COLLISION_STEPS = 8
/** Radius (m) a round piece is taken to have at least when the update is split for it (`collisionSteps`): a degenerate one of nothing does not split it without end. */
const MIN_ROUND_RADIUS = 0.005
/** Two pieces closing slower than this (m/s) only stop against each other; faster, they bounce by their restitution. */
const BOUNCE_MIN_SPEED = 0.1
/** A contact normal at least this level (its share along the ground) puts two pieces apart along the ground only. */
const KNOCK_FLAT = 0.5

/** Box of a piece in the world: centre, rotation columns (`Matrix4.elements`) and half extents. */
interface Solid {
  body: PieceBody
  c: Vec3
  e: number[]
  half: Vec3
  /** Radius of the box around its centre: a point farther than it on the ground plane misses it. */
  r: number
}

/** The axis of the box whose face the last `boxTopAt` line left through (its top there): the face a point on that spot stands on. */
let topFace = 1

/** Height where the vertical line through `(x, z)` leaves the top of a box, or -Infinity when it misses the box. */
const boxTopAt = (s: Solid, x: number, z: number): number => {
  const e = s.e
  const dx = x - s.c[0], dz = z - s.c[2]
  let t0 = -Infinity, t1 = Infinity
  for (let k = 0; k < 3; k++) {
    // the line is c + (dx, t, dz) with t the height over the centre; along axis k: p + t d
    const p = e[k * 4] * dx + e[k * 4 + 2] * dz
    const d = e[k * 4 + 1]
    const h = s.half[k]
    if (Math.abs(d) < 1e-9) {
      if (Math.abs(p) > h) return -Infinity
      continue
    }
    let a = (-h - p) / d, b = (h - p) / d
    if (a > b) [a, b] = [b, a]
    t0 = Math.max(t0, a)
    if (b < t1) {
      t1 = b
      topFace = k
    }
    if (t0 > t1) return -Infinity
  }
  return s.c[1] + t1
}

const UP: Vec3 = [0, 1, 0]

/** The outward normal of face `axis` of a box on its upper side: the surface of a tilted table top under a point. */
const faceNormal = (s: Solid, axis: number): Vec3 => {
  const e = s.e
  const sign = e[axis * 4 + 1] < 0 ? -1 : 1
  return [sign * e[axis * 4], sign * e[axis * 4 + 1], sign * e[axis * 4 + 2]]
}

/** The friction of two surfaces against each other: the geometric mean of each one's coefficients. */
const pairFriction = (a: PieceFriction | undefined, b: PieceFriction | null): PieceFriction => ({
  static: Math.sqrt((a?.static ?? MU_STATIC) * (b?.static ?? MU_STATIC)),
  dynamic: Math.sqrt((a?.dynamic ?? MU_DYNAMIC) * (b?.dynamic ?? MU_DYNAMIC)),
  // the softer of the two sets how much a round thing rolling on the other sinks in and is held back
  rolling: Math.max(a?.rolling ?? 0, b?.rolling ?? ROLLING_RESISTANCE),
})

/** The coefficient of restitution of two surfaces against each other: the geometric mean of each one's. */
const pairRestitution = (a: number | undefined, b: number | undefined): number => Math.sqrt((a ?? SLAM_BOUNCE) * (b ?? SLAM_BOUNCE))

/**
 * Light rigid-body physics for loose pieces: gravity, the 8 corners of the local box against the ground with an impulse (restitution, friction,
 * angular response), damping, sleeping, and a gentle horizontal separation between pieces side by side. The ground a corner lands on is the
 * highest of the terrain, the top of any other piece under it and what the host reports as fixed (`staticTopAt`): a falling shelf lands on the books
 * below it, a tipping panel on the chair in front of it. Over a step (a table's edge) points along the box's edges touch too, so the edge holds the box between
 * its corners, and the side of a step of the ground is a wall: a corner that comes at it from the side stops there. The contacts are solved together, warm started.
 * Not a general solver: what lies under a corner holds it, what stands beside it does not.
 */
export class PieceSystem {
  readonly list: PieceBody[] = []
  private time = 0
  private readonly p: THREE_NS.Vector3
  private readonly q: THREE_NS.Quaternion
  private readonly dq: THREE_NS.Quaternion
  private readonly nextQ: THREE_NS.Quaternion
  private readonly m: THREE_NS.Matrix4
  private readonly ax: THREE_NS.Vector3
  private solids: Solid[] = []
  /** The boxes other pieces land on: a piece's own parts when it has them (`partBoxes`), else its box. */
  private surfaces: Solid[] = []
  /** The surfaces by the cells of a grid on the ground (`SURFACE_CELL`) their bounding circle covers: what is under a point is looked for in its cell only. */
  private readonly surfaceGrid = new Map<number, Solid[]>()
  /** The surfaces wider than `SURFACE_CELLS_ACROSS` cells (a slab come down whole): looked at for every point. */
  private readonly wideSurfaces: Solid[] = []
  /** Each piece's box of the step (`solids`), by its body. */
  private readonly solidOf = new Map<PieceBody, Solid>()
  /** Each piece's surfaces of the step (its parts' boxes, or its box), by its body. */
  private readonly surfacesOf = new Map<PieceBody, Solid[]>()
  private supportTurn = 0
  /** The surface normal and the friction of what the last `supportAt` found under the point (the ground and fixed tops are level: up, and no piece). */
  private supportNormal: Vec3 = UP
  private supportFriction: PieceFriction | null = null

  constructor(
    private readonly THREE: typeof THREE_NS,
    private readonly o: PieceSystemOptions,
  ) {
    this.p = new THREE.Vector3()
    this.q = new THREE.Quaternion()
    this.dq = new THREE.Quaternion()
    this.nextQ = new THREE.Quaternion()
    this.m = new THREE.Matrix4()
    this.ax = new THREE.Vector3()
  }

  get(objectId: string): PieceBody | null {
    return this.list.find((b) => b.objectId === objectId) ?? null
  }

  /** Sets a piece falling over, about the world axes x and z (a unit axis): its feet are thinner than the box that stands for it, so the box alone would hold it up. */
  tip(body: PieceBody, x: number, z: number): void {
    body.tipping = { x, z, seconds: TIP_SECONDS }
    body.sleeping = false
  }

  create(objectId: string, root: THREE_NS.Object3D, halfExtents: Vec3, localCenter: THREE_NS.Vector3, mass: number, velocity?: Vec3, angular?: Vec3): PieceBody {
    const existing = this.get(objectId)
    if (existing) {
      existing.root = root
      existing.halfExtents = halfExtents
      existing.mass = mass
      this.setCenter(existing, localCenter)
      if (velocity) existing.velocity = [...velocity]
      existing.sleeping = false
      return existing
    }
    const body: PieceBody = {
      objectId,
      tipping: null,
      root,
      velocity: velocity ? [...velocity] : [0, 0, 0],
      angularVelocity: angular ? [...angular] : [0, 0, 0],
      halfExtents: [Math.max(0.01, halfExtents[0]), Math.max(0.01, halfExtents[1]), Math.max(0.01, halfExtents[2])],
      mass: Math.max(0.05, mass),
      sleeping: false,
      held: false,
      localCenter: [localCenter.x, localCenter.y, localCenter.z],
      centerV: localCenter.clone(),
      still: 0,
      calmAt: null,
      calm: 0,
      lastHit: -1,
      onGround: false,
    }
    this.list.push(body)
    return body
  }

  /** Move the centre of mass (after a part broke off). */
  setCenter(b: PieceBody, c: THREE_NS.Vector3): void {
    b.centerV.copy(c)
    b.localCenter = [c.x, c.y, c.z]
  }

  remove(objectId: string): void {
    const i = this.list.findIndex((b) => b.objectId === objectId)
    if (i < 0) return
    // the boxes of the step forget it too: nothing keeps a removed piece's tree alive
    const [gone] = this.list.splice(i, 1)
    if (gone) this.forgetSolids(gone)
  }

  clear(): void {
    this.list.length = 0
    this.solids = []
    this.surfaces = []
    this.solidOf.clear()
    this.surfacesOf.clear()
    this.surfaceGrid.clear()
    this.wideSurfaces.length = 0
  }

  /** Drops a piece from the boxes of the step (`solids`, `surfaces` and their grid). */
  private forgetSolids(body: PieceBody): void {
    this.solidOf.delete(body)
    this.surfacesOf.delete(body)
    this.solids = this.solids.filter((s) => s.body !== body)
    this.surfaces = this.surfaces.filter((s) => s.body !== body)
    for (const [key, cell] of this.surfaceGrid) {
      const kept = cell.filter((s) => s.body !== body)
      if (kept.length === 0) this.surfaceGrid.delete(key)
      else if (kept.length !== cell.length) this.surfaceGrid.set(key, kept)
    }
    const wide = this.wideSurfaces.filter((s) => s.body !== body)
    this.wideSurfaces.length = 0
    this.wideSurfaces.push(...wide)
  }

  /** `clear` and the clock back to 0. */
  reset(): void {
    this.clear()
    this.time = 0
  }

  /** World position of the centre of mass. */
  centerOf(b: PieceBody, out: THREE_NS.Vector3): THREE_NS.Vector3 {
    return out.copy(b.centerV).applyQuaternion(b.root.quaternion).add(b.root.position)
  }

  impulse(b: PieceBody, impulse: Vec3, point?: Vec3): void {
    const inv = 1 / b.mass
    b.velocity[0] += impulse[0] * inv
    b.velocity[1] += impulse[1] * inv
    b.velocity[2] += impulse[2] * inv
    if (point) {
      const c = this.centerOf(b, this.p)
      const rx = point[0] - c.x
      const ry = point[1] - c.y
      const rz = point[2] - c.z
      // torque = r x J, angular velocity change = I^-1 torque
      const tx = ry * impulse[2] - rz * impulse[1]
      const ty = rz * impulse[0] - rx * impulse[2]
      const tz = rx * impulse[1] - ry * impulse[0]
      const w = this.mulInvInertia(b, tx, ty, tz)
      b.angularVelocity[0] += w[0]
      b.angularVelocity[1] += w[1]
      b.angularVelocity[2] += w[2]
    }
    b.sleeping = false
    b.still = 0
    b.calmAt = null
  }

  /** I^-1 * (x, y, z) in world space for a box with the body's half extents and mass (needs `this.m` to hold the body's rotation). */
  private mulInvInertia(b: PieceBody, x: number, y: number, z: number): Vec3 {
    this.m.makeRotationFromQuaternion(b.root.quaternion)
    return this.mulInvInertiaWith(b, this.m.elements, x, y, z)
  }

  private mulInvInertiaWith(b: PieceBody, e: ArrayLike<number>, x: number, y: number, z: number): Vec3 {
    const [hx, hy, hz] = b.halfExtents
    const k = 3 / b.mass
    let ix = k / (hy * hy + hz * hz)
    let iy = k / (hx * hx + hz * hz)
    let iz = k / (hx * hx + hy * hy)
    const round = b.round
    if (round) {
      // about the axis it rolls on, a round piece has I = k m r^2: a full can is a solid cylinder (k 0.5), an empty one a thin shell (k 1)
      const about = 1 / (round.inertia * b.mass * round.radius * round.radius)
      if (round.kind === 'sphere') ix = iy = iz = about
      else if (round.axis === 0) ix = about
      else if (round.axis === 1) iy = about
      else iz = about
    }
    // local = R^T v (columns of R are the local axes in world space)
    const lx = (e[0] * x + e[1] * y + e[2] * z) * ix
    const ly = (e[4] * x + e[5] * y + e[6] * z) * iy
    const lz = (e[8] * x + e[9] * y + e[10] * z) * iz
    return [e[0] * lx + e[4] * ly + e[8] * lz, e[1] * lx + e[5] * ly + e[9] * lz, e[2] * lx + e[6] * ly + e[10] * lz]
  }

  /** The points of the box that touch the ground, in its own frame: the 8 corners, then (with `edges`) `EDGE_POINTS` along each of its 12 edges; or the piece's own `contacts`. */
  private samples(b: PieceBody, edges: boolean): Vec3[] {
    if (b.contacts) return b.contacts
    const [hx, hy, hz] = b.halfExtents
    const out: Vec3[] = []
    for (let i = 0; i < 8; i++) out.push([i & 1 ? hx : -hx, i & 2 ? hy : -hy, i & 4 ? hz : -hz])
    if (!edges) return out
    const h = [hx, hy, hz]
    for (let axis = 0; axis < 3; axis++) {
      const a1 = (axis + 1) % 3
      const a2 = (axis + 2) % 3
      for (let k = 0; k < 4; k++) {
        for (const f of EDGE_POINTS) {
          const p: Vec3 = [0, 0, 0]
          p[axis] = f * h[axis]
          p[a1] = k & 1 ? h[a1] : -h[a1]
          p[a2] = k & 2 ? h[a2] : -h[a2]
          out.push(p)
        }
      }
    }
    return out
  }

  /**
   * An impulse along the unit normal `n` at `r` (from the centre of mass, world) that stops the point closing in along `n` (with `bounce`); `e` holds the body's rotation.
   */
  private contactImpulse(b: PieceBody, e: ArrayLike<number>, r: Vec3, n: Vec3, bounce: number): void {
    const v = b.velocity
    const w = b.angularVelocity
    const vn = (v[0] + w[1] * r[2] - w[2] * r[1]) * n[0] + (v[1] + w[2] * r[0] - w[0] * r[2]) * n[1] + (v[2] + w[0] * r[1] - w[1] * r[0]) * n[2]
    if (vn >= 0) return
    // I^-1 (r x n), then (I^-1 (r x n) x r) . n
    const a = this.mulInvInertiaWith(b, e, r[1] * n[2] - r[2] * n[1], r[2] * n[0] - r[0] * n[2], r[0] * n[1] - r[1] * n[0])
    const k = (a[1] * r[2] - a[2] * r[1]) * n[0] + (a[2] * r[0] - a[0] * r[2]) * n[1] + (a[0] * r[1] - a[1] * r[0]) * n[2]
    const j = (-(1 + bounce) * vn) / (1 / b.mass + k)
    for (let i = 0; i < 3; i++) {
      v[i] += (j * n[i]) / b.mass
      w[i] += a[i] * j
    }
  }

  /** What lies inside the disc looks at the ground again: it was dug or heaped under it. */
  wakeRegion(x: number, z: number, radius: number): void {
    for (const b of this.list) {
      if (!b.sleeping || b.held || Math.hypot(b.root.position.x - x, b.root.position.z - z) > radius) continue
      b.sleeping = false
      b.still = 0
      b.calmAt = null
    }
  }

  update(dt: number): void {
    const steps = this.collisionSteps(dt)
    for (let i = 0; i < steps; i++) this.step(dt / steps)
  }

  /**
   * Steps of an update: one, or more while a round piece and a piece it could meet within the update close in fast enough to pass through each other between two (closing at
   * their two speeds they cover at most the round one's radius per step: two cans at 3.6 m/s close 12 cm in a frame, a can is 7 cm across; a plank thrown at a can still counts).
   * A round piece with nothing in reach takes one step, so its sweep against the world (the costly part) runs once.
   */
  private collisionSteps(dt: number): number {
    let need = 1
    const p = this.p
    const speedOf = (b: PieceBody): number => (b.held ? 0 : Math.hypot(b.velocity[0], b.velocity[1], b.velocity[2]))
    for (const b of this.list) {
      if (!b.round || b.held) continue
      // a radius of nothing passes through nothing: one step
      const radius = Math.max(MIN_ROUND_RADIUS, b.round.radius)
      const speed = b.sleeping ? 0 : speedOf(b)
      const c = this.centerOf(b, p)
      const cx = c.x, cy = c.y, cz = c.z
      const rb = Math.hypot(b.halfExtents[0], b.halfExtents[1], b.halfExtents[2])
      for (const o of this.list) {
        if (o === b || (b.sleeping && o.sleeping)) continue
        const closing = speed + (o.sleeping ? 0 : speedOf(o))
        if (closing * dt < radius * 0.5) continue
        const reach = closing * dt + rb + Math.hypot(o.halfExtents[0], o.halfExtents[1], o.halfExtents[2])
        const oc = this.centerOf(o, p)
        if (Math.abs(oc.x - cx) > reach || Math.abs(oc.y - cy) > reach || Math.abs(oc.z - cz) > reach) continue
        need = Math.max(need, Math.ceil((closing * dt) / radius))
      }
    }
    return Math.max(1, Math.min(MAX_COLLISION_STEPS, need))
  }

  private step(dt: number): void {
    this.time += dt
    this.solids = this.list.map((body) => {
      const c = this.centerOf(body, new this.THREE.Vector3())
      const h = body.halfExtents
      return { body, c: [c.x, c.y, c.z] as Vec3, e: [...new this.THREE.Matrix4().makeRotationFromQuaternion(body.root.quaternion).elements], half: h, r: Math.hypot(h[0], h[1], h[2]) }
    })
    // what lands on a piece lands on its parts (a shelf's boards, a table's top), not on the box around them all
    this.surfaces = this.solids.flatMap((whole): Solid[] => {
      const parts = whole.body.partBoxes
      if (!parts) return [whole]
      const e = whole.e
      return parts.map(({ center, half }) => ({
        body: whole.body,
        c: [
          whole.c[0] + e[0] * center[0] + e[4] * center[1] + e[8] * center[2],
          whole.c[1] + e[1] * center[0] + e[5] * center[1] + e[9] * center[2],
          whole.c[2] + e[2] * center[0] + e[6] * center[1] + e[10] * center[2],
        ] as Vec3,
        e,
        half,
        r: Math.hypot(half[0], half[1], half[2]),
      }))
    })
    this.solidOf.clear()
    for (const one of this.solids) this.solidOf.set(one.body, one)
    this.surfacesOf.clear()
    for (const one of this.surfaces) {
      const list = this.surfacesOf.get(one.body)
      if (list) list.push(one)
      else this.surfacesOf.set(one.body, [one])
    }
    this.surfaceGrid.clear()
    this.wideSurfaces.length = 0
    for (const one of this.surfaces) {
      const x0 = Math.floor((one.c[0] - one.r) / SURFACE_CELL)
      const x1 = Math.floor((one.c[0] + one.r) / SURFACE_CELL)
      const z0 = Math.floor((one.c[2] - one.r) / SURFACE_CELL)
      const z1 = Math.floor((one.c[2] + one.r) / SURFACE_CELL)
      if (x1 - x0 > SURFACE_CELLS_ACROSS || z1 - z0 > SURFACE_CELLS_ACROSS) {
        this.wideSurfaces.push(one)
        continue
      }
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const key = cellKey(ix, iz)
          const cell = this.surfaceGrid.get(key)
          if (cell) cell.push(one)
          else this.surfaceGrid.set(key, [one])
        }
      }
    }
    if (this.wideSurfaces.length > 0) for (const cell of this.surfaceGrid.values()) cell.push(...this.wideSurfaces)
    this.wakeUnsupported()
    for (const b of this.list) {
      if (b.held) {
        b.velocity = [0, 0, 0]
        b.angularVelocity = [0, 0, 0]
        b.sleeping = false
        b.still = 0
        b.calmAt = null
        continue
      }
      if (b.sleeping) continue
      this.integrate(b, dt)
      if (b.sleeping) continue
      const v = b.velocity
      const w = b.angularVelocity
      if (Math.hypot(v[0], v[1], v[2]) > WAKE_ABOVE_SPEED || Math.hypot(w[0], w[1], w[2]) > WAKE_ABOVE_SPIN) this.wakeAbove(b)
    }
    this.collide(dt)
  }

  /** A few sleeping pieces each update (`SUPPORT_CHECKS`, in turn) look under them again: one whose table broke, or whose shelf fell over, falls. */
  private wakeUnsupported(): void {
    const n = this.list.length
    for (let k = 0; k < Math.min(SUPPORT_CHECKS, n); k++) {
      this.supportTurn = (this.supportTurn + 1) % n
      const b = this.list[this.supportTurn]
      if (!b.sleeping || b.held || this.supported(b, false) || this.supported(b, true)) continue
      b.sleeping = false
      b.still = 0
      b.calmAt = null
    }
  }

  /**
   * Whether a point of `b` (its corners, or with `edges` the points along its edges too) has the ground, a piece or a fixed top under it. Any point, not only the lowest:
   * a book propped on a fallen case rests by a corner high on it while its lowest one hangs beside it.
   */
  private supported(b: PieceBody, edges: boolean): boolean {
    const c = this.centerOf(b, this.p)
    const e = this.m.makeRotationFromQuaternion(b.root.quaternion).elements
    for (const [sx, sy, sz] of this.samples(b, edges)) {
      const y = c.y + e[1] * sx + e[5] * sy + e[9] * sz
      const x = c.x + e[0] * sx + e[4] * sy + e[8] * sz
      const z = c.z + e[2] * sx + e[6] * sy + e[10] * sz
      if (this.supportAt(b, x, y, z, STEP) >= y - SUPPORT_GAP) return true
    }
    return false
  }

  /** The surfaces whose cell holds `(x, z)`, the wide ones (`wideSurfaces`) among them. */
  private surfacesAt(x: number, z: number): readonly Solid[] {
    return this.surfaceGrid.get(cellKey(Math.floor(x / SURFACE_CELL), Math.floor(z / SURFACE_CELL))) ?? this.wideSurfaces
  }

  /** The highest top of a piece (other than `self`) under `(x, z)` that a point at height `y` stands on (at most `step` above it), -Infinity when none; the boxes of the last update. */
  topAt(x: number, z: number, y: number, step: number, self?: string): number {
    let top = -Infinity
    for (const s of this.surfacesAt(x, z)) {
      if (s.body.objectId === self || s.body.held || Math.abs(x - s.c[0]) > s.r || Math.abs(z - s.c[2]) > s.r) continue
      const t = boxTopAt(s, x, z)
      if (t > top && t <= y + step) top = t
    }
    return top
  }

  /** What lay asleep on `b` (a box over its top) wakes at once when `b` moves: a can on a table that goes over goes with it. */
  private wakeAbove(b: PieceBody): void {
    const below = this.solidOf.get(b)
    if (!below) return
    const top = below.c[1] + below.half[0] * Math.abs(below.e[1]) + below.half[1] * Math.abs(below.e[5]) + below.half[2] * Math.abs(below.e[9])
    // what can lie on it is in the cells its own circle covers
    const x0 = Math.floor((below.c[0] - below.r) / SURFACE_CELL)
    const x1 = Math.floor((below.c[0] + below.r) / SURFACE_CELL)
    const z0 = Math.floor((below.c[2] - below.r) / SURFACE_CELL)
    const z1 = Math.floor((below.c[2] + below.r) / SURFACE_CELL)
    const wide = x1 - x0 > SURFACE_CELLS_ACROSS || z1 - z0 > SURFACE_CELLS_ACROSS
    const look = (part: Solid): void => {
      const o = part.body
      const s = this.solidOf.get(o)
      if (!s || !o.sleeping || o.held || o === b) return
      if (s.c[1] < below.c[1] || s.c[1] - s.r > top + STEP || Math.hypot(s.c[0] - below.c[0], s.c[2] - below.c[2]) > s.r + below.r) return
      // what lies on it is over it: a board leaning over a can rolling by its foot is not on the can
      if (boxTopAt(below, s.c[0], s.c[2]) === -Infinity && !this.restsOn(o, b, true)) return
      o.sleeping = false
      o.still = 0
      o.calmAt = null
    }
    if (wide) for (const s of this.solids) look(s)
    else for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) for (const part of this.surfaceGrid.get(cellKey(ix, iz)) ?? []) look(part)
  }

  /**
   * Whether `o` rests on a top of `below` (its parts, or its box): a corner of `o` (its contacts or its box) is over that top and within `STEP` of it. With `lowest`, only its
   * lowest corners count (within `STEP` of its lowest): a can rolling by another is beside it, not on it; without, a board leaning on a seat by its high end rests on the seat.
   */
  private restsOn(o: PieceBody, below: PieceBody, lowest: boolean): boolean {
    const c = this.centerOf(o, this.p)
    const e = this.m.makeRotationFromQuaternion(o.root.quaternion).elements
    const points = this.samples(o, false).map(([sx, sy, sz]): Vec3 => [c.x + e[0] * sx + e[4] * sy + e[8] * sz, c.y + e[1] * sx + e[5] * sy + e[9] * sz, c.z + e[2] * sx + e[6] * sy + e[10] * sz])
    let low = Infinity
    for (const p of points) low = Math.min(low, p[1])
    for (const [x, y, z] of points) {
      if (lowest && y > low + STEP) continue
      for (const s of this.surfacesAt(x, z)) if (s.body === below && Math.abs(y - boxTopAt(s, x, z)) <= STEP) return true
    }
    return false
  }

  /** Where a corner of `self` at `(x, y, z)` lands: the ground, the top of another piece or of something fixed under it. */
  private supportAt(self: PieceBody, x: number, y: number, z: number, step: number): number {
    let top = this.o.groundAt(x, z)
    let on: Solid | null = null
    let face = 1
    for (const s of this.surfacesAt(x, z)) {
      if (s.body === self || s.body.held || Math.abs(x - s.c[0]) > s.r || Math.abs(z - s.c[2]) > s.r) continue
      const t = boxTopAt(s, x, z)
      if (t > top && t <= y + step) {
        top = t
        on = s
        face = topFace
      }
    }
    const fixed = this.o.staticTopAt?.(x, z, y, step) ?? -Infinity
    if (fixed >= top) on = null
    this.supportNormal = on ? faceNormal(on, face) : UP
    this.supportFriction = on?.body.friction ?? null
    return Math.max(top, fixed)
  }

  /** Stops a piece that ran into something on its way from `start` to `pos` (`sweep`): moves it back to where it met it and takes the speed into it. */
  private sweepOn(b: PieceBody, start: Vec3, pos: Vec3): void {
    const travel = Math.hypot(pos[0] - start[0], pos[1] - start[1], pos[2] - start[2])
    if (travel < 1e-3) return
    const hit = this.o.sweep?.(b, start, pos)
    if (!hit || hit.normal[1] > SLAM_FLOOR_NORMAL) return
    const v = b.velocity
    const n = hit.normal
    const into = -(v[0] * n[0] + v[1] * n[1] + v[2] * n[2])
    if (into <= 0) return
    const k = Math.min(1, hit.distance / travel)
    const bounce = pairRestitution(b.restitution, hit.restitution)
    for (let i = 0; i < 3; i++) {
      pos[i] = start[i] + (pos[i] - start[i]) * k
      v[i] += (1 + bounce) * into * n[i]
    }
    const w = b.angularVelocity
    w[0] *= 0.5
    w[1] *= 0.5
    w[2] *= 0.5
    if (into >= SLAM_MIN_SPEED && this.time - b.lastHit > 0.15) {
      b.lastHit = this.time
      this.o.onSlam?.(b, hit, into)
    }
  }

  private integrate(b: PieceBody, dt: number): void {
    const c = this.centerOf(b, this.p)
    const pos: Vec3 = [c.x, c.y, c.z]
    const start: Vec3 = [c.x, c.y, c.z]
    const q = this.q.copy(b.root.quaternion)
    const v = b.velocity
    const w = b.angularVelocity
    const invM = 1 / b.mass
    const steps = clamp(Math.ceil(dt / SUB_DT), 1, 8)
    const h = dt / steps
    let landing = 0
    let landPoint: Vec3 = [pos[0], pos[1], pos[2]]
    let contactedLast = false
    let touched = false
    let unstable = false

    // over a step of the ground (the corners find it at different heights: a table's edge under it) the points along the edges touch too
    const corners = this.samples(b, false)
    this.m.makeRotationFromQuaternion(q)
    let gLow = Infinity
    let gHigh = -Infinity
    for (const [sx, sy, sz] of corners) {
      const e0 = this.m.elements
      const y = pos[1] + e0[1] * sx + e0[5] * sy + e0[9] * sz
      const x = pos[0] + e0[0] * sx + e0[4] * sy + e0[8] * sz
      const z = pos[2] + e0[2] * sx + e0[6] * sy + e0[10] * sz
      // only the fixed ground counts here: other pieces touching it (a pile, things spawned together) keep the corners
      const g = Math.max(this.o.groundAt(x, z), this.o.staticTopAt?.(x, z, y, STEP) ?? -Infinity)
      gLow = Math.min(gLow, g)
      gHigh = Math.max(gHigh, g)
    }
    let local = b.round ? this.roundSamples(b, q) : gHigh - gLow > STEP ? this.samples(b, true) : corners
    let prev: Vec3[] = local.map(() => [0, 0, 0])

    for (let s = 0; s < steps; s++) {
      if (b.round) {
        // a round piece touches by its lowest points as it will be turned at the end of this substep: they move round it as it rolls
        const wl0 = Math.hypot(w[0], w[1], w[2])
        const next = this.nextQ.copy(q)
        if (wl0 > 1e-6) next.premultiply(this.dq.setFromAxisAngle(this.ax.set(w[0] / wl0, w[1] / wl0, w[2] / wl0), wl0 * h)).normalize()
        local = this.roundSamples(b, next)
        if (prev.length !== local.length) prev = local.map(() => [0, 0, 0])
      }
      // where each point was before this substep: a point that comes at a higher ground from below it hit the side of the step
      this.m.makeRotationFromQuaternion(q)
      const e0 = this.m.elements
      for (let i = 0; i < local.length; i++) {
        const [sx, sy, sz] = local[i]
        prev[i][0] = pos[0] + e0[0] * sx + e0[4] * sy + e0[8] * sz
        prev[i][1] = pos[1] + e0[1] * sx + e0[5] * sy + e0[9] * sz
        prev[i][2] = pos[2] + e0[2] * sx + e0[6] * sy + e0[10] * sz
      }
      v[1] -= this.o.gravity * h
      pos[0] += v[0] * h
      pos[1] += v[1] * h
      pos[2] += v[2] * h
      const wl = Math.hypot(w[0], w[1], w[2])
      if (wl > 1e-6) {
        this.dq.setFromAxisAngle(this.ax.set(w[0] / wl, w[1] / wl, w[2] / wl), wl * h)
        q.premultiply(this.dq).normalize()
      }
      // the air slows a box's spin a little; a round piece keeps rolling, held back only by its rolling resistance on the ground
      const damp = b.round ? 1 : Math.exp(-0.15 * h)
      w[0] *= damp
      w[1] *= damp
      w[2] *= damp

      this.m.makeRotationFromQuaternion(q)
      const e = this.m.elements
      const rs: Vec3[] = []
      const ids: number[] = []
      // per contact: the normal of the surface under it and the friction of the two surfaces
      const ns: Vec3[] = []
      const mus: PieceFriction[] = []
      let maxPen = 0
      // the normal of the surface under the deepest point: the piece is pushed out along it (straight up on the floor, across a tilted top)
      let penNormal: Vec3 = UP
      const rise = STEP + Math.max(0, -v[1]) * h * 2
      // the side of a step of the ground: how far back the piece goes (metres along -dir) and the point that hit it
      let side: { back: number; dir: [number, number]; r: Vec3 } | null = null
      let lowest = Infinity
      for (let i = 0; i < local.length; i++) {
        const [sx, sy, sz] = local[i]
        const r: Vec3 = [e[0] * sx + e[4] * sy + e[8] * sz, e[1] * sx + e[5] * sy + e[9] * sz, e[2] * sx + e[6] * sy + e[10] * sz]
        const px = pos[0] + r[0]
        const pz = pos[2] + r[2]
        const cy = pos[1] + r[1]
        // the ground's own step (a table, a counter) that the point was more than a step below before this substep: it came at its side or is
        // under it, and does not stand on it (nor ratchets up onto it as the rest of the piece is lifted)
        const was = prev[i]
        const raw = this.o.groundAt(px, pz)
        if (raw > cy - SLOP && was[1] < raw - STEP) {
          // under a top it was already beneath (put under an overhang), or coming at its side: either way that top does not hold it
          if (this.o.groundAt(was[0], was[2]) >= raw - STEP) {
            // beneath it, the point stands on the floor the piece last stood on (the height field cannot see under a top)
            const floor = b.floor
            if (floor !== undefined && floor - cy > -SLOP && floor < raw - STEP) {
              rs.push(r)
              ids.push(i)
              ns.push(UP)
              mus.push(pairFriction(b.friction, null))
              maxPen = Math.max(maxPen, floor - cy)
            }
            continue
          }
          const dx = px - was[0]
          const dz = pz - was[2]
          const len = Math.hypot(dx, dz)
          if (len > 1e-6) {
            // where along its move the point met the side: the first place the ground is up at this top
            let lo = 0
            let hi = 1
            for (let it = 0; it < 6; it++) {
              const mid = (lo + hi) / 2
              if (this.o.groundAt(was[0] + dx * mid, was[2] + dz * mid) >= raw - STEP) hi = mid
              else lo = mid
            }
            const back = (1 - lo) * len + 0.001
            if (!side || back > side.back) side = { back, dir: [dx / len, dz / len], r }
          }
          continue
        }
        // the points along the edges are there for the step of the ground; on other pieces only the corners stand, as everywhere else
        this.supportNormal = UP
        this.supportFriction = null
        const gy = i < 8 || b.contacts ? this.supportAt(b, px, cy, pz, rise) : Math.max(raw, this.o.staticTopAt?.(px, pz, cy, rise) ?? -Infinity)
        const pen = gy - cy
        if (pen > -SLOP) {
          rs.push(r)
          ids.push(i)
          ns.push(this.supportNormal)
          mus.push(pairFriction(b.friction, this.supportFriction))
          if (pen > maxPen) {
            maxPen = pen
            penNormal = this.supportNormal
          }
          lowest = Math.min(lowest, gy)
        }
      }
      if (lowest < Infinity) b.floor = lowest
      if (b.round && ns.length > 0) {
        const sum: Vec3 = [0, 0, 0]
        for (const one of ns) for (let k = 0; k < 3; k++) sum[k] += one[k]
        const len = Math.hypot(sum[0], sum[1], sum[2])
        b.surfaceNormal = len > 1e-6 ? [sum[0] / len, sum[1] / len, sum[2] / len] : UP
      } else if (b.round && rs.length === 0) b.surfaceNormal = UP
      if (side) {
        // the side of the step stops the piece: back out of it, and the point loses the speed it had into the side
        pos[0] -= side.dir[0] * side.back
        pos[2] -= side.dir[1] * side.back
        this.contactImpulse(b, e, side.r, [-side.dir[0], 0, -side.dir[1]], SIDE_BOUNCE)
      }
      contactedLast = rs.length > 0
      if (contactedLast) touched = true
      if (!contactedLast) continue
      // a point `maxPen` under a surface of normal n is `maxPen * n.y` inside it, along n
      const out = Math.max(0, maxPen - SLOP * 0.5) * penNormal[1]
      pos[0] += penNormal[0] * out
      pos[1] += penNormal[1] * out
      pos[2] += penNormal[2] * out
      let impact = 0
      for (const r of rs) impact = Math.max(impact, -(v[1] + w[2] * r[0] - w[0] * r[2]))
      const restitution = impact > 2 ? 0.25 : 0
      if (impact > landing) {
        landing = impact
        let sx = 0
        let sz = 0
        for (const r of rs) {
          sx += r[0]
          sz += r[2]
        }
        const lx = pos[0] + sx / rs.length
        const lz = pos[2] + sz / rs.length
        landPoint = [lx, pos[1] - Math.max(...rs.map((r) => -r[1])), lz]
      }
      // Contact impulses, solved together: each point keeps the impulse it has given so far (pushing only, never pulling) and the friction it has
      // given (within the paper's grip times that push), and every pass corrects them. Points spread unevenly under the box (a table's edge under
      // half of it) then share the weight as they should, instead of the first ones handled kicking the box into a spin.
      // the velocity of a point of the piece: v + w x r
      const pointV = (r: Vec3): Vec3 => [v[0] + w[1] * r[2] - w[2] * r[1], v[1] + w[2] * r[0] - w[0] * r[2], v[2] + w[0] * r[1] - w[1] * r[0]]
      const dot = (a: Vec3, c: Vec3): number => a[0] * c[0] + a[1] * c[1] + a[2] * c[2]
      const goal = rs.map((r, k) => {
        const vn = dot(pointV(r), ns[k])
        return vn < 0 ? -restitution * vn : 0
      })
      // a point that slides drags with the dynamic friction, one that holds with the static one (Coulomb)
      const slipping = rs.map((r, k) => {
        // as it moved before this substep's gravity: a thing at rest on a slope is held by the static grip, not let go by the pull it is to resist
        const pv = pointV(r)
        pv[1] += this.o.gravity * h
        const vn = dot(pv, ns[k])
        return Math.hypot(pv[0] - vn * ns[k][0], pv[1] - vn * ns[k][1], pv[2] - vn * ns[k][2]) > SLIP_SPEED
      })
      // the step moved the piece at the speed it had before the contacts: what they took from it along the ground is taken from the move too, so
      // a push the floor's grip holds does not creep the piece along
      const vx0 = v[0]
      const vz0 = v[2]
      // warm start: each point starts from what it gave in the last substep (a resting box carries its weight from the first pass)
      if (!b.warm || b.warm.length !== WARM_SLOTS * 4) b.warm = new Float64Array(WARM_SLOTS * 4)
      const warm = b.warm
      const accN = ids.map((id) => (id < WARM_SLOTS ? warm[id * 4] : 0))
      const accT = ids.map((id): Vec3 => (id < WARM_SLOTS ? [warm[id * 4 + 1], warm[id * 4 + 2], warm[id * 4 + 3]] : [0, 0, 0]))
      /** Gives the piece the impulse `j` (world) at `r`. */
      const push = (r: Vec3, j: Vec3): void => {
        v[0] += j[0] * invM
        v[1] += j[1] * invM
        v[2] += j[2] * invM
        const dw = this.mulInvInertiaWith(b, e, r[1] * j[2] - r[2] * j[1], r[2] * j[0] - r[0] * j[2], r[0] * j[1] - r[1] * j[0])
        w[0] += dw[0]
        w[1] += dw[1]
        w[2] += dw[2]
      }
      /** The mass the piece shows to an impulse along the unit `d` at `r`: 1 / (1/m + (I^-1 (r x d) x r) . d). */
      const reach = (r: Vec3, d: Vec3): number => {
        const a = this.mulInvInertiaWith(b, e, r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0])
        return invM + (a[1] * r[2] - a[2] * r[1]) * d[0] + (a[2] * r[0] - a[0] * r[2]) * d[1] + (a[0] * r[1] - a[1] * r[0]) * d[2]
      }
      for (let k = 0; k < rs.length; k++) {
        const n = ns[k]
        const t = accT[k]
        if (accN[k] !== 0 || t[0] !== 0 || t[1] !== 0 || t[2] !== 0) push(rs[k], [n[0] * accN[k] + t[0], n[1] * accN[k] + t[1], n[2] * accN[k] + t[2]])
      }
      for (let it = 0; it < SOLVER_PASSES; it++) {
        for (let k = 0; k < rs.length; k++) {
          const r = rs[k]
          const n = ns[k]
          // the push along the normal of the surface (a tilted top pushes across it, not straight up)
          const vn = dot(pointV(r), n)
          const total = Math.max(0, accN[k] + (goal[k] - vn) / reach(r, n))
          const j = total - accN[k]
          accN[k] = total
          if (j !== 0) push(r, [n[0] * j, n[1] * j, n[2] * j])
          // friction in the plane of the surface, up to the static or dynamic coefficient times the push the point gives
          const pv = pointV(r)
          const pn = dot(pv, n)
          const vt: Vec3 = [pv[0] - pn * n[0], pv[1] - pn * n[1], pv[2] - pn * n[2]]
          const speed = Math.hypot(vt[0], vt[1], vt[2])
          const f: Vec3 = [accT[k][0], accT[k][1], accT[k][2]]
          if (speed > 1e-6) {
            const d: Vec3 = [vt[0] / speed, vt[1] / speed, vt[2] / speed]
            const jt = speed / reach(r, d)
            f[0] -= d[0] * jt
            f[1] -= d[1] * jt
            f[2] -= d[2] * jt
          } else if (f[0] === 0 && f[1] === 0 && f[2] === 0) continue
          const most = (slipping[k] ? mus[k].dynamic : mus[k].static) * accN[k]
          const fl = Math.hypot(f[0], f[1], f[2])
          if (fl > most) {
            f[0] *= most / fl
            f[1] *= most / fl
            f[2] *= most / fl
          }
          const dj: Vec3 = [f[0] - accT[k][0], f[1] - accT[k][1], f[2] - accT[k][2]]
          accT[k] = f
          if (dj[0] !== 0 || dj[1] !== 0 || dj[2] !== 0) push(r, dj)
        }
      }
      pos[0] += (v[0] - vx0) * h
      pos[2] += (v[2] - vz0) * h
      warm.fill(0)
      for (let k = 0; k < rs.length; k++) {
        const id = ids[k]
        if (id >= WARM_SLOTS) continue
        warm[id * 4] = accN[k]
        warm[id * 4 + 1] = accT[k][0]
        warm[id * 4 + 2] = accT[k][1]
        warm[id * 4 + 3] = accT[k][2]
      }
      // Support check. The corner contacts above are relative to the centre of mass, so they already give a torque when the centre of mass is
      // outside the support. What they cannot do is end a balancing act: a tall thin piece on its edge (or a single corner) is in equilibrium
      // with the centre of mass above a very small support, so it must not rest there. It gets a gentle topple push toward the side it leans
      // to (or toward the wider side when it leans nowhere), and it may not sleep.
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, low = 0
      for (const r of rs) {
        x0 = Math.min(x0, r[0]); x1 = Math.max(x1, r[0])
        z0 = Math.min(z0, r[2]); z1 = Math.max(z1, r[2])
        low = Math.min(low, r[1])
      }
      const height = -low
      const wx = x1 - x0
      const wz = z1 - z0
      // a round piece lying on its side rests on a line: that is its rest, not a balancing act (it rolls if the ground slopes)
      unstable = !b.round && (Math.min(wx, wz) < NARROW * height || x0 > 0 || x1 < 0 || z0 > 0 || z1 < 0)
      if (b.tipping) {
        b.tipping.seconds -= h
        // lying is measured on the box as it is turned: a top corner held from above (a board it was joined to) says nothing of how it stands
        const [hx, hy, hz] = b.halfExtents
        const upHalf = Math.abs(e[1]) * hx + Math.abs(e[5]) * hy + Math.abs(e[9]) * hz
        if (upHalf < TIP_LYING || b.tipping.seconds <= 0) b.tipping = null
        else {
          w[0] += b.tipping.x * TIP_ACCELERATION * h
          w[2] += b.tipping.z * TIP_ACCELERATION * h
          unstable = true
        }
      }
      if (unstable) {
        // the support centre relative to the centre of mass: the piece falls away from it (toward +axis when it is centred)
        const dirX = x0 + x1 > 0 ? -1 : 1
        const dirZ = z0 + z1 > 0 ? -1 : 1
        const k = TOPPLE * Math.min(height, 1) * h
        // rotating about -z moves the top toward +x; rotating about +x moves it toward +z
        if (wx <= wz) w[2] -= dirX * k
        else w[0] += dirZ * k
      }
      // rolling / spinning resistance while touching the ground: a box loses its spin; a round piece rolls on, held back by its rolling resistance
      // (a deceleration of C_RR g / r about the axis it rolls on) and a little spin about the others
      if (b.round) {
        let rolling = 0
        for (const mu of mus) rolling = Math.max(rolling, mu.rolling ?? ROLLING_RESISTANCE)
        this.rollingResistance(b, q, w, h, rolling)
      } else {
        const rd = Math.exp((rs.length >= 3 ? -3 : -1.5) * h)
        w[0] *= rd
        w[1] *= rd
        w[2] *= rd
        const fd = Math.exp(-0.3 * h)
        v[0] *= fd
        v[2] *= fd
      }
    }

    // what stands in the way (a wall, a car): the piece stops against it, bounces a little and both take the blow
    if (this.o.sweep && !b.held) this.sweepOn(b, start, pos)

    // write back
    b.root.quaternion.copy(q)
    const off = this.ax.copy(b.centerV).applyQuaternion(q)
    b.root.position.set(pos[0] - off.x, pos[1] - off.y, pos[2] - off.z)
    b.root.updateMatrixWorld(true)
    b.onGround = contactedLast

    if (landing > HARD_LANDING && this.time - b.lastHit > 0.15) {
      b.lastHit = this.time
      this.o.onHardLanding(b, landPoint, landing)
    }

    const still = touched && !unstable && Math.hypot(v[0], v[1], v[2]) < 0.12 && Math.hypot(w[0], w[1], w[2]) < 0.45
    if (still) b.still += dt
    else b.still = 0
    if (b.still >= SLEEP_AFTER || this.staysInPlace(b, touched && !b.tipping, pos, q, dt)) {
      b.sleeping = true
      b.calmAt = null
      v[0] = v[1] = v[2] = 0
      w[0] = w[1] = w[2] = 0
    }
  }

  /** Whether the piece has kept to the same spot on the ground for `CALM_SLEEP_AFTER` (see `CALM_DRIFT`). */
  private staysInPlace(b: PieceBody, touched: boolean, center: Vec3, q: THREE_NS.Quaternion, dt: number): boolean {
    const at = b.calmAt
    const turned = at ? 2 * Math.acos(Math.min(1, Math.abs(at.quaternion[0] * q.x + at.quaternion[1] * q.y + at.quaternion[2] * q.z + at.quaternion[3] * q.w))) : Infinity
    if (!touched || !at || Math.hypot(center[0] - at.center[0], center[1] - at.center[1], center[2] - at.center[2]) > CALM_DRIFT || turned > CALM_TURN) {
      b.calmAt = touched ? { center: [center[0], center[1], center[2]], quaternion: [q.x, q.y, q.z, q.w] } : null
      b.calm = 0
      return false
    }
    b.calm += dt
    return b.calm >= CALM_SLEEP_AFTER
  }

  /** Whether the centre `c` of `upper` is over the top of `lower`'s box (as it was at the start of the update). */
  private onTopOf(upper: PieceBody, lower: PieceBody, c: THREE_NS.Vector3): boolean {
    const s = this.solidOf.get(lower)
    if (!s) return false
    const top = boxTopAt(s, c.x, c.z)
    return top > -Infinity && c.y >= top - 0.01
  }

  /**
   * The points a round piece touches the ground by as it is turned now (`q`): its rims (`contacts`), which hold it standing on an end, and the exact lowest point of each
   * rim (of the ball), so lying on its side it rests on a line and rolls smoothly instead of over the corners of a polygon.
   */
  private roundSamples(b: PieceBody, q: THREE_NS.Quaternion): Vec3[] {
    const round = b.round
    const rims = b.contacts ?? []
    if (!round) return rims
    const e = this.m.makeRotationFromQuaternion(q).elements
    // into the surface it last lay on (the world's down on the floor), in the piece's frame: on a slope it touches below its centre across the slope, not straight down
    const n = b.surfaceNormal ?? UP
    const down: Vec3 = [-(e[0] * n[0] + e[1] * n[1] + e[2] * n[2]), -(e[4] * n[0] + e[5] * n[1] + e[6] * n[2]), -(e[8] * n[0] + e[9] * n[1] + e[10] * n[2])]
    if (round.kind === 'sphere') return [...rims, [down[0] * round.radius, down[1] * round.radius, down[2] * round.radius]]
    const k = round.axis
    const across: Vec3 = [down[0], down[1], down[2]]
    across[k] = 0
    const len = Math.hypot(across[0], across[1], across[2])
    // standing on an end: the rim holds it
    if (len < 1e-3) return rims
    const lowest = (at: number, radius: number): Vec3 => {
      const p: Vec3 = [(across[0] / len) * radius, (across[1] / len) * radius, (across[2] / len) * radius]
      p[k] = at
      return p
    }
    const half = b.halfExtents[k]
    // the lowest point of each ring along it: a straight can touches by both ends, a tapered bottle by its wide end and its narrow one, a bottle's neck not at all
    const low = (round.profile ?? [[-half, round.radius], [half, round.radius]]).map(([at, radius]) => lowest(at, radius))
    // lying (its axis nearer level than upright) it touches by those lowest points only: the points of the rims beside them move as it rolls and would brake it
    return len > ROUND_LYING ? low : [...rims, ...low]
  }

  /**
   * Slows the spin of a round piece on the ground by its rolling resistance: a torque C_rr N r about the axis it rolls on (N = m g n_y on a surface of normal n), so with
   * I = k m r^2 the spin loses C_rr g n_y / (k r) per second, and down a slope of angle t it rolls at g (sin t - C_rr cos t) / (1 + k). Standing on its rim, a can's spin
   * about the rest dies down; lying, it keeps turning about the line it touches by (a tapered bottle rounds its narrow end).
   */
  private rollingResistance(b: PieceBody, q: THREE_NS.Quaternion, w: Vec3, h: number, rolling: number): void {
    const round = b.round
    if (!round) return
    const e = this.m.makeRotationFromQuaternion(q).elements
    const cylinder = round.kind === 'cylinder'
    const a: Vec3 = cylinder ? [e[round.axis * 4], e[round.axis * 4 + 1], e[round.axis * 4 + 2]] : [0, 0, 0]
    const along = cylinder ? w[0] * a[0] + w[1] * a[1] + w[2] * a[2] : 0
    const roll: Vec3 = cylinder ? [a[0] * along, a[1] * along, a[2] * along] : [w[0], w[1], w[2]]
    const rest: Vec3 = [w[0] - roll[0], w[1] - roll[1], w[2] - roll[2]]
    const spin = Math.hypot(roll[0], roll[1], roll[2])
    const upright = b.surfaceNormal?.[1] ?? 1
    const slow = spin > 0 ? Math.max(0, spin - (rolling * this.o.gravity * upright * h) / (round.inertia * round.radius)) / spin : 0
    const lying = cylinder && Math.abs(a[1]) < ROUND_LYING
    const damp = lying ? 1 : Math.exp(-3 * h)
    for (let i = 0; i < 3; i++) w[i] = roll[i] * slow + rest[i] * damp
  }

  /** Half the height of the box of a piece as it is turned now. */
  private halfHeight(b: PieceBody): number {
    const e = this.m.makeRotationFromQuaternion(b.root.quaternion).elements
    return Math.abs(e[1]) * b.halfExtents[0] + Math.abs(e[5]) * b.halfExtents[1] + Math.abs(e[9]) * b.halfExtents[2]
  }

  /**
   * Pieces against each other. Candidates by sweep and prune along x on their bounding spheres (sorted once per step: fifty cans cost a sort and a handful of pairs, not
   * 1225); a pair with a round piece in it meets by its shapes (`shapeContact`) and exchanges an impulse, two boxes are only pushed apart (`separatePair`).
   */
  private collide(dt: number): void {
    const n = this.list.length
    if (n < 2) return
    const centers = this.list.map((b) => {
      const c = this.centerOf(b, this.p)
      return [c.x, c.y, c.z] as Vec3
    })
    const radii = this.list.map((b) => Math.hypot(b.halfExtents[0], b.halfExtents[1], b.halfExtents[2]))
    const order = this.list.map((_, i) => i).sort((i, j) => centers[i][0] - radii[i] - (centers[j][0] - radii[j]))
    for (let oi = 0; oi < n; oi++) {
      const i = order[oi]
      const reach = centers[i][0] + radii[i]
      for (let oj = oi + 1; oj < n; oj++) {
        const j = order[oj]
        if (centers[j][0] - radii[j] > reach) break
        const a = this.list[i]
        const b = this.list[j]
        if ((a.held || a.sleeping) && (b.held || b.sleeping)) continue
        const r = radii[i] + radii[j]
        const ca = centers[i]
        const cb = centers[j]
        if (Math.abs(ca[1] - cb[1]) > r || Math.abs(ca[2] - cb[2]) > r) continue
        // one lies on the other (a book on a shelf): the corners hold them apart, a sideways push would slide it off
        // (a round piece meets the other by their shapes, which tell lying on from beside: a can by a tall wardrobe whose middle is far above it still hits it)
        if (!a.round && !b.round && Math.abs(ca[1] - cb[1]) >= (this.halfHeight(a) + this.halfHeight(b)) * 0.9) continue
        // or on a tilted top (a table going over): the one above is over the other's top, whatever their boxes' heights
        if (this.onTopOf(b, a, new this.THREE.Vector3(...cb)) || this.onTopOf(a, b, new this.THREE.Vector3(...ca))) continue
        if (a.round || b.round) this.knock(a, b, ca, cb)
        // two boxes, unless one leans on the other's part (a board on a bench's seat): the support holds them, not a push apart
        // nor when no part of one is in a part of the other (a book lying in the hollow of a case on its back is inside its box, not in its boards)
        else if (this.partsOverlap(a, b) && !this.restsOn(a, b, false) && !this.restsOn(b, a, false)) this.separatePair(a, b, ca, cb, dt)
      }
    }
  }

  /** The shape a piece meets others by (`ContactShape`), as it stands now: a round one a capsule round its axis, any other the boxes of its parts or its box. */
  private contactShape(b: PieceBody, c: Vec3): ContactShape {
    const e = [...this.m.makeRotationFromQuaternion(b.root.quaternion).elements]
    const round = b.round
    if (round) {
      if (round.kind === 'sphere') return { kind: 'capsule', from: c, to: c, radius: round.radius }
      // the segment stops a radius short of each end, so end on it is as long as the piece
      const reach = Math.max(0, b.halfExtents[round.axis] - round.radius)
      const k = round.axis * 4
      const d: Vec3 = [e[k] * reach, e[k + 1] * reach, e[k + 2] * reach]
      return { kind: 'capsule', from: [c[0] - d[0], c[1] - d[1], c[2] - d[2]], to: [c[0] + d[0], c[1] + d[1], c[2] + d[2]], radius: round.radius }
    }
    const parts = b.partBoxes ?? [{ center: [0, 0, 0] as Vec3, half: b.halfExtents }]
    return {
      kind: 'boxes',
      boxes: parts.map(({ center, half }) => ({
        c: [c[0] + e[0] * center[0] + e[4] * center[1] + e[8] * center[2], c[1] + e[1] * center[0] + e[5] * center[1] + e[9] * center[2], c[2] + e[2] * center[0] + e[6] * center[1] + e[10] * center[2]] as Vec3,
        e,
        half,
      })),
    }
  }

  /**
   * Two pieces that met, one of them round: they are put apart along the normal (by their inverse masses) and, closing in, exchange an impulse
   * j = -(1 + e) v_n / (1/m_a + 1/m_b + the turning of each), with the restitution e of their two materials, and the friction of their surfaces across it. The impulses are
   * equal and opposite, so the momentum of the pair is kept. A held piece is not moved (the hand holds it); a sleeping one wakes when it is knocked.
   */
  private knock(a: PieceBody, b: PieceBody, ca: Vec3, cb: Vec3): void {
    const hit = shapeContact(this.contactShape(a, ca), this.contactShape(b, cb))
    if (!hit) return
    const n = hit.normal
    // one on the other (a can rolling down a board, off its end): the support of the pieces holds it, as it does on the floor
    if (Math.abs(n[1]) > SLAM_FLOOR_NORMAL) return
    const ra: Vec3 = [hit.point[0] - ca[0], hit.point[1] - ca[1], hit.point[2] - ca[2]]
    const rb: Vec3 = [hit.point[0] - cb[0], hit.point[1] - cb[1], hit.point[2] - cb[2]]
    const pointV = (body: PieceBody, r: Vec3): Vec3 => {
      const v = body.velocity
      const w = body.angularVelocity
      return [v[0] + w[1] * r[2] - w[2] * r[1], v[1] + w[2] * r[0] - w[0] * r[2], v[2] + w[0] * r[1] - w[1] * r[0]]
    }
    const relative = (): Vec3 => {
      const va = pointV(a, ra)
      const vb = pointV(b, rb)
      return [va[0] - vb[0], va[1] - vb[1], va[2] - vb[2]]
    }
    const vn0 = relative()
    const closing = vn0[0] * n[0] + vn0[1] * n[1] + vn0[2] * n[2]
    // a sleeping piece stays put for a touch (cans asleep side by side); knocked, it wakes
    const wake = (body: PieceBody): void => {
      body.sleeping = false
      body.still = 0
      body.calmAt = null
    }
    if (closing < -WAKE_ABOVE_SPEED) {
      if (a.sleeping) wake(a)
      if (b.sleeping) wake(b)
    }
    const ima = a.held || a.sleeping ? 0 : 1 / a.mass
    const imb = b.held || b.sleeping ? 0 : 1 / b.mass
    if (ima + imb === 0) return
    const ea = [...this.m.makeRotationFromQuaternion(a.root.quaternion).elements]
    const eb = [...this.m.makeRotationFromQuaternion(b.root.quaternion).elements]
    // apart: along the ground when they meet side by side (a can is not lifted off the floor by its neighbour), else along the normal
    const flat = Math.hypot(n[0], n[2])
    const out: Vec3 = flat > KNOCK_FLAT ? [n[0] / flat, 0, n[2] / flat] : n
    const depth = Math.max(0, hit.depth - SLOP) / (flat > KNOCK_FLAT ? flat : 1)
    for (const [body, share, sign] of [[a, ima, 1], [b, imb, -1]] as const) {
      if (share === 0) continue
      const move = (depth * share * sign) / (ima + imb)
      body.root.position.x += out[0] * move
      body.root.position.y += out[1] * move
      body.root.position.z += out[2] * move
    }
    if (closing >= 0) return
    /** What the pair shows to an impulse along the unit `d`: 1/m_a + 1/m_b + (I_a^-1 (r_a x d) x r_a) . d + (the same for b). */
    const turning = (body: PieceBody, e: number[], r: Vec3, d: Vec3): number => {
      const t = this.mulInvInertiaWith(body, e, r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0])
      return (t[1] * r[2] - t[2] * r[1]) * d[0] + (t[2] * r[0] - t[0] * r[2]) * d[1] + (t[0] * r[1] - t[1] * r[0]) * d[2]
    }
    const resist = (d: Vec3): number => ima + imb + (ima > 0 ? turning(a, ea, ra, d) : 0) + (imb > 0 ? turning(b, eb, rb, d) : 0)
    const give = (j: Vec3): void => {
      if (ima > 0) {
        for (let i = 0; i < 3; i++) a.velocity[i] += j[i] * ima
        const dw = this.mulInvInertiaWith(a, ea, ra[1] * j[2] - ra[2] * j[1], ra[2] * j[0] - ra[0] * j[2], ra[0] * j[1] - ra[1] * j[0])
        for (let i = 0; i < 3; i++) a.angularVelocity[i] += dw[i]
      }
      if (imb > 0) {
        for (let i = 0; i < 3; i++) b.velocity[i] -= j[i] * imb
        const dw = this.mulInvInertiaWith(b, eb, rb[1] * j[2] - rb[2] * j[1], rb[2] * j[0] - rb[0] * j[2], rb[0] * j[1] - rb[1] * j[0])
        for (let i = 0; i < 3; i++) b.angularVelocity[i] -= dw[i]
      }
    }
    // a touch slower than `BOUNCE_MIN_SPEED` only stops (two cans resting together do not chatter)
    const bounce = -closing > BOUNCE_MIN_SPEED ? pairRestitution(a.restitution, b.restitution) : 0
    const j = (-(1 + bounce) * closing) / resist(n)
    give([n[0] * j, n[1] * j, n[2] * j])
    // the friction of the two surfaces across the normal, up to mu times the push (Coulomb)
    const v = relative()
    const vn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2]
    const vt: Vec3 = [v[0] - vn * n[0], v[1] - vn * n[1], v[2] - vn * n[2]]
    const slide = Math.hypot(vt[0], vt[1], vt[2])
    if (slide < 1e-6) return
    const t: Vec3 = [vt[0] / slide, vt[1] / slide, vt[2] / slide]
    const jt = Math.min(slide / resist(t), pairFriction(a.friction, b.friction ?? null).dynamic * j)
    give([-t[0] * jt, -t[1] * jt, -t[2] * jt])
    if (-closing >= SLAM_MIN_SPEED && this.time - Math.max(a.lastHit, b.lastHit) > 0.15) {
      a.lastHit = b.lastHit = this.time
      this.o.onKnock?.(a, b, hit.point, -closing)
    }
  }

  /** Whether a part of `a` and a part of `b` (their boxes of the step, as world-aligned boxes around them) overlap. */
  private partsOverlap(a: PieceBody, b: PieceBody): boolean {
    const extent = (s: Solid, k: number): number => Math.abs(s.e[k]) * s.half[0] + Math.abs(s.e[k + 4]) * s.half[1] + Math.abs(s.e[k + 8]) * s.half[2]
    for (const pa of this.surfacesOf.get(a) ?? []) {
      for (const pb of this.surfacesOf.get(b) ?? []) {
        let apart = false
        for (let k = 0; k < 3 && !apart; k++) apart = Math.abs(pa.c[k] - pb.c[k]) > extent(pa, k) + extent(pb, k)
        if (!apart) return true
      }
    }
    return false
  }

  /** Two boxes overlapping side by side (horizontal bounding circles): pushed apart, gently, so they do not interpenetrate forever. */
  private separatePair(a: PieceBody, b: PieceBody, ca: Vec3, cb: Vec3, dt: number): void {
    const fixedA = a.held || a.sleeping
    const fixedB = b.held || b.sleeping
    const maxMove = 1.5 * dt
    const rh = (Math.max(a.halfExtents[0], a.halfExtents[2]) + Math.max(b.halfExtents[0], b.halfExtents[2])) * 0.8
    let dx = cb[0] - ca[0]
    let dz = cb[2] - ca[2]
    let d = Math.hypot(dx, dz)
    if (d >= rh) return
    if (d < 1e-5) {
      dx = 1
      dz = 0
      d = 1
    }
    const push = Math.min(maxMove, (rh - d) * 0.5)
    const wa = fixedA ? 0 : fixedB ? 1 : b.mass / (a.mass + b.mass)
    const wb = fixedB ? 0 : fixedA ? 1 : a.mass / (a.mass + b.mass)
    const ux = dx / (d || 1)
    const uz = dz / (d || 1)
    if (!fixedA) {
      a.root.position.x -= ux * push * 2 * wa
      a.root.position.z -= uz * push * 2 * wa
    }
    if (!fixedB) {
      b.root.position.x += ux * push * 2 * wb
      b.root.position.z += uz * push * 2 * wb
    }
  }
}
