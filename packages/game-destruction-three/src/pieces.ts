import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'
import type { PieceBody } from './internal'
import { clamp } from './math'

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
}

const SUB_DT = 1 / 120
const MU = 0.7
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

/** Box of a piece in the world: centre, rotation columns (`Matrix4.elements`) and half extents. */
interface Solid {
  body: PieceBody
  c: Vec3
  e: number[]
  half: Vec3
  /** Radius of the box around its centre: a point farther than it on the ground plane misses it. */
  r: number
}

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
    t1 = Math.min(t1, b)
    if (t0 > t1) return -Infinity
  }
  return s.c[1] + t1
}

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
  private readonly m: THREE_NS.Matrix4
  private readonly ax: THREE_NS.Vector3
  private solids: Solid[] = []

  constructor(
    private readonly THREE: typeof THREE_NS,
    private readonly o: PieceSystemOptions,
  ) {
    this.p = new THREE.Vector3()
    this.q = new THREE.Quaternion()
    this.dq = new THREE.Quaternion()
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
    if (i >= 0) this.list.splice(i, 1)
  }

  clear(): void {
    this.list.length = 0
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
    const ix = k / (hy * hy + hz * hz)
    const iy = k / (hx * hx + hz * hz)
    const iz = k / (hx * hx + hy * hy)
    // local = R^T v (columns of R are the local axes in world space)
    const lx = (e[0] * x + e[1] * y + e[2] * z) * ix
    const ly = (e[4] * x + e[5] * y + e[6] * z) * iy
    const lz = (e[8] * x + e[9] * y + e[10] * z) * iz
    return [e[0] * lx + e[4] * ly + e[8] * lz, e[1] * lx + e[5] * ly + e[9] * lz, e[2] * lx + e[6] * ly + e[10] * lz]
  }

  /** The points of the box that touch the ground, in its own frame: the 8 corners, then (with `edges`) `EDGE_POINTS` along each of its 12 edges. */
  private samples(b: PieceBody, edges: boolean): Vec3[] {
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
    this.time += dt
    this.solids = this.list.map((body) => {
      const c = this.centerOf(body, new this.THREE.Vector3())
      const h = body.halfExtents
      return { body, c: [c.x, c.y, c.z] as Vec3, e: [...new this.THREE.Matrix4().makeRotationFromQuaternion(body.root.quaternion).elements], half: h, r: Math.hypot(h[0], h[1], h[2]) }
    })
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
    }
    this.separate(dt)
  }

  /** Where a corner of `self` at `(x, y, z)` lands: the ground, the top of another piece or of something fixed under it. */
  private supportAt(self: PieceBody, x: number, y: number, z: number, step: number): number {
    let top = this.o.groundAt(x, z)
    for (const s of this.solids) {
      if (s.body === self || s.body.held || Math.abs(x - s.c[0]) > s.r || Math.abs(z - s.c[2]) > s.r) continue
      const t = boxTopAt(s, x, z)
      if (t > top && t <= y + step) top = t
    }
    const fixed = this.o.staticTopAt?.(x, z, y, step) ?? -Infinity
    return Math.max(top, fixed)
  }

  private integrate(b: PieceBody, dt: number): void {
    const c = this.centerOf(b, this.p)
    const pos: Vec3 = [c.x, c.y, c.z]
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
    const local = gHigh - gLow > STEP ? this.samples(b, true) : corners
    const prev: Vec3[] = local.map(() => [0, 0, 0])

    for (let s = 0; s < steps; s++) {
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
      const damp = Math.exp(-0.15 * h)
      w[0] *= damp
      w[1] *= damp
      w[2] *= damp

      this.m.makeRotationFromQuaternion(q)
      const e = this.m.elements
      const rs: Vec3[] = []
      const ids: number[] = []
      let maxPen = 0
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
        const gy = i < 8 ? this.supportAt(b, px, cy, pz, rise) : Math.max(raw, this.o.staticTopAt?.(px, pz, cy, rise) ?? -Infinity)
        const pen = gy - cy
        if (pen > -SLOP) {
          rs.push(r)
          ids.push(i)
          if (pen > maxPen) maxPen = pen
          lowest = Math.min(lowest, gy)
        }
      }
      if (lowest < Infinity) b.floor = lowest
      if (side) {
        // the side of the step stops the piece: back out of it, and the point loses the speed it had into the side
        pos[0] -= side.dir[0] * side.back
        pos[2] -= side.dir[1] * side.back
        this.contactImpulse(b, e, side.r, [-side.dir[0], 0, -side.dir[1]], SIDE_BOUNCE)
      }
      contactedLast = rs.length > 0
      if (contactedLast) touched = true
      if (!contactedLast) continue
      pos[1] += Math.max(0, maxPen - SLOP * 0.5)
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
      const goal = rs.map((r) => {
        const vy = v[1] + (w[2] * r[0] - w[0] * r[2])
        return vy < 0 ? -restitution * vy : 0
      })
      // the step moved the piece at the speed it had before the contacts: what they took from it along the ground is taken from the move too, so
      // a push the floor's grip holds does not creep the piece along
      const vx0 = v[0]
      const vz0 = v[2]
      // warm start: each point starts from what it gave in the last substep (a resting box carries its weight from the first pass)
      if (!b.warm || b.warm.length !== WARM_SLOTS * 3) b.warm = new Float64Array(WARM_SLOTS * 3)
      const warm = b.warm
      const accN = ids.map((id) => (id < WARM_SLOTS ? warm[id * 3] : 0))
      const accT = ids.map((id): [number, number] => (id < WARM_SLOTS ? [warm[id * 3 + 1], warm[id * 3 + 2]] : [0, 0]))
      for (let k = 0; k < rs.length; k++) {
        const r = rs[k]
        const jn = accN[k]
        const [fx, fz] = accT[k]
        if (jn === 0 && fx === 0 && fz === 0) continue
        v[0] += fx * invM
        v[1] += jn * invM
        v[2] += fz * invM
        // r x (fx, jn, fz)
        const dw = this.mulInvInertiaWith(b, e, r[1] * fz - r[2] * jn, r[2] * fx - r[0] * fz, r[0] * jn - r[1] * fx)
        w[0] += dw[0]
        w[1] += dw[1]
        w[2] += dw[2]
      }
      for (let it = 0; it < SOLVER_PASSES; it++) {
        for (let k = 0; k < rs.length; k++) {
          const r = rs[k]
          // normal impulse (n = +y): r x n = (-rz, 0, rx)
          const vy = v[1] + (w[2] * r[0] - w[0] * r[2])
          const a = this.mulInvInertiaWith(b, e, -r[2], 0, r[0])
          const denom = invM + (a[2] * r[0] - a[0] * r[2])
          const total = Math.max(0, accN[k] + (goal[k] - vy) / denom)
          const j = total - accN[k]
          accN[k] = total
          if (j !== 0) {
            v[1] += j * invM
            w[0] += a[0] * j
            w[1] += a[1] * j
            w[2] += a[2] * j
          }
          // friction in the contact plane, up to MU times the push the point gives
          const vx = v[0] + (w[1] * r[2] - w[2] * r[1])
          const vz = v[2] + (w[0] * r[1] - w[1] * r[0])
          const vt = Math.hypot(vx, vz)
          if (vt < 1e-6 && accT[k][0] === 0 && accT[k][1] === 0) continue
          let fx = accT[k][0]
          let fz = accT[k][1]
          if (vt > 1e-6) {
            const tx = vx / vt
            const tz = vz / vt
            // r x t with t = (tx, 0, tz) -> (ry*tz, rz*tx - rx*tz, -ry*tx)
            const at = this.mulInvInertiaWith(b, e, r[1] * tz, r[2] * tx - r[0] * tz, -r[1] * tx)
            const cx = at[1] * r[2] - at[2] * r[1]
            const cz = at[0] * r[1] - at[1] * r[0]
            const jt = vt / (invM + cx * tx + cz * tz)
            fx -= tx * jt
            fz -= tz * jt
          }
          const most = MU * accN[k]
          const f = Math.hypot(fx, fz)
          if (f > most) {
            fx *= most / f
            fz *= most / f
          }
          const dx = fx - accT[k][0]
          const dz = fz - accT[k][1]
          accT[k] = [fx, fz]
          if (dx === 0 && dz === 0) continue
          v[0] += dx * invM
          v[2] += dz * invM
          // r x f with f = (dx, 0, dz)
          const dw = this.mulInvInertiaWith(b, e, r[1] * dz, r[2] * dx - r[0] * dz, -r[1] * dx)
          w[0] += dw[0]
          w[1] += dw[1]
          w[2] += dw[2]
        }
      }
      pos[0] += (v[0] - vx0) * h
      pos[2] += (v[2] - vz0) * h
      warm.fill(0)
      for (let k = 0; k < rs.length; k++) {
        const id = ids[k]
        if (id >= WARM_SLOTS) continue
        warm[id * 3] = accN[k]
        warm[id * 3 + 1] = accT[k][0]
        warm[id * 3 + 2] = accT[k][1]
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
      unstable = Math.min(wx, wz) < NARROW * height || x0 > 0 || x1 < 0 || z0 > 0 || z1 < 0
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
      // rolling / spinning resistance while touching the ground
      const rd = Math.exp((rs.length >= 3 ? -3 : -1.5) * h)
      w[0] *= rd
      w[1] *= rd
      w[2] *= rd
      const fd = Math.exp(-0.3 * h)
      v[0] *= fd
      v[2] *= fd
    }

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

  /** Half the height of the box of a piece as it is turned now. */
  private halfHeight(b: PieceBody): number {
    const e = this.m.makeRotationFromQuaternion(b.root.quaternion).elements
    return Math.abs(e[1]) * b.halfExtents[0] + Math.abs(e[5]) * b.halfExtents[1] + Math.abs(e[9]) * b.halfExtents[2]
  }

  /** Push overlapping pieces apart (horizontal bounding circles), gently, so they do not interpenetrate forever. */
  private separate(dt: number): void {
    const n = this.list.length
    if (n < 2) return
    const maxMove = 1.5 * dt
    const ca = new this.THREE.Vector3()
    const cb = new this.THREE.Vector3()
    for (let i = 0; i < n; i++) {
      const a = this.list[i]
      for (let j = i + 1; j < n; j++) {
        const b = this.list[j]
        const fixedA = a.held || a.sleeping
        const fixedB = b.held || b.sleeping
        if (fixedA && fixedB) continue
        const ra = Math.hypot(a.halfExtents[0], a.halfExtents[1], a.halfExtents[2])
        const rb = Math.hypot(b.halfExtents[0], b.halfExtents[1], b.halfExtents[2])
        this.centerOf(a, ca)
        this.centerOf(b, cb)
        if (Math.abs(ca.y - cb.y) > ra + rb) continue
        // one lies on the other (a book on a shelf): the corners hold them apart, a sideways push would slide it off
        if (Math.abs(ca.y - cb.y) >= (this.halfHeight(a) + this.halfHeight(b)) * 0.9) continue
        const rh = (Math.max(a.halfExtents[0], a.halfExtents[2]) + Math.max(b.halfExtents[0], b.halfExtents[2])) * 0.8
        let dx = cb.x - ca.x
        let dz = cb.z - ca.z
        let d = Math.hypot(dx, dz)
        if (d >= rh) continue
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
  }
}
