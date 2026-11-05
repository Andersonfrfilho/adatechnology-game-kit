import type * as THREE_NS from 'three'

import type { HandAnchor } from './hand-hold'

/**
 * Where a gun sits in the first-person view, at its real size and in the body's hands: held at the hip, the barrel parallel to the aim (its line runs into the crosshair), the grip low and to
 * the right of the eye, as far ahead as the right arm reaches in the view. In the eye's frame: x right, y up, -z ahead, metres. The sights stay below the crosshair; a long gun's stock is
 * beside the body, at the bottom right edge of the screen.
 */
export const VIEW_HOLD = {
  /** The right hand's grip, from the eye. */
  grip: [0.2, -0.2, -0.3],
  /** A handgun's grip: higher and nearer the middle, the arms out in front. */
  handgunGrip: [0.13, -0.15, -0.33],
  /** A rocket launcher's grip: its tube rides on the shoulder, so the hands are higher. */
  launcherGrip: [0.2, -0.14, -0.3],
  /** A gun with no grip anchor: the rear of its bore, from the eye. */
  rear: [0.2, -0.24, -0.12],
} as const

export type ViewHoldPlacement = {
  readonly THREE: typeof THREE_NS
  /** The group the viewmodel moves; its `holder` child turns the model's barrel (x) down the aim (-z). */
  readonly hand: THREE_NS.Object3D
  readonly holder: THREE_NS.Object3D
  readonly camera: THREE_NS.Camera
  /** Where the right hand holds the gun (`Hold.right`); null puts the rear of the bore at `VIEW_HOLD.rear`. */
  readonly right: HandAnchor | null
  /** The rear end of the model along its barrel (model x), metres. */
  readonly rear: number
  /** How it is held: a pistol or a revolver with `handgunGrip`, a rocket launcher with `launcherGrip`, anything else with `grip`. */
  readonly kind: 'handgun' | 'launcher' | 'long'
}

const scratch = { grip: null as THREE_NS.Vector3 | null }

/** Puts the gun in the first-person view (`VIEW_HOLD`): the hand on the camera and turned with it, the holder shifted so the grip lands where the right hand reaches. */
export function placeInView(placement: ViewHoldPlacement): void {
  const { THREE, hand, holder, camera, right } = placement
  holder.scale.setScalar(1)
  hand.position.copy(camera.position)
  hand.quaternion.copy(camera.quaternion)
  hand.scale.setScalar(1)
  holder.position.set(0, 0, 0)
  hand.updateMatrixWorld(true)
  if (!right) {
    holder.position.set(VIEW_HOLD.rear[0], VIEW_HOLD.rear[1], VIEW_HOLD.rear[2] + placement.rear)
    hand.updateMatrixWorld(true)
    return
  }
  scratch.grip ??= new THREE.Vector3()
  const grip = hand.worldToLocal(right.part.localToWorld(scratch.grip.copy(right.offset)))
  const [x, y, z] = placement.kind === 'handgun' ? VIEW_HOLD.handgunGrip : placement.kind === 'launcher' ? VIEW_HOLD.launcherGrip : VIEW_HOLD.grip
  holder.position.set(x - grip.x, y - grip.y, z - grip.z)
  hand.updateMatrixWorld(true)
}
