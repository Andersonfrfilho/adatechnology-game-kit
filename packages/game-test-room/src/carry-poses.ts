/**
 * Where the hands go on a thing carried, world space: the left hand alone under a small thing (the weapon in the right). The hand frame is the one of `HandTargets`: +x along the fingers, +y the back of the hand, the thumb at -z for a right hand and +z for a left one.
 */
import type * as THREE_NS from 'three'
import type { HandPose, ToolHand } from '@adatechnology/game-contracts'

/** How far under the shoulder and ahead of it the left hand holds a small thing (m). */
const OFF_HAND = { down: 0.4, ahead: 0.3, inward: 0.04 } as const

const forwardOf = (yaw: number): [number, number, number] => [-Math.sin(yaw), 0, -Math.cos(yaw)]
/** The view's right at `yaw` (the view looks down -z at 0). */
const rightOf = (yaw: number): [number, number, number] => [Math.cos(yaw), 0, -Math.sin(yaw)]

/** A hand with the fingers ahead, the back of the hand out to its own side and the thumb up. */
const sideGrip = (hand: ToolHand, position: readonly number[], yaw: number): HandPose => {
  const forward = forwardOf(yaw)
  const right = rightOf(yaw)
  const out = hand === 'R' ? right : [-right[0], 0, -right[2]]
  return { position: [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0], quaternion: quaternionOfBasis(forward, out, [0, hand === 'R' ? -1 : 1, 0]) }
}

/** Where the left hand holds a thing it carries alone: low and ahead of the left shoulder. */
export const offHandCarryPose = (shoulder: readonly number[], yaw: number): HandPose => {
  const forward = forwardOf(yaw)
  const right = rightOf(yaw)
  const at = (i: 0 | 2): number => (shoulder[i] ?? 0) + forward[i] * OFF_HAND.ahead + right[i] * OFF_HAND.inward
  return sideGrip('L', [at(0), (shoulder[1] ?? 0) - OFF_HAND.down, at(2)], yaw)
}

/** The pose of a socket of the body (`RoomAvatar.slot`) in world space, as `ModuleHost.bodySlot` answers it; null without one. */
export const bodySlotPose = (socket: THREE_NS.Object3D | null | undefined): HandPose | null => {
  if (!socket) return null
  socket.updateWorldMatrix(true, false)
  const e = socket.matrixWorld.elements
  const scale = (i: number): number => Math.hypot(e[i] ?? 0, e[i + 1] ?? 0, e[i + 2] ?? 0) || 1
  const axis = (i: number): number[] => [(e[i] ?? 0) / scale(i), (e[i + 1] ?? 0) / scale(i), (e[i + 2] ?? 0) / scale(i)]
  return { position: [e[12] ?? 0, e[13] ?? 0, e[14] ?? 0], quaternion: quaternionOfBasis(axis(0), axis(4), axis(8)) }
}

export const quaternionOfBasis = (x: readonly number[], y: readonly number[], z: readonly number[]): [number, number, number, number] => {
  const [m00, m10, m20] = x as [number, number, number]
  const [m01, m11, m21] = y as [number, number, number]
  const [m02, m12, m22] = z as [number, number, number]
  const trace = m00 + m11 + m22
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22)
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22)
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11)
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]
}
