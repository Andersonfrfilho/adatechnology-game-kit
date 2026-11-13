import type { Vec3 } from '@adatechnology/game-destruction'
import type { PieceFriction } from './internal'

/**
 * Contacts of the loose pieces solved together by sequential impulses (Catto, "Iterative Dynamics with Temporal Coherence", the Box2D and Bullet contact solver): every
 * contact of a substep (a point on the ground, a corner of one piece on the face of another) keeps the push it has given so far (pushing only) and its friction (up to
 * mu times that push, Coulomb), and each pass corrects them, so a sheet across four plates shares its weight among them, and the plates feel it.
 *
 * Contacts are found before the move with a margin (speculative contacts): two that are `sep` apart may close at most `sep` in the substep, so they meet without
 * passing into each other, and nothing is ever pushed out of an overlap by a velocity (what would launch it). What overlaps anyway (born inside, turned into it) is put
 * apart by position, a share per substep (`correctPositions`), never by speed.
 */

/** A body as the solver sees it: its speeds (the piece's own arrays, changed in place), its inverse mass and inverse inertia in the world; 0 for what does not move. */
export interface SolverBody {
  readonly v: Vec3
  readonly w: Vec3
  readonly invMass: number
  /** I^-1 x (world); zero for a body that does not move. */
  readonly invInertia: (x: number, y: number, z: number) => Vec3
  /** Moves the centre of mass by `d` and turns the body by the rotation vector `turn` (rad): the position pass. Adds them to `moved` and `turned`. */
  readonly shift: (d: Vec3, turn: Vec3) => void
  /** How far the centre of mass has moved and the body turned (rotation vector) since the start of the substep. */
  readonly moved: Vec3
  readonly turned: Vec3
}

/** One contact point between `a` and `b` (null: the ground or something fixed). The normal points from `b` to `a`: a push along it moves `a` away from `b`. */
export interface SolverContact {
  readonly a: SolverBody
  readonly b: SolverBody | null
  /** From the centre of mass of each to the point (world). */
  readonly ra: Vec3
  readonly rb: Vec3
  readonly n: Vec3
  /** Gap along `n` at the start of the substep: positive apart, negative into each other. */
  sep: number
  /** Normal speed the contact aims for when it is closing (restitution), m/s. */
  readonly bounce: number
  readonly mu: PieceFriction
  /** Sliding at the start of the substep: it drags with the dynamic friction, else holds with the static one. */
  readonly slipping: boolean
  accN: number
  accT: Vec3
}

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** Velocity of the point at `r` of a body. */
const pointVelocity = (body: SolverBody, r: Vec3): Vec3 => {
  const v = body.v
  const w = body.w
  return [v[0] + w[1] * r[2] - w[2] * r[1], v[1] + w[2] * r[0] - w[0] * r[2], v[2] + w[0] * r[1] - w[1] * r[0]]
}

/** Velocity of `a` against `b` at the contact. */
const relative = (c: SolverContact): Vec3 => {
  const va = pointVelocity(c.a, c.ra)
  if (!c.b) return va
  const vb = pointVelocity(c.b, c.rb)
  return [va[0] - vb[0], va[1] - vb[1], va[2] - vb[2]]
}

/** 1 / effective mass of the pair along the unit `d` at the contact: 1/m_a + (I_a^-1 (r_a x d) x r_a) . d + the same for b. */
const resistance = (c: SolverContact, d: Vec3): number => {
  const ta = c.a.invInertia(...cross(c.ra, d))
  let k = c.a.invMass + dot(cross(ta, c.ra), d)
  if (c.b) {
    const tb = c.b.invInertia(...cross(c.rb, d))
    k += c.b.invMass + dot(cross(tb, c.rb), d)
  }
  return k
}

/** Gives the impulse `j` (world) to `a` at the contact and its opposite to `b`. */
const apply = (c: SolverContact, j: Vec3): void => {
  const a = c.a
  for (let i = 0; i < 3; i++) a.v[i] += j[i] * a.invMass
  const dwa = a.invInertia(...cross(c.ra, j))
  for (let i = 0; i < 3; i++) a.w[i] += dwa[i]
  const b = c.b
  if (!b) return
  for (let i = 0; i < 3; i++) b.v[i] -= j[i] * b.invMass
  const dwb = b.invInertia(...cross(c.rb, j))
  for (let i = 0; i < 3; i++) b.w[i] -= dwb[i]
}

/** Starts every contact from the impulses it kept from the last substep (warm start): a resting stack carries its weight from the first pass. */
export const warmStart = (contacts: readonly SolverContact[]): void => {
  for (const c of contacts) {
    if (c.accN === 0 && c.accT[0] === 0 && c.accT[1] === 0 && c.accT[2] === 0) continue
    apply(c, [c.n[0] * c.accN + c.accT[0], c.n[1] * c.accN + c.accT[1], c.n[2] * c.accN + c.accT[2]])
  }
}

/**
 * `passes` rounds over all the contacts of the substep `h`. The normal impulse aims for the contact's `bounce` (closing) or, when the two are still `sep` apart, lets them
 * close by no more than that gap in the substep; it never pulls. Friction in the plane of the contact, up to the static or dynamic coefficient times the push.
 */
export const solveContacts = (contacts: readonly SolverContact[], h: number, passes: number): void => {
  for (let it = 0; it < passes; it++) {
    for (const c of contacts) {
      const n = c.n
      const vn = dot(relative(c), n)
      const goal = c.sep > 0 ? -c.sep / h : c.bounce
      const total = Math.max(0, c.accN + (goal - vn) / resistance(c, n))
      const j = total - c.accN
      c.accN = total
      if (j !== 0) apply(c, [n[0] * j, n[1] * j, n[2] * j])
      const rv = relative(c)
      const rn = dot(rv, n)
      const vt: Vec3 = [rv[0] - rn * n[0], rv[1] - rn * n[1], rv[2] - rn * n[2]]
      const speed = Math.hypot(vt[0], vt[1], vt[2])
      const f: Vec3 = [c.accT[0], c.accT[1], c.accT[2]]
      if (speed > 1e-6) {
        const d: Vec3 = [vt[0] / speed, vt[1] / speed, vt[2] / speed]
        const jt = speed / resistance(c, d)
        f[0] -= d[0] * jt
        f[1] -= d[1] * jt
        f[2] -= d[2] * jt
      } else if (f[0] === 0 && f[1] === 0 && f[2] === 0) continue
      const fl = Math.hypot(f[0], f[1], f[2])
      const most = (c.slipping ? c.mu.dynamic : c.mu.static) * c.accN
      if (fl > most) {
        const k = fl > 0 ? most / fl : 0
        f[0] *= k
        f[1] *= k
        f[2] *= k
      }
      const dj: Vec3 = [f[0] - c.accT[0], f[1] - c.accT[1], f[2] - c.accT[2]]
      c.accT = f
      if (dj[0] !== 0 || dj[1] !== 0 || dj[2] !== 0) apply(c, dj)
    }
  }
}

/** How hard the position pass pushes one kind of contact out: what overlap it leaves (`slop`), the share of the rest per round (`beta`) and the most per round (m). */
export interface PositionRule {
  readonly slop: number
  readonly beta: number
  readonly most: number
}

/** How far the point at `r` of a body has moved this substep (its move and the position pass so far). */
const displacement = (body: SolverBody, r: Vec3): Vec3 => {
  const d = body.moved
  const t = body.turned
  return [d[0] + t[1] * r[2] - t[2] * r[1], d[1] + t[2] * r[0] - t[0] * r[2], d[2] + t[0] * r[1] - t[1] * r[0]]
}

/**
 * The position pass (non-linear Gauss-Seidel, as Box2D's): every contact still more than its `slop` into the other after the move (its gap at the start of the substep,
 * taken forward by how far each side has moved since, `moved` and `turned`) is put a share of the way out, as a push at the contact point that moves and turns the two
 * bodies by their shares. All contacts together, over `rounds`: a plate pinned between the ground and a sheet does not go into the ground, the sheet goes up. No speed is given.
 */
export const correctPositions = (contacts: readonly SolverContact[], rounds: number, rules: { world: PositionRule; pair: PositionRule }): void => {
  for (let round = 0; round < rounds; round++) {
    for (const c of contacts) {
      const rule = c.b ? rules.pair : rules.world
      const da = displacement(c.a, c.ra)
      const db = c.b ? displacement(c.b, c.rb) : [0, 0, 0]
      const sep = c.sep + (da[0] - db[0]) * c.n[0] + (da[1] - db[1]) * c.n[1] + (da[2] - db[2]) * c.n[2]
      if (sep >= -rule.slop) continue
      const depth = Math.min(rule.most, rule.beta * (-sep - rule.slop))
      const k = resistance(c, c.n)
      if (k <= 0) continue
      const p = depth / k
      const n = c.n
      const ta = c.a.invInertia(...cross(c.ra, n))
      c.a.shift([n[0] * p * c.a.invMass, n[1] * p * c.a.invMass, n[2] * p * c.a.invMass], [ta[0] * p, ta[1] * p, ta[2] * p])
      if (!c.b) continue
      const tb = c.b.invInertia(...cross(c.rb, n))
      c.b.shift([-n[0] * p * c.b.invMass, -n[1] * p * c.b.invMass, -n[2] * p * c.b.invMass], [-tb[0] * p, -tb[1] * p, -tb[2] * p])
    }
  }
}

/** A box as the manifold sees it: centre, rotation columns (`Matrix4.elements`) and half extents. */
export interface ManifoldBox {
  readonly c: Vec3
  readonly e: ArrayLike<number>
  readonly half: Vec3
}

/** A point where two boxes touch or are about to: on `a` (side 0) or on `b` (side 1), its gap along the normal (negative inside), and which corner it is (for the warm start). */
export interface ManifoldPoint {
  readonly point: Vec3
  readonly sep: number
  readonly feature: number
}

export interface BoxManifold {
  /** From `b` to `a`. */
  readonly normal: Vec3
  /** Overlap along the normal: negative when they are still that far apart. */
  readonly depth: number
  readonly points: ManifoldPoint[]
}

/** An edge axis wins over a face axis only when it overlaps this much less: two faces flat on each other stay face to face (as `boxBox`). */
const EDGE_BIAS = 0.95
const axisOf = (e: ArrayLike<number>, k: number): Vec3 => [e[k * 4], e[k * 4 + 1], e[k * 4 + 2]]
const reachAlong = (box: ManifoldBox, l: Vec3): number =>
  box.half[0] * Math.abs(dot(axisOf(box.e, 0), l)) + box.half[1] * Math.abs(dot(axisOf(box.e, 1), l)) + box.half[2] * Math.abs(dot(axisOf(box.e, 2), l))
/**
 * Two boxes by their separating axes, apart by up to `margin` included: the axis of least overlap (most apart, when apart) is the normal, from `b` to `a`. The points are
 * the corners of each within `margin` of the other's face along the normal and over that face (a corner of a sheet on a plate, the top edge of a plate under the sheet);
 * crossed edges, where no corner is over a face, meet at the middle of the overlap.
 */
export const boxManifold = (a: ManifoldBox, b: ManifoldBox, margin: number): BoxManifold | null => {
  const d: Vec3 = [a.c[0] - b.c[0], a.c[1] - b.c[1], a.c[2] - b.c[2]]
  let normal: Vec3 = [0, 1, 0]
  let depth = Infinity
  let faceDepth = Infinity
  // which axis won: 0-2 a face of a, 3-5 a face of b, 6 + 3 i + j the cross of a's edge i and b's edge j
  let which = -1
  const tryAxis = (l: Vec3, id: number): boolean => {
    const face = id < 6
    const centres = dot(d, l)
    const overlap = reachAlong(a, l) + reachAlong(b, l) - Math.abs(centres)
    if (overlap < -margin) return false
    if (face ? overlap < depth : overlap < depth && overlap < (faceDepth >= 0 ? faceDepth * EDGE_BIAS : faceDepth - 1e-3)) {
      depth = overlap
      if (face) faceDepth = overlap
      normal = centres < 0 ? [-l[0], -l[1], -l[2]] : l
      which = id
    }
    return true
  }
  for (let k = 0; k < 3; k++) if (!tryAxis(axisOf(a.e, k), k) || !tryAxis(axisOf(b.e, k), 3 + k)) return null
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const l = cross(axisOf(a.e, i), axisOf(b.e, j))
      const len = Math.hypot(l[0], l[1], l[2])
      if (len < 1e-6) continue
      if (!tryAxis([l[0] / len, l[1] / len, l[2] / len], 6 + 3 * i + j)) return null
    }
  }
  const n = normal
  if (which >= 6) return { normal: n, depth, points: [edgeContact(a, b, n, Math.floor((which - 6) / 3), (which - 6) % 3, depth)] }
  // a face of one (the reference) against the face of the other most turned to it (the incident), clipped to the reference face's sides
  const onB = which >= 3
  const ref = onB ? b : a
  const inc = onB ? a : b
  const refNormal: Vec3 = onB ? n : [-n[0], -n[1], -n[2]]
  const refAxis = onB ? which - 3 : which
  const refPoint: Vec3 = (() => {
    const ax = axisOf(ref.e, refAxis)
    const s = dot(ax, refNormal) > 0 ? ref.half[refAxis] : -ref.half[refAxis]
    return [ref.c[0] + ax[0] * s, ref.c[1] + ax[1] * s, ref.c[2] + ax[2] * s]
  })()
  let incAxis = 0
  let most = -Infinity
  for (let k = 0; k < 3; k++) {
    const t = Math.abs(dot(axisOf(inc.e, k), refNormal))
    if (t > most) {
      most = t
      incAxis = k
    }
  }
  const incDir = axisOf(inc.e, incAxis)
  const incSign = dot(incDir, refNormal) > 0 ? -1 : 1
  const u = (incAxis + 1) % 3
  const v = (incAxis + 2) % 3
  const au = axisOf(inc.e, u)
  const av = axisOf(inc.e, v)
  const fc: Vec3 = [inc.c[0] + incDir[0] * incSign * inc.half[incAxis], inc.c[1] + incDir[1] * incSign * inc.half[incAxis], inc.c[2] + incDir[2] * incSign * inc.half[incAxis]]
  let poly: Vec3[] = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ].map(([su, sv]): Vec3 => [
    fc[0] + au[0] * su * inc.half[u] + av[0] * sv * inc.half[v],
    fc[1] + au[1] * su * inc.half[u] + av[1] * sv * inc.half[v],
    fc[2] + au[2] * su * inc.half[u] + av[2] * sv * inc.half[v],
  ])
  for (let k = 0; k < 3 && poly.length > 0; k++) {
    if (k === refAxis) continue
    const side = axisOf(ref.e, k)
    const centre = dot(side, ref.c)
    poly = clip(poly, side, centre + ref.half[k])
    poly = clip(poly, [-side[0], -side[1], -side[2]], -(centre - ref.half[k]))
  }
  const points: ManifoldPoint[] = []
  poly.forEach((p, i) => {
    const sep = dot([p[0] - refPoint[0], p[1] - refPoint[1], p[2] - refPoint[2]], refNormal)
    if (sep < margin) points.push({ point: p, sep, feature: (onB ? 0 : 16) + i })
  })
  if (points.length === 0) return null
  return { normal: n, depth, points }
}

/** The part of the polygon on the inner side of the plane `dot(x, normal) <= offset` (Sutherland-Hodgman). */
const clip = (poly: Vec3[], normal: Vec3, offset: number): Vec3[] => {
  const out: Vec3[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const dp = dot(p, normal) - offset
    const dq = dot(q, normal) - offset
    if (dp <= 0) out.push(p)
    if (dp <= 0 !== dq <= 0) {
      const t = dp / (dp - dq)
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t])
    }
  }
  return out
}

/** Two crossed edges (the separating axis is the cross of a's edge `i` and b's edge `j`): they meet midway between the nearest points of the two edges that reach furthest into each other. */
const edgeContact = (a: ManifoldBox, b: ManifoldBox, n: Vec3, i: number, j: number, depth: number): ManifoldPoint => {
  // a's edge along axis i on its side toward b (-n), b's along axis j on its side toward a (+n)
  const edgeOf = (box: ManifoldBox, axis: number, toward: number): [Vec3, Vec3] => {
    const c: Vec3 = [box.c[0], box.c[1], box.c[2]]
    for (let k = 0; k < 3; k++) {
      if (k === axis) continue
      const ax = axisOf(box.e, k)
      const s = dot(ax, n) * toward > 0 ? box.half[k] : -box.half[k]
      for (let m = 0; m < 3; m++) c[m] += ax[m] * s
    }
    const along = axisOf(box.e, axis)
    const h = box.half[axis]
    return [
      [c[0] - along[0] * h, c[1] - along[1] * h, c[2] - along[2] * h],
      [c[0] + along[0] * h, c[1] + along[1] * h, c[2] + along[2] * h],
    ]
  }
  const [p1, q1] = edgeOf(a, i, -1)
  const [p2, q2] = edgeOf(b, j, 1)
  const d1: Vec3 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]]
  const d2: Vec3 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]]
  const r: Vec3 = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]]
  const aa = dot(d1, d1)
  const ee = dot(d2, d2)
  const bb = dot(d1, d2)
  const cc = dot(d1, r)
  const ff = dot(d2, r)
  const denom = aa * ee - bb * bb
  const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
  let s = denom > 1e-12 ? clamp01((bb * ff - cc * ee) / denom) : 0
  let t = (bb * s + ff) / ee
  if (t < 0) {
    t = 0
    s = clamp01(-cc / aa)
  } else if (t > 1) {
    t = 1
    s = clamp01((bb - cc) / aa)
  }
  const x: Vec3 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s]
  const y: Vec3 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t]
  return { point: [(x[0] + y[0]) / 2, (x[1] + y[1]) / 2, (x[2] + y[2]) / 2], sep: -depth, feature: 32 + 3 * i + j }
}
