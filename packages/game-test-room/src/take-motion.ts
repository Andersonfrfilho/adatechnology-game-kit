/**
 * Where the hands go while they take a thing and carry it (owner, 2026-11-25: the hand on the thing's grip, the fingers closed around it, the thing in the palm), world space:
 * `reach` from the carry pose to the thing where it lies, `close` the fingers on it, `lift` it back to the carry pose, then `hold`. One hand holds it by `gripOfItem` of
 * game-player, so the thing is always where the palm is; both hands hold a big thing by its sides. Pure: the room says the shoulders and the thing; this says the targets.
 */
import type { HandPose, HandTargets, ToolHand } from '@adatechnology/game-contracts'
import { ITEM_GRIP, blendPoses, handPoseOnItem, itemPoseInHand, multiplyQuaternions } from '@adatechnology/game-player'
import type { ItemGrip, Pose } from '@adatechnology/game-player'

import { bothHandsCarry, bothHandsOn, oneHandCarryPose } from './carry-poses'

export type TakePhase = 'reach' | 'close' | 'lift' | 'hold'

export type TakeMotionParams = {
  /** The hand (or both) that takes the thing. */
  readonly hand: ToolHand | 'both'
  readonly phase: TakePhase
  /** How far into the phase, 0..1, eased. */
  readonly progress: number
  readonly shoulder: (hand: ToolHand) => readonly number[] | null
  readonly yaw: number
  /** The thing's box in its own frame (m). */
  readonly size: readonly [number, number, number]
  /** Where the thing lies (its middle and turn): live while the hand reaches, the place it was taken from once it is held. */
  readonly item: Pose | null
  /** The targets of the weapon kept in the other hand. */
  readonly tool: HandTargets | null
  /** The turn the player gives the thing held: about the vertical (R key) and tipped forward (pouring). */
  readonly turn?: { readonly yaw: number; readonly tilt: number }
}

export type TakeMotion = {
  readonly targets: HandTargets
  /** Where the thing is (its middle and turn) once the hand holds it; null while it still lies where it is. */
  readonly item: Pose | null
}

const axisTurn = (axis: readonly [number, number, number], angle: number): [number, number, number, number] => {
  const s = Math.sin(angle / 2)
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)]
}

/** The carry pose of one hand turned by the player: the wrist about the vertical, then tipped forward about the view's right. */
const turned = (pose: HandPose, yaw: number, turn: TakeMotionParams['turn']): Pose => {
  if (!turn || (turn.yaw === 0 && turn.tilt === 0)) return pose
  const right: [number, number, number] = [Math.cos(yaw), 0, -Math.sin(yaw)]
  const q = multiplyQuaternions(axisTurn(right, -turn.tilt), multiplyQuaternions(axisTurn([0, 1, 0], turn.yaw), pose.quaternion))
  return { position: pose.position, quaternion: q }
}

const oneHand = (params: TakeMotionParams, hand: ToolHand, grip: ItemGrip): TakeMotion | null => {
  const shoulder = params.shoulder(hand)
  if (!shoulder) return null
  const rest = turned(oneHandCarryPose(hand, shoulder, params.yaw), params.yaw, params.turn)
  const onItem = params.item ? handPoseOnItem(params.item, grip) : rest
  const { phase, progress } = params
  const pose = phase === 'reach' ? blendPoses(rest, onItem, progress) : phase === 'close' ? onItem : phase === 'lift' ? blendPoses(onItem, rest, progress) : rest
  const closure = phase === 'reach' ? ITEM_GRIP.reaching : phase === 'close' ? ITEM_GRIP.reaching + (grip.grip - ITEM_GRIP.reaching) * progress : grip.grip
  const handPose: HandPose = { position: [...pose.position], quaternion: [...pose.quaternion] }
  const targets: HandTargets = hand === 'L' ? { ...(params.tool ?? {}), L: handPose, gripL: closure, elbows: 'body' } : { ...(params.tool ?? {}), R: handPose, grip: closure, elbows: 'body' }
  return { targets, item: phase === 'lift' || phase === 'hold' ? itemPoseInHand(pose, grip) : null }
}

const blendTargets = (a: HandTargets, b: HandTargets, k: number): HandTargets => ({
  ...b,
  ...(a.R && b.R ? { R: blendPoses(a.R, b.R, k) as HandPose } : {}),
  ...(a.L && b.L ? { L: blendPoses(a.L, b.L, k) as HandPose } : {}),
})

const bothHands = (params: TakeMotionParams): TakeMotion | null => {
  const right = params.shoulder('R')
  const left = params.shoulder('L')
  if (!right || !left) return null
  const carried = bothHandsCarry({ R: right, L: left }, params.yaw, params.size)
  const upright: Pose = { position: carried.center, quaternion: axisTurn([0, 1, 0], params.yaw + (params.turn?.yaw ?? 0)) }
  const lying = params.item ?? upright
  const { phase, progress } = params
  const at = phase === 'reach' || phase === 'close' ? lying : phase === 'lift' ? blendPoses(lying, upright, progress) : upright
  const onItem = bothHandsOn(at.position, params.yaw, params.size)
  const targets = phase === 'reach' ? blendTargets(carried.targets, onItem, progress) : onItem
  return { targets, item: phase === 'lift' || phase === 'hold' ? at : null }
}

/** The hands and the thing now. Null without a body to hold it (no shoulders). */
export function takeMotionOf(params: TakeMotionParams, grip: ItemGrip): TakeMotion | null {
  return params.hand === 'both' ? bothHands(params) : oneHand(params, params.hand, grip)
}
