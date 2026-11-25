/**
 * Where the hands go on a thing carried, world space: the left hand alone under a small thing (the weapon in the right), or both hands on the sides of a big one held in front of
 * the body. The hand frame is the one of `HandTargets`: +x along the fingers, +y the back of the hand, the thumb at -z for a right hand and +z for a left one.
 */
import type * as THREE_NS from 'three'
import type { HandPose, HandTargets, ToolHand } from '@adatechnology/game-contracts'
import { quaternionOfBasis } from '@adatechnology/game-player'

export { quaternionOfBasis } from '@adatechnology/game-player'

/** How far under the shoulder and ahead of it the left hand holds a small thing (m). */
const OFF_HAND = { down: 0.4, ahead: 0.3, inward: 0.04 } as const
/** A big thing held in both hands: its middle this far under the shoulders and ahead of them past half its depth (m); the palms this far off its sides. */
const BOTH_HANDS = { down: 0.32, ahead: 0.18, palm: 0.02 } as const

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

/** Where a hand holds a thing it carries alone: low and ahead of its shoulder, a little in toward the body's middle. */
export const oneHandCarryPose = (hand: ToolHand, shoulder: readonly number[], yaw: number): HandPose => {
  const forward = forwardOf(yaw)
  const right = rightOf(yaw)
  const inward = hand === 'L' ? OFF_HAND.inward : -OFF_HAND.inward
  const at = (i: 0 | 2): number => (shoulder[i] ?? 0) + forward[i] * OFF_HAND.ahead + right[i] * inward
  return sideGrip(hand, [at(0), (shoulder[1] ?? 0) - OFF_HAND.down, at(2)], yaw)
}

/** Where the left hand holds a thing it carries alone: low and ahead of the left shoulder. */
export const offHandCarryPose = (shoulder: readonly number[], yaw: number): HandPose => oneHandCarryPose('L', shoulder, yaw)

/** Both hands on the sides of a thing whose middle is at `center` (world space), the thumbs up: `size` is its box, width across the body first. */
export const bothHandsOn = (center: readonly number[], yaw: number, size: readonly [number, number, number]): HandTargets => {
  const right = rightOf(yaw)
  const half = size[0] / 2 + BOTH_HANDS.palm
  const palm = (sign: number): number[] => [(center[0] ?? 0) + right[0] * half * sign, center[1] ?? 0, (center[2] ?? 0) + right[2] * half * sign]
  return { R: sideGrip('R', palm(1), yaw), L: sideGrip('L', palm(-1), yaw), grip: 0.75, gripL: 0.75, elbows: 'body' }
}

/**
 * A big thing in both hands: its middle in front of the chest (`center`) and a palm on each of its sides, the thumbs up. `size` is the thing's box (width across the body first,
 * height, depth along the view), as it is turned to the view.
 */
export const bothHandsCarry = (shoulders: { readonly R: readonly number[]; readonly L: readonly number[] }, yaw: number, size: readonly [number, number, number]): { center: [number, number, number]; targets: HandTargets } => {
  const forward = forwardOf(yaw)
  const mid = (i: number): number => ((shoulders.R[i] ?? 0) + (shoulders.L[i] ?? 0)) / 2
  const ahead = BOTH_HANDS.ahead + size[2] / 2
  const center: [number, number, number] = [mid(0) + forward[0] * ahead, mid(1) - BOTH_HANDS.down, mid(2) + forward[2] * ahead]
  return { center, targets: bothHandsOn(center, yaw, size) }
}

/** Where a thing is: its middle (`local`, the middle in its own frame) and its turn, world space. */
export const itemPoseOf = (root: THREE_NS.Object3D, local: THREE_NS.Vector3): { position: [number, number, number]; quaternion: [number, number, number, number] } => {
  const middle = local.clone().applyQuaternion(root.quaternion).add(root.position)
  return { position: [middle.x, middle.y, middle.z], quaternion: [root.quaternion.x, root.quaternion.y, root.quaternion.z, root.quaternion.w] }
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


/** Steps of the search for the farthest free point between the body and where the hand would take a carried thing. */
const REACH_STEPS = 10
/** Metres between the points tried on the way from the body to the hand: thinner than any wall, so none is reached through. */
const REACH_SAMPLE = 0.05

/**
 * Keeps a carried thing out of the walls (what the modules ask the walking player to stay out of, `ModuleHost.addBlocker`): where its middle would go into one or past one, it
 * stops at the farthest free point on the line from the body to there, as a hand stops on the wall it reaches into. `to` is moved in place (only x and z). Returns
 * whether it was pulled back.
 */
export function clampCarriedReach(from: { readonly x: number; readonly z: number }, to: { x: number; z: number }, blockers: Iterable<(x: number, z: number, radius: number) => boolean>, radius: number): boolean {
  const blocked = (x: number, z: number): boolean => {
    for (const isBlocked of blockers) if (isBlocked(x, z, radius)) return true
    return false
  }
  // the first blocked point along the way from the body (a wall thinner than the reach is never skipped over), then its edge to the step
  const dx = to.x - from.x, dz = to.z - from.z
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / REACH_SAMPLE))
  let free = 0
  let hit = -1
  for (let i = 1; i <= steps && hit < 0; i++) {
    if (blocked(from.x + (dx * i) / steps, from.z + (dz * i) / steps)) hit = i / steps
    else free = i / steps
  }
  if (hit < 0) return false
  for (let k = 0; k < REACH_STEPS; k++) {
    const mid = (free + hit) / 2
    if (blocked(from.x + (to.x - from.x) * mid, from.z + (to.z - from.z) * mid)) hit = mid
    else free = mid
  }
  to.x = from.x + (to.x - from.x) * free
  to.z = from.z + (to.z - from.z) * free
  return true
}
