import type { BodyRegion, BodySlot, SegmentKind } from '@adatechnology/game-contracts'

import segments from '../data/segments.json'
import type { JointId } from './body-spec'

export type SegmentSide = 'L' | 'R'
type LimbKind = 'upperArm' | 'forearm' | 'hand' | 'thigh' | 'shin' | 'foot'
export type SegmentId = 'pelvis' | 'torso' | 'neck' | 'head' | 'jaw' | `${LimbKind}${SegmentSide}`

/** One segment of the tree: the joint it hangs from, its parent, the crowd region it belongs to and the item slots that cover it. */
export type SegmentNode = {
  readonly id: SegmentId
  readonly kind: SegmentKind
  readonly side?: SegmentSide
  readonly joint: JointId
  readonly parent?: SegmentId
  readonly region: BodyRegion
  readonly slots: readonly BodySlot[]
}

/** Numbers of a segment kind (the Arsenal table, A4): hit points, damage multiplier and bleed rate. */
export type SegmentNumbers = { readonly hitPoints: number; readonly multiplier: number; readonly bleed: number }

const limb = (kind: LimbKind, side: SegmentSide, joint: JointId, parent: SegmentId | undefined, slots: readonly BodySlot[]): SegmentNode => {
  const isArm = kind === 'upperArm' || kind === 'forearm' || kind === 'hand'
  const region: BodyRegion = isArm ? (side === 'L' ? 'armL' : 'armR') : side === 'L' ? 'legL' : 'legR'
  return { id: `${kind}${side}`, kind, side, joint, region, slots, ...(parent ? { parent } : {}) }
}

const sideOf = (side: SegmentSide): SegmentNode[] => [
  limb('upperArm', side, `shoulder${side}`, 'torso', ['arms']),
  limb('forearm', side, `elbow${side}`, `upperArm${side}`, ['arms']),
  limb('hand', side, `wrist${side}`, `forearm${side}`, ['hands']),
  limb('thigh', side, `hip${side}`, 'pelvis', ['legs']),
  limb('shin', side, `knee${side}`, `thigh${side}`, ['legs']),
  limb('foot', side, `ankle${side}`, `shin${side}`, ['feet']),
]

/** The 17 segments (11 kinds, limbs on both sides), parents before children. Neck and jaw have no item slot: a helmet does not cover them. */
export const SEGMENT_TREE: readonly SegmentNode[] = [
  { id: 'pelvis', kind: 'pelvis', joint: 'hip', region: 'torso', slots: ['torso'] },
  { id: 'torso', kind: 'torso', joint: 'spine', parent: 'pelvis', region: 'torso', slots: ['torso'] },
  { id: 'neck', kind: 'neck', joint: 'neck', parent: 'torso', region: 'head', slots: [] },
  { id: 'head', kind: 'head', joint: 'head', parent: 'neck', region: 'head', slots: ['head', 'eyes'] },
  { id: 'jaw', kind: 'jaw', joint: 'jaw', parent: 'head', region: 'head', slots: [] },
  ...sideOf('L'),
  ...sideOf('R'),
]

export const SEGMENT_IDS: readonly SegmentId[] = SEGMENT_TREE.map((node) => node.id)

const NODES = new Map(SEGMENT_TREE.map((node) => [node.id, node]))

export const segmentNode = (id: SegmentId): SegmentNode => {
  const node = NODES.get(id)
  if (!node) throw new Error(`game-characters: unknown segment "${id}"`)
  return node
}

export const isSegmentId = (value: string): value is SegmentId => NODES.has(value as SegmentId)

/** Every segment that hangs below `id` (children, grandchildren...), in tree order: what falls with it when it is severed. */
export const segmentsBelow = (id: SegmentId): SegmentId[] => {
  const out: SegmentId[] = []
  const visit = (parent: SegmentId): void => {
    for (const node of SEGMENT_TREE) {
      if (node.parent !== parent) continue
      out.push(node.id)
      visit(node.id)
    }
  }
  visit(id)
  return out
}

/** The Arsenal numbers per segment kind (hit points, `MULT`, `BLEED`). */
export const SEGMENT_NUMBERS: Readonly<Record<SegmentKind, SegmentNumbers>> = Object.fromEntries(
  segments.segments.map((entry) => [entry.id, { hitPoints: entry.hitPoints, multiplier: entry.multiplier, bleed: entry.bleed }]),
) as Record<SegmentKind, SegmentNumbers>
