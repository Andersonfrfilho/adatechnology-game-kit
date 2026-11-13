import type { JointDesc, PhysicsWorld, Vec3 } from '@adatechnology/game-physics'

/** The 17 segments of game-characters' rig for a 1.75 m adult (64.3 kg), joints and radii from `body-spec.ts`, mass shares from `describe.ts`. */
interface Segment {
  readonly id: string
  readonly parent: string | null
  /** Joint to the parent, world (rest pose, standing on y = 0). */
  readonly joint: Vec3
  /** Cylinder down to the first child's joint, or a sphere. */
  readonly end: Vec3 | null
  readonly radius: number
  readonly kg: number
}

const SEGMENTS: readonly Segment[] = [
  { id: 'pelvis', parent: null, joint: [0, 0.8944, 0], end: [0, 1.0208, 0], radius: 0.1556, kg: 9.006 },
  { id: 'torso', parent: 'pelvis', joint: [0, 1.0208, 0], end: [0, 1.5167, 0], radius: 0.1653, kg: 21.87 },
  { id: 'neck', parent: 'torso', joint: [0, 1.5167, 0], end: [0, 1.5944, 0], radius: 0.0583, kg: 1.287 },
  { id: 'head', parent: 'neck', joint: [0, 1.5944, 0], end: null, radius: 0.0972, kg: 4.503 },
  { id: 'jaw', parent: 'head', joint: [0, 1.6139, 0.0583], end: null, radius: 0.0486, kg: 0.643 },
  ...([1, -1] as const).flatMap((s) => {
    const x = 0.2965 * s
    const side = s > 0 ? 'L' : 'R'
    return [
      { id: `upperArm${side}`, parent: 'torso', joint: [x, 1.434, 0] as Vec3, end: [x, 1.1326, 0] as Vec3, radius: 0.0826, kg: 1.801 },
      { id: `forearm${side}`, parent: `upperArm${side}`, joint: [x, 1.1326, 0] as Vec3, end: [x, 0.841, 0] as Vec3, radius: 0.0632, kg: 1.029 },
      { id: `hand${side}`, parent: `forearm${side}`, joint: [x, 0.841, 0] as Vec3, end: null, radius: 0.0486, kg: 0.386 },
      { id: `thigh${side}`, parent: 'pelvis', joint: [0.1021 * s, 0.875, 0] as Vec3, end: [0.1021 * s, 0.4667, 0] as Vec3, radius: 0.0972, kg: 6.433 },
      { id: `shin${side}`, parent: `thigh${side}`, joint: [0.1021 * s, 0.4667, 0] as Vec3, end: [0.1021 * s, 0.0972, 0] as Vec3, radius: 0.0778, kg: 2.895 },
      { id: `foot${side}`, parent: `shin${side}`, joint: [0.1021 * s, 0.0972, 0] as Vec3, end: null, radius: 0.0486, kg: 0.965 },
    ]
  }),
]

/** Limits (rad): hinges about x (knee bends back, elbow forward), balls by twist (along the bone) and two swings. */
const LIMITS: Record<string, Pick<JointDesc, 'kind' | 'axis' | 'range' | 'limits'>> = {
  torso: { kind: 'ball', axis: [0, 1, 0], limits: { twist: [-0.5, 0.5], swingY: [-0.5, 0.5], swingZ: [-0.6, 0.6] } },
  neck: { kind: 'ball', axis: [0, 1, 0], limits: { twist: [-0.6, 0.6], swingY: [-0.4, 0.4], swingZ: [-0.5, 0.5] } },
  head: { kind: 'ball', axis: [0, 1, 0], limits: { twist: [-0.6, 0.6], swingY: [-0.4, 0.4], swingZ: [-0.4, 0.4] } },
  jaw: { kind: 'hinge', axis: [1, 0, 0], range: [0, 0.4] },
  upperArm: { kind: 'ball', axis: [0, 1, 0], limits: { twist: [-1, 1], swingY: [-1.5, 1.5], swingZ: [-1.5, 1.5] } },
  forearm: { kind: 'hinge', axis: [1, 0, 0], range: [-2.5, 0] },
  hand: { kind: 'ball', axis: [0, 1, 0], limits: { twist: [-0.8, 0.8], swingY: [-0.6, 0.6], swingZ: [-0.6, 0.6] } },
  thigh: { kind: 'ball', axis: [0, 1, 0], limits: { twist: [-0.5, 0.5], swingY: [-0.6, 0.6], swingZ: [-1.8, 0.4] } },
  shin: { kind: 'hinge', axis: [1, 0, 0], range: [0, 2.4] },
  foot: { kind: 'hinge', axis: [1, 0, 0], range: [-0.6, 0.6] },
}

export interface Ragdoll {
  readonly bodies: ReadonlyMap<string, number>
  readonly joints: ReadonlyArray<{ readonly child: string; readonly parent: string; readonly kind: string; readonly anchorChild: Vec3; readonly anchorParent: Vec3; readonly range?: readonly [number, number] }>
  readonly mass: number
}

/** Layers: a ragdoll is on layer 2 and meets the world (1) and other ragdolls (2); its adjacent segments do not touch (joint contacts off); the jaw, inside the neck at rest, meets only the world. */
export const buildRagdoll = (w: PhysicsWorld, at: Vec3, tagBase: number, layer = 2, meets = 0xffff): Ragdoll => {
  const bodies = new Map<string, number>()
  const centre = new Map<string, Vec3>()
  let mass = 0
  SEGMENTS.forEach((s, k) => {
    const c: Vec3 = s.end ? [(s.joint[0] + s.end[0]) / 2, (s.joint[1] + s.end[1]) / 2, (s.joint[2] + s.end[2]) / 2] : s.id === 'head' ? [s.joint[0], s.joint[1] + s.radius, s.joint[2]] : s.id === 'jaw' ? [...s.joint] : [s.joint[0], s.joint[1] - s.radius, s.joint[2]]
    const len = s.end ? Math.abs(s.joint[1] - s.end[1]) : 0
    const r = s.radius
    const m = s.kg
    mass += m
    const inertia: Vec3 = s.end ? [(m * (3 * r * r + len * len)) / 12, (m * r * r) / 2, (m * (3 * r * r + len * len)) / 12] : [0.4 * m * r * r, 0.4 * m * r * r, 0.4 * m * r * r]
    const shape = s.end ? { kind: 'capsule' as const, halfHeight: Math.max(0.001, len / 2 - r * 0.5), radius: r * 0.9 } : { kind: 'sphere' as const, radius: r }
    const world: Vec3 = [c[0] + at[0], c[1] + at[1], c[2] + at[2]]
    centre.set(s.id, world)
    bodies.set(s.id, w.createBody({ kind: 'dynamic', position: world, mass: m, inertia, angularDamping: 0.3, linearDamping: 0.05, ccd: s.id === 'head', colliders: [{ shape, tag: tagBase + k, layer, meets: s.id === 'jaw' ? 1 : meets, surface: { friction: { static: 0.8, dynamic: 0.6 }, restitution: 0 } }] }))
  })
  const joints: Array<Ragdoll['joints'][number]> = []
  for (const s of SEGMENTS) {
    if (!s.parent) continue
    const limit = LIMITS[s.id.replace(/[LR]$/, '')]
    const a = bodies.get(s.parent)
    const b = bodies.get(s.id)
    const ca = centre.get(s.parent)
    const cb = centre.get(s.id)
    if (a === undefined || b === undefined || !ca || !cb) continue
    const j: Vec3 = [s.joint[0] + at[0], s.joint[1] + at[1], s.joint[2] + at[2]]
    const anchorParent: Vec3 = [j[0] - ca[0], j[1] - ca[1], j[2] - ca[2]]
    const anchorChild: Vec3 = [j[0] - cb[0], j[1] - cb[1], j[2] - cb[2]]
    w.createJoint({ ...limit, a, b, anchorA: anchorParent, anchorB: anchorChild, contacts: false })
    joints.push({ child: s.id, parent: s.parent, kind: limit.kind, anchorChild, anchorParent, range: limit.range })
  }
  return { bodies, joints, mass }
}

const rotate = (q: Float64Array, at: number, v: Vec3): Vec3 => {
  const x = q[at + 3], y = q[at + 4], z = q[at + 5], w = q[at + 6]
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0])
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]
}

/** The worst joint drift (m: the two anchors apart) and the worst hinge out of its range (rad), now. */
export const jointErrors = (w: PhysicsWorld, r: Ragdoll): { drift: number; overLimit: number; worst: string } => {
  const p = new Float64Array(14)
  let drift = 0
  let over = 0
  let worst = ''
  for (const j of r.joints) {
    w.readPose(r.bodies.get(j.parent) ?? -1, p, 0)
    w.readPose(r.bodies.get(j.child) ?? -1, p, 7)
    const ap = rotate(p, 0, j.anchorParent)
    const ac = rotate(p, 7, j.anchorChild)
    const d = Math.hypot(p[0] + ap[0] - p[7] - ac[0], p[1] + ap[1] - p[8] - ac[1], p[2] + ap[2] - p[9] - ac[2])
    if (d > drift) {
      drift = d
      worst = `drift ${j.child}`
    }
    if (j.kind === 'hinge' && j.range) {
      // relative rotation parent^-1 * child, its angle about x
      const [ax, ay, az, aw] = [p[3], p[4], p[5], p[6]]
      const [bx, by, bz, bw] = [p[10], p[11], p[12], p[13]]
      const rx = aw * bx - ax * bw - ay * bz + az * by
      const rw = aw * bw + ax * bx + ay * by + az * bz
      const sign = rw < 0 ? -1 : 1
      const angle = 2 * Math.atan2(rx * sign, rw * sign)
      const o = Math.max(j.range[0] - angle, angle - j.range[1])
      if (o > over) {
        over = o
        worst += ` over ${j.child} ${angle.toFixed(2)}`
      }
    }
  }
  return { drift, overLimit: Math.max(0, over), worst }
}
