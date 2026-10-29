import type { SegmentId } from '@adatechnology/game-characters'

import type { THREE_NS } from '../three'
import type { BloodLook } from './fluids-bridge'
import type { RichRig } from '../rich/animator'

/** The group that stands for one segment of the engine's tree on a drawn body, with what the wounds need to cut it off. */
export type WoundNode = {
  /** The group that leaves (its children go with it). */
  readonly node: THREE_NS.Object3D
  /** Radius of the cut face. */
  readonly radius: number
  /** For an arm: which one in `rig.arms`, and the joint that swings when the bone breaks. */
  readonly arm?: { readonly index: number; readonly joint: 'shoulder' | 'elbow' }
  readonly leg?: number
  /** The cut face of a head faces the other way. */
  readonly flip?: boolean
}

export type WoundBody = {
  readonly root: THREE_NS.Object3D
  readonly rig: RichRig
  readonly nodes: Partial<Record<SegmentId, WoundNode>>
  /** The colours this body bleeds in (the infection age of a zombie). Without it the bridge's liquid and the liquid's own colours. */
  blood?: BloodLook
}

/** Radii of the cut faces by segment, from the Elenco's `segs` table (`r`). */
const RADIUS = { head: 0.07, upperArm: 0.085, forearm: 0.065, hand: 0.05, thigh: 0.1, shin: 0.08 } as const

const SIDE = (x: number): 'L' | 'R' => (x >= 0 ? 'L' : 'R')

/**
 * Maps the rich body the best builder makes onto the engine's segments. The left side is +x, as the engine has it. The drawn body has no hand or foot
 * group of its own: they ride with the forearm and the shin, so a hand or foot that is lost takes its parent's node only when the parent is lost too.
 */
export const woundBodyOf = (root: THREE_NS.Object3D): WoundBody | undefined => {
  const rig = root.userData.rig as RichRig | undefined
  if (!rig) return undefined
  const nodes: Partial<Record<SegmentId, WoundNode>> = {}
  rig.arms.forEach((arm, index) => {
    const side = SIDE((arm.g as unknown as THREE_NS.Object3D).position.x)
    nodes[`upperArm${side}`] = { node: arm.g as unknown as THREE_NS.Object3D, radius: RADIUS.upperArm, arm: { index, joint: 'shoulder' } }
    nodes[`forearm${side}`] = { node: arm.el as unknown as THREE_NS.Object3D, radius: RADIUS.forearm, arm: { index, joint: 'elbow' } }
  })
  rig.legs.forEach((leg, index) => {
    const side = SIDE((leg.g as unknown as THREE_NS.Object3D).position.x)
    nodes[`thigh${side}`] = { node: leg.g as unknown as THREE_NS.Object3D, radius: RADIUS.thigh, leg: index }
    nodes[`shin${side}`] = { node: leg.kn as unknown as THREE_NS.Object3D, radius: RADIUS.shin, leg: index }
  })
  nodes.head = { node: rig.headG as unknown as THREE_NS.Object3D, radius: RADIUS.head, flip: true }
  return { root, rig, nodes }
}
