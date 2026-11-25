/**
 * Where a thing in the hands goes when it is not simply held in the palm (`HeldHands.item`): a thing being used (a drink raised to the mouth, a lid turned) rides the hand by the
 * use's own pose, and with no body it floats in front of the eye. Writes the place of its middle, its turn, and the turn of the wrist that holds it (for the hand on a lid).
 */
import type * as THREE_NS from 'three'

export type HeldFollowParams = {
  readonly THREE: typeof THREE_NS
  /** The hand socket that holds it, or null with no body. */
  readonly hand: THREE_NS.Object3D | null
  /** Where the hands carry it, when they do (both hands, the off hand): its middle there instead of at the socket. */
  readonly carried: readonly [number, number, number] | null
  /** The pose of the use going on (position in the eye's frame, rotation as Euler XYZ), or null. */
  readonly use: { readonly position: readonly number[]; readonly rotation: readonly number[] } | null
  /** A drink, a sip or a chug: the thing tips up toward the mouth. */
  readonly isDrink: boolean
  readonly yaw: number
  /** The player's turn of the thing (R key) and its tip forward (pouring). */
  readonly turn: { readonly yaw: number; readonly tilt: number }
  readonly camera: THREE_NS.Object3D
}

export type HeldFollowOut = { readonly position: THREE_NS.Vector3; readonly target: THREE_NS.Quaternion; readonly grip: THREE_NS.Quaternion }

/** Most the wrist bends back and forward (radians) following the thing it holds. */
const WRIST = [-1.35, 1.25] as const

export function followHeldTarget(params: HeldFollowParams, out: HeldFollowOut): void {
  const { THREE, use, isDrink, turn } = params
  const up = new THREE.Vector3(0, 1, 0)
  const frame = new THREE.Quaternion().setFromAxisAngle(up, params.yaw)
  const spin = new THREE.Quaternion().setFromAxisAngle(up, turn.yaw)
  const euler = (x: number): THREE_NS.Quaternion => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, use?.rotation[1] ?? 0, use?.rotation[2] ?? 0, 'XYZ'))
  const wrist = (x: number): number => Math.max(WRIST[0], Math.min(WRIST[1], x))
  if (params.hand) {
    // with a body the thing rides its hand in both views, and tilts with the use or the pour
    const rx = use ? (isDrink ? Math.abs(use.rotation[0] ?? 0) * 0.9 : (use.rotation[0] ?? 0)) : -turn.tilt
    out.grip.copy(frame).multiply(euler(wrist(rx)))
    out.target.copy(frame).multiply(euler(rx)).multiply(spin)
    const at = params.carried ? out.position.set(params.carried[0], params.carried[1], params.carried[2]) : params.hand.getWorldPosition(out.position)
    at.add(new THREE.Vector3(-0.02, 0.015, -0.04).applyQuaternion(out.grip))
    return
  }
  if (use) {
    const raise = isDrink ? Math.max(0, Math.min(1, ((use.position[1] ?? 0) + 0.2) / 0.22)) : 0
    const local = new THREE.Vector3((use.position[0] ?? 0) + (isDrink ? 0.02 * raise : 0), (use.position[1] ?? 0) - (isDrink ? 0.08 * raise : 0), (use.position[2] ?? 0) - (isDrink ? 0.05 * raise : 0))
    out.position.copy(local.applyQuaternion(frame).add(params.camera.position))
    const rx = isDrink ? Math.abs(use.rotation[0] ?? 0) * 0.85 : (use.rotation[0] ?? 0)
    out.grip.copy(frame).multiply(euler(wrist(rx)))
    out.target.copy(frame).multiply(euler(rx)).multiply(spin)
    return
  }
  // no body to hold it: the thing floats in front of the eye
  out.position.set(0.05, -0.28, -1.15).applyMatrix4(params.camera.matrixWorld)
  const tip = new THREE.Vector3(1, 0, 0)
  out.grip.copy(frame).multiply(new THREE.Quaternion().setFromAxisAngle(tip, Math.max(WRIST[0], -turn.tilt)))
  out.target.setFromAxisAngle(up, params.yaw + turn.yaw).multiply(new THREE.Quaternion().setFromAxisAngle(tip, -turn.tilt))
}
