import type { PhysicsWorld, RagdollPart, ShapeDesc } from '@adatechnology/game-physics'

import { dollOf } from './doll'
import type { Doll, DollPart } from './doll'
import { liveOf, movePart, moveOf } from './rigid'
import { SEGMENT_IDS, segmentNode } from './segment-tree'
import type { SegmentId } from './segment-tree'

/** The shape at `fraction` of its mass, same density: a capsule's radius and a sphere's follow the volume. */
export const shrunkShape = (shape: ShapeDesc, fraction: number): ShapeDesc => {
  if (shape.kind === 'capsule') return { ...shape, radius: shape.radius * Math.sqrt(fraction) }
  if (shape.kind === 'sphere') return { ...shape, radius: shape.radius * Math.cbrt(fraction) }
  throw new Error(`game-characters: a ${shape.kind} body cannot give up part of its mass`)
}

const reindexed = (parts: readonly DollPart[], keep: readonly number[]): DollPart[] =>
  keep.map((index) => {
    const part = parts[index] as DollPart
    return { ...part, parent: keep.indexOf(part.parent) }
  })

/** The doll without the parts `gone` (closed downward: no kept part hangs from a gone one). */
export const withoutParts = (doll: Doll, gone: readonly number[]): Doll => {
  const keep = doll.parts.map((_, index) => index).filter((index) => !gone.includes(index))
  return { ...doll, parts: reindexed(doll.parts, keep) }
}

/** Each run of `whole` parts under its topmost part as a doll of its own (same engine ragdoll): the top loses its joint. */
export const dollsOfWhole = (doll: Doll, whole: readonly number[]): Doll[] => {
  const tops = whole.filter((index) => !whole.includes((doll.parts[index] as DollPart).parent))
  return tops.map((top) => {
    const members = [top]
    for (const index of whole) if (members.includes((doll.parts[index] as DollPart).parent)) members.push(index)
    const parts = reindexed(doll.parts, members)
    return { ...doll, parts: parts.map((part, at) => (at === 0 ? { ...part, joint: undefined } : part)) }
  })
}

export type PiecesOfCarrierParams = {
  readonly world: PhysicsWorld
  readonly doll: Doll
  readonly carrier: DollPart
  readonly taken: readonly SegmentId[]
  /** The carrier's engine mass over the kit's: what its stabilized body weighs for each kg it was meant to, applied to the pieces so the body gives up exactly what they weigh. */
  readonly massScale: number
}

/** The segments `taken` of a carrier as bodies of their own, drawn from the designed pose and carried by where the carrier is now; each run under one segment is a new doll. */
export const piecesOfCarrier = (params: PiecesOfCarrierParams): Doll[] => {
  const { world, doll, carrier, taken, massScale } = params
  const move = moveOf(carrier.made, liveOf(world, carrier.body))
  const order = SEGMENT_IDS.filter((id) => taken.includes(id))
  const placed = order.map((id) => {
    const part = movePart(doll.designed[SEGMENT_IDS.indexOf(id)] as RagdollPart, move)
    return { ...part, body: { ...part.body, mass: (part.body.mass ?? 0) * massScale } }
  })
  const parentAt = order.map((id) => order.indexOf(segmentNode(id).parent as SegmentId))
  return order.flatMap((id, top) => {
    if (parentAt[top] !== -1) return []
    const members = [top]
    parentAt.forEach((parent, at) => void (members.includes(parent) && at !== top && members.push(at)))
    const parts = members.map((at, local): RagdollPart => {
      const { joint, ...rest } = placed[at] as RagdollPart
      return local === 0 ? { ...rest, parent: -1 } : { ...rest, parent: members.indexOf(parentAt[at] as number), ...(joint ? { joint } : {}) }
    })
    return [dollOf({ world, parts, segments: members.map((at) => [order[at] as SegmentId]), designed: doll.designed, stabilize: false })]
  })
}
