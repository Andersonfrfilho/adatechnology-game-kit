import type { DestructibleSpec, JointState, ObjectState, PartState, PartStatus, Quat, Vec3 } from '@adatechnology/game-contracts'

import type { SegmentStatus } from '../types'
import type { BodyState } from './body-state'

const PART_STATUS: Readonly<Record<SegmentStatus, PartStatus>> = { ok: 'intact', wounded: 'damaged', broken: 'damaged', severed: 'collapsed', destroyed: 'broken' }
const BODY_TEMPERATURE_C = 37

export type ToObjectStateParams = {
  readonly id: string
  readonly name?: string
  readonly position: Vec3
  readonly rotation: Quat
  readonly body: BodyState
  readonly spec: DestructibleSpec
}

/** The body in the destruction contract: one part per segment, the joints between them, the pieces and the `body` summary. */
export const toObjectState = ({ id, name, position, rotation, body, spec }: ToObjectStateParams): ObjectState => {
  const groups: string[][] = [body.segments.filter((segment) => segment.attached).map((segment) => segment.id)]
  for (const piece of body.pieces) {
    const left = piece.filter((part) => body.segments.find((segment) => segment.id === part)?.status !== 'destroyed')
    if (left.length > 0) groups.push(left)
  }
  const groupOf = (part: string): number => groups.findIndex((group) => group.includes(part))
  const parts: PartState[] = body.segments.map((segment) => {
    const mass = spec.parts.find((part) => part.id === segment.id)?.mass ?? 0
    return {
      id: segment.id,
      material: 'flesh',
      status: PART_STATUS[segment.status],
      hp: Math.max(0, segment.hp),
      maxHp: segment.max,
      mass,
      temperature: BODY_TEMPERATURE_C,
      burning: false,
      fuel: 0,
      char: 0,
      melt: 0,
      dents: [],
      holes: [],
      cracks: [],
      group: groupOf(segment.id),
    }
  })
  const joints: JointState[] = (spec.joints ?? []).map((joint) => {
    const child = body.segments.find((segment) => segment.id === joint.b)
    const parent = body.segments.find((segment) => segment.id === joint.a)
    const open = child !== undefined && parent !== undefined && parent.attached !== child.attached
    return { id: joint.id ?? `${joint.a}~${joint.b}`, a: joint.a, b: joint.b, kind: joint.kind, hp: open ? 0 : 1, maxHp: 1, progress: 0, open, ...(open ? { openedBy: 'break' as const } : {}) }
  })
  return {
    id,
    ...(name ? { name } : {}),
    position: [...position],
    rotation: [...rotation],
    parts,
    joints,
    groups,
    destroyed: false,
    body: { alive: body.alive, vitality: body.vitality, missing: body.missing, limp: body.limping.length > 0, crawl: body.crawl },
  }
}
