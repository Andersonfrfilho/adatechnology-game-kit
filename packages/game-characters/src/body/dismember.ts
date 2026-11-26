import type { BodyId, PhysicsWorld } from '@adatechnology/game-physics'

import { dollOf } from './doll'
import type { Doll, DollPart } from './doll'
import { dollsOfWhole, piecesOfCarrier, shrunkShape, withoutParts } from './dismember-parts'
import { liveOf, rotateBy, velocityAt, moveOf } from './rigid'
import { SEGMENT_IDS, segmentsBelow } from './segment-tree'
import type { SegmentId } from './segment-tree'

/** What is left and what came off: each piece a doll of its own, the bodies of one engine ragdoll or of a new one. */
export type Dismembered = { readonly remaining: Doll; readonly severed: readonly Doll[] }

const MINIMUM_HALF_HEIGHT = 0.01

/** Nothing the cut made meets what it was part of: those pairs never collided jointed, and the pieces now stand where the limb was. */
const ignoreAmong = (world: PhysicsWorld, bodies: readonly BodyId[]): void => {
  bodies.forEach((a, at) => bodies.slice(at + 1).forEach((b) => world.ignorePair(a, b, true)))
}

const takenOf = (part: DollPart, group: ReadonlySet<SegmentId>): SegmentId[] => part.segments.filter((id) => group.has(id))

/** A carrier gives up the mass of what it carried (its share of the engine's mass): its shape shrinks to match, `setShape` keeping that mass. */
const shrinkCarrier = (world: PhysicsWorld, doll: Doll, part: DollPart, taken: readonly SegmentId[]): DollPart => {
  const takenMass = taken.reduce((sum, id) => sum + (doll.designed[SEGMENT_IDS.indexOf(id)]?.body.mass ?? 0), 0)
  const fraction = (part.mass - takenMass) / part.mass
  const shape = shrunkShape(part.shape, fraction)
  world.setShape(part.body, shape, { mass: world.massOf(part.body) * fraction })
  return { ...part, shape, mass: part.mass - takenMass, segments: part.segments.filter((id) => !taken.includes(id)) }
}

/** The parts wholly in `group` leave with their joints to what stays cut; those only partly in it stay and give up the mass; the rest of the group is drawn as new bodies. */
const detach = (world: PhysicsWorld, doll: Doll, group: ReadonlySet<SegmentId>): Dismembered & { readonly touching: BodyId[] } => {
  const indices = doll.parts.map((_, index) => index)
  const whole = indices.filter((index) => {
    const part = doll.parts[index] as DollPart
    return takenOf(part, group).length === part.segments.length && part.segments.length > 0
  })
  const partial = indices.filter((index) => !whole.includes(index) && takenOf(doll.parts[index] as DollPart, group).length > 0)
  if (whole.includes(0)) throw new Error('game-characters: the root of a body is not torn off')
  for (const index of whole) {
    const part = doll.parts[index] as DollPart
    if (part.joint && !whole.includes(part.parent)) world.removeJoint(part.joint)
  }
  const pieces = partial.flatMap((index) => {
    const carrier = doll.parts[index] as DollPart
    return piecesOfCarrier({ world, doll, carrier, taken: takenOf(carrier, group), massScale: world.massOf(carrier.body) / carrier.mass })
  })
  const shrunk = new Map(partial.map((index) => [index, shrinkCarrier(world, doll, doll.parts[index] as DollPart, takenOf(doll.parts[index] as DollPart, group))]))
  const severed = [...dollsOfWhole(doll, whole), ...pieces]
  const kept = withoutParts({ ...doll, parts: doll.parts.map((part, index) => shrunk.get(index) ?? part) }, whole)
  const touching = [...partial.map((index) => (doll.parts[index] as DollPart).body), ...severed.map((piece) => (piece.parts[0] as DollPart).body)]
  return { remaining: kept, severed, touching }
}

/**
 * A limb (or the head) torn off at `segment`, with everything that hangs below it. In a full body (R0) each segment is a body: the joint above the cut
 * goes (`removeJoint`) and the segments below go on as bodies with their own joints, same shape, same mass, same velocity: nothing is made or moved, so
 * nothing is born inside anything and the total mass is the same before and after. In the chain (R1) the arms and the neck have no body: the member is
 * drawn from the designed pose, carried by the part that held it (a new ragdoll), and that part gives up the member's mass with `setShape`. A part
 * whole in the member (the head) leaves as in R0. The pieces that were one ragdoll are one for `removeRagdoll`: the engine frees a ragdoll as a whole.
 */
export const tearOff = (world: PhysicsWorld, doll: Doll, segment: SegmentId): Dismembered => {
  const group = new Set<SegmentId>([segment, ...segmentsBelow(segment)])
  if (!doll.parts.some((part) => part.segments.includes(segment))) throw new Error(`game-characters: segment "${segment}" is not on this body`)
  const { touching, ...result } = detach(world, doll, group)
  ignoreAmong(world, touching)
  return result
}

/**
 * `segment` cut where `keptFraction` of its length stays on the joint's side (a forearm cut in the middle: 0.5). R0 only (a segment is a body). The stump keeps its
 * body: `setShape` shrinks it about its centre and the kit's mass is its share; the rest of the length is a new body with the rest of the mass, placed where that
 * part of the limb was, with the velocity it had; what hung below goes as in `tearOff`. The stump and the piece do not meet.
 */
export const cutSegment = (world: PhysicsWorld, doll: Doll, segment: SegmentId, keptFraction: number): Dismembered => {
  if (!(keptFraction > 0 && keptFraction < 1)) throw new RangeError(`game-characters: a cut keeps a fraction between 0 and 1, not ${keptFraction}`)
  const part = doll.parts.find((candidate) => candidate.segments.length === 1 && candidate.segments[0] === segment)
  if (!part || part.shape.kind !== 'capsule') throw new Error(`game-characters: "${segment}" is not a capsule body of a full body (R0)`)
  const { radius, halfHeight } = part.shape
  const length = 2 * halfHeight + 2 * radius
  const lengthKept = keptFraction * length
  const live = liveOf(world, part.body)
  const along = rotateBy(live.rotation, [0, part.distal, 0])
  const centre = [0, 1, 2].map((axis) => (live.position[axis] ?? 0) + (along[axis] ?? 0) * (lengthKept / 2)) as [number, number, number]
  const designed = doll.designed[SEGMENT_IDS.indexOf(segment)]
  if (!designed) throw new Error(`game-characters: no designed part for "${segment}"`)
  const pieceShape = { kind: 'capsule', radius, halfHeight: Math.max(MINIMUM_HALF_HEIGHT, (length - lengthKept - 2 * radius) / 2) } as const
  const engineMass = world.massOf(part.body)
  const pieceMass = engineMass * (1 - keptFraction)
  const move = moveOf({ position: live.position, rotation: live.rotation }, live)
  const below = new Set(segmentsBelow(segment))
  const { remaining, severed, touching } = below.size > 0 ? detach(world, doll, below) : { remaining: doll, severed: [], touching: [] }
  const stumpShape = { kind: 'capsule', radius, halfHeight: Math.max(MINIMUM_HALF_HEIGHT, (lengthKept - 2 * radius) / 2) } as const
  world.setShape(part.body, stumpShape, { mass: engineMass * keptFraction })
  const pieceDoll = dollOf({ world, designed: doll.designed, segments: [[segment]], stabilize: false, parts: [{ parent: -1, body: { ...designed.body, shape: pieceShape, mass: pieceMass, position: centre, rotation: live.rotation, linearVelocity: velocityAt(move, centre), angularVelocity: live.angular } }] })
  const piece = { ...pieceDoll, parts: pieceDoll.parts.map((pieceBody) => ({ ...pieceBody, distal: part.distal })) }
  ignoreAmong(world, [part.body, ...touching, (piece.parts[0] as DollPart).body])
  const stump = { ...part, shape: stumpShape, mass: part.mass * keptFraction }
  return { remaining: { ...remaining, parts: remaining.parts.map((candidate) => (candidate.body === part.body ? stump : candidate)) }, severed: [piece, ...severed] }
}
