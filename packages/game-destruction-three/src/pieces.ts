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
const HARD_LANDING = 3
/** Contact tolerance in metres: corners this close to the ground count as touching, which keeps the contact set (and a resting box) stable. */
const SLOP = 0.002
/** A resting support narrower than this fraction of the centre-of-mass height is a balancing act, not a rest: the piece topples. */
const NARROW = 0.3
/** Angular acceleration (rad/s^2 per metre of height) that pushes a balancing piece off its edge, toward the side its centre of mass leans to. */
const TOPPLE = 3
/** How far (m) above a corner a top may be and still catch it (on top of what the corner falls in one sub-step): higher is beside it, not under it. */
const STEP = 0.03

/** Box of a piece in the world: centre, rotation columns (`Matrix4.elements`) and half extents. */
interface Solid {
  body: PieceBody
  c: Vec3
  e: number[]
  half: Vec3
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
 * below it, a tipping panel on the chair in front of it. Not a general solver: what lies under a corner holds it, what stands beside it does not.
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

  update(dt: number): void {
    this.time += dt
    this.solids = this.list.map((body) => {
      const c = this.centerOf(body, new this.THREE.Vector3())
      return { body, c: [c.x, c.y, c.z] as Vec3, e: [...new this.THREE.Matrix4().makeRotationFromQuaternion(body.root.quaternion).elements], half: body.halfExtents }
    })
    for (const b of this.list) {
      if (b.held) {
        b.velocity = [0, 0, 0]
        b.angularVelocity = [0, 0, 0]
        b.sleeping = false
        b.still = 0
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
      if (s.body === self || s.body.held) continue
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
    const [hx, hy, hz] = b.halfExtents
    const invM = 1 / b.mass
    const steps = clamp(Math.ceil(dt / SUB_DT), 1, 8)
    const h = dt / steps
    let landing = 0
    let landPoint: Vec3 = [pos[0], pos[1], pos[2]]
    let contactedLast = false
    let touched = false
    let unstable = false

    for (let s = 0; s < steps; s++) {
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
      let maxPen = 0
      for (let i = 0; i < 8; i++) {
        const sx = i & 1 ? hx : -hx
        const sy = i & 2 ? hy : -hy
        const sz = i & 4 ? hz : -hz
        const r: Vec3 = [e[0] * sx + e[4] * sy + e[8] * sz, e[1] * sx + e[5] * sy + e[9] * sz, e[2] * sx + e[6] * sy + e[10] * sz]
        const cy = pos[1] + r[1]
        const gy = this.supportAt(b, pos[0] + r[0], cy, pos[2] + r[2], STEP + Math.max(0, -v[1]) * h * 2)
        const pen = gy - cy
        if (pen > -SLOP) {
          rs.push(r)
          if (pen > maxPen) maxPen = pen
        }
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
      for (let it = 0; it < 4; it++) {
        for (const r of rs) {
          // contact point velocity
          let vx = v[0] + (w[1] * r[2] - w[2] * r[1])
          let vy = v[1] + (w[2] * r[0] - w[0] * r[2])
          let vz = v[2] + (w[0] * r[1] - w[1] * r[0])
          const vn = vy
          if (vn >= 0) continue
          // normal impulse (n = +y): r x n = (-rz, 0, rx)
          const a = this.mulInvInertiaWith(b, e, -r[2], 0, r[0])
          const denom = invM + (a[2] * r[0] - a[0] * r[2])
          const j = (-(1 + (it === 0 ? restitution : 0)) * vn) / denom
          v[1] += j * invM
          const dw = this.mulInvInertiaWith(b, e, -r[2] * j, 0, r[0] * j)
          w[0] += dw[0]
          w[1] += dw[1]
          w[2] += dw[2]
          // friction in the contact plane
          vx = v[0] + (w[1] * r[2] - w[2] * r[1])
          vy = v[1] + (w[2] * r[0] - w[0] * r[2])
          vz = v[2] + (w[0] * r[1] - w[1] * r[0])
          const vt = Math.hypot(vx, vz)
          if (vt > 1e-5) {
            const tx = vx / vt
            const tz = vz / vt
            // r x t with t = (tx, 0, tz) = (0*tz - rz*0 ... ) -> (ry*tz, rz*tx - rx*tz, -ry*tx)
            const rx = r[1] * tz
            const ry = r[2] * tx - r[0] * tz
            const rz = -r[1] * tx
            const at = this.mulInvInertiaWith(b, e, rx, ry, rz)
            const cx = at[1] * r[2] - at[2] * r[1]
            const cz = at[0] * r[1] - at[1] * r[0]
            const denomT = invM + cx * tx + cz * tz
            const jt = Math.min(vt / denomT, MU * j)
            v[0] -= tx * jt * invM
            v[2] -= tz * jt * invM
            const dwt = this.mulInvInertiaWith(b, e, rx * jt, ry * jt, rz * jt)
            w[0] -= dwt[0]
            w[1] -= dwt[1]
            w[2] -= dwt[2]
          }
        }
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
    if (still) {
      b.still += dt
      if (b.still >= SLEEP_AFTER) {
        b.sleeping = true
        v[0] = v[1] = v[2] = 0
        w[0] = w[1] = w[2] = 0
      }
    } else {
      b.still = 0
    }
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
        if (a.held && b.held) continue
        if (a.sleeping && b.sleeping) continue
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
        const wa = a.held ? 0 : b.held ? 1 : b.mass / (a.mass + b.mass)
        const wb = b.held ? 0 : a.held ? 1 : a.mass / (a.mass + b.mass)
        const ux = dx / (d || 1)
        const uz = dz / (d || 1)
        if (!a.held) {
          a.root.position.x -= ux * push * 2 * wa
          a.root.position.z -= uz * push * 2 * wa
          a.sleeping = false
        }
        if (!b.held) {
          b.root.position.x += ux * push * 2 * wb
          b.root.position.z += uz * push * 2 * wb
          b.sleeping = false
        }
      }
    }
  }
}
