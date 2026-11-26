import type { BodyId, JointId, Quat, SeamWorld, Vec3 } from '@adatechnology/game-physics'

/** A chain of boxes along a polyline, each joined to the one before by a swing-twist joint: a cord, a cable, a strip of a curtain. */
export interface ChainSpec {
  /** From the start to the end of the chain; one link between each two points. */
  readonly points: readonly Vec3[]
  /** Half the width and the depth of a link (m); its length is the segment's. */
  readonly halfWidth: number
  readonly halfDepth: number
  readonly totalMass: number
  /** What the first link hangs from (a static body, or a kinematic one a host moves). */
  readonly startBody: BodyId
  /** What the last link is tied to; undefined: it hangs free. */
  readonly endBody?: BodyId
  /** Half cone of every joint (radians) and the most it twists either way. */
  readonly halfCone: number
  readonly twist: number
  /** Torque (N m) that holds a joint still against the swing: the chain's stiffness at rest. */
  readonly jointFriction: number
  /** Share of velocity lost per second by every link (the air, the cloth). */
  readonly damping: number
}

export interface Chain {
  readonly bodies: readonly BodyId[]
  readonly joints: readonly JointId[]
  /** Half the length of each link, for reading its ends. */
  readonly halfLengths: readonly number[]
  /** The collision group the links share (released with the chain). */
  readonly group: number
}

const UP: Vec3 = [0, 1, 0]

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const length = (v: Vec3): number => Math.hypot(v[0], v[1], v[2])
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** The turn that takes +y (a link's length) onto `direction` (unit). */
export function alignY(direction: Vec3): Quat {
  const axis = cross(UP, direction)
  const sine = length(axis)
  if (sine < 1e-9) return direction[1] >= 0 ? [0, 0, 0, 1] : [1, 0, 0, 0]
  const angle = Math.atan2(sine, direction[1])
  const half = Math.sin(angle / 2) / sine
  return [axis[0] * half, axis[1] * half, axis[2] * half, Math.cos(angle / 2)]
}

/** A vector turned by a unit quaternion. */
export function rotateByQuat(v: Vec3, q: Quat): Vec3 {
  const [x, y, z, w] = q
  const tx = 2 * (y * v[2] - z * v[1])
  const ty = 2 * (z * v[0] - x * v[2])
  const tz = 2 * (x * v[1] - y * v[0])
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]
}

const perpendicular = (direction: Vec3): Vec3 => {
  const side = Math.abs(direction[0]) < 0.9 ? cross(direction, [1, 0, 0]) : cross(direction, [0, 0, 1])
  const size = length(side)
  return [side[0] / size, side[1] / size, side[2] / size]
}

/** Builds the links and joints of a chain in the world, in the pose its points give (so a cord starts already sagging). */
export function buildChain(world: SeamWorld, spec: ChainSpec): Chain {
  const count = spec.points.length - 1
  const lengths = Array.from({ length: count }, (_, i) => length(sub(spec.points[i + 1] as Vec3, spec.points[i] as Vec3)))
  const total = lengths.reduce((sum, each) => sum + each, 0)
  const pairs: Array<readonly [number, number]> = []
  for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) pairs.push([a, b])
  const group = world.createGroup(count, pairs)
  const bodies: BodyId[] = []
  const joints: JointId[] = []
  for (let i = 0; i < count; i++) {
    const from = spec.points[i] as Vec3
    const to = spec.points[i + 1] as Vec3
    const span = lengths[i] as number
    const direction: Vec3 = [(to[0] - from[0]) / span, (to[1] - from[1]) / span, (to[2] - from[2]) / span]
    const link = world.createBody({
      shape: { kind: 'box', half: [spec.halfWidth, span / 2, spec.halfDepth] },
      motion: 'dynamic',
      mass: spec.totalMass * (span / total),
      position: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
      rotation: alignY(direction),
      layer: 'debris',
      group: { id: group, sub: i },
      linearDamping: spec.damping,
      angularDamping: spec.damping,
      user: -4,
    })
    const previous = i === 0 ? spec.startBody : (bodies[i - 1] as BodyId)
    if (i === 0) world.ignorePair(spec.startBody, link, true)
    joints.push(world.createJoint(swingTwist(spec, previous, link, from, direction)))
    bodies.push(link)
  }
  if (spec.endBody !== undefined) {
    const last = spec.points[count] as Vec3
    const direction = sub(last, spec.points[count - 1] as Vec3)
    const size = length(direction)
    world.ignorePair(spec.endBody, bodies[count - 1] as BodyId, true)
    joints.push(world.createJoint(swingTwist(spec, bodies[count - 1] as BodyId, spec.endBody, last, [direction[0] / size, direction[1] / size, direction[2] / size])))
  }
  return { bodies, joints, halfLengths: lengths.map((each) => each / 2), group }
}

/** Takes a chain out of the world: its joints, its links, then the group the links shared. */
export function disposeChain(world: SeamWorld, chain: Chain): void {
  for (const joint of chain.joints) world.removeJoint(joint)
  for (const body of chain.bodies) world.removeBody(body)
  world.releaseGroup(chain.group)
}

const swingTwist = (spec: ChainSpec, a: BodyId, b: BodyId, point: Vec3, direction: Vec3) => ({
  kind: 'swingTwist' as const,
  a,
  b,
  point,
  twistAxis: direction,
  planeAxis: perpendicular(direction),
  normalHalfCone: spec.halfCone,
  planeHalfCone: spec.halfCone,
  twistMin: -spec.twist,
  twistMax: spec.twist,
  friction: spec.jointFriction,
})

const pose = new Float64Array(7)

/** The end of link `index` now (x, y, z into `out` at `offset`): the body's centre moved half the link's length along its own +y (the unit quaternion's y axis, unrolled). */
const writeLinkEnd = (world: SeamWorld, chain: Chain, index: number, sign: 1 | -1, out: Float64Array, offset: number): void => {
  world.readPose(chain.bodies[index] as BodyId, pose, 0)
  const x = pose[3] as number
  const y = pose[4] as number
  const z = pose[5] as number
  const w = pose[6] as number
  const half = (chain.halfLengths[index] as number) * sign
  out[offset] = (pose[0] as number) + half * 2 * (x * y - w * z)
  out[offset + 1] = (pose[1] as number) + half * (1 - 2 * (x * x + z * z))
  out[offset + 2] = (pose[2] as number) + half * 2 * (y * z + w * x)
}

/** The two ends of every link now, as a polyline (x, y, z per point) for a host that draws the cord: the points a chain was built from, moved. */
export function chainPoints(world: SeamWorld, chain: Chain, out: Float64Array): void {
  const count = chain.bodies.length
  writeLinkEnd(world, chain, 0, -1, out, 0)
  for (let i = 0; i < count; i++) writeLinkEnd(world, chain, i, 1, out, (i + 1) * 3)
}

/** Only the free end of the chain (x, y, z into `out`): one pose read, for a host that wants where the tip is and not the whole line. */
export function chainEnd(world: SeamWorld, chain: Chain, out: Float64Array): void {
  writeLinkEnd(world, chain, chain.bodies.length - 1, 1, out, 0)
}
