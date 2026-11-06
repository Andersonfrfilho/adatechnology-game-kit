import type * as THREE_NS from 'three'

import type { HandAnchor } from './hand-hold'

/** How a tool is held in the first-person view: a pistol or a revolver, a rocket launcher, a long gun, a tool in one hand (a blade, a bat, a grenade, a lighter), or a gun carried at the hip (a hand-held rotary gun). */
export type ViewHoldKind = 'handgun' | 'launcher' | 'long' | 'tool' | 'hip'

type Hold = {
  /** The right hand's grip at the hip, from the eye (x right, y up, -z ahead, metres). */
  readonly grip: readonly [number, number, number]
  /** The vertical field of view the gun and the arms are drawn with (`FIRST_PERSON_LAYER`), degrees. */
  readonly fov: number
  /** Aimed down the sights: how far ahead of the eye the sights sit, and how far back from the rear of the gun they are. */
  readonly sights: { readonly distance: number; readonly fromRear: number }
  /** Radians the tool is tilted up about the eye's x (a blade carried point up); none for a gun, whose barrel stays on the aim. */
  readonly tilt?: number
}

/**
 * The first-person viewmodel: the gun in the arms of the view, held at the hip with the barrel parallel to the aim (its line runs into the crosshair), the grip where the right hand
 * reaches, drawn over the world with a lens of its own per kind, as shooters draw the weapon in the hands; aimed, the sights come to the eye. The gun and the arms keep their real size
 * against each other; the lens frames them.
 */
export const VIEW_HOLD: Readonly<Record<ViewHoldKind, Hold>> = {
  long: { grip: [0.2, -0.28, -0.38], fov: 84, sights: { distance: 0.34, fromRear: 0.3 } },
  handgun: { grip: [0.13, -0.15, -0.33], fov: 76, sights: { distance: 0.42, fromRear: 0.02 } },
  launcher: { grip: [0.2, -0.14, -0.3], fov: 84, sights: { distance: 0.18, fromRear: 0.25 } },
  tool: { grip: [0.21, -0.31, -0.36], fov: 84, sights: { distance: 0.3, fromRear: 0.1 }, tilt: 0.3 },
  // the gun at the hip, its rear grip low and to the right, the barrels ahead of the body; it has no sights to bring to the eye
  hip: { grip: [0.44, -0.32, -0.42], fov: 84, sights: { distance: 0.6, fromRear: 0.1 } },
}

/** A gun with no grip anchor: the rear of its bore, from the eye. */
const NO_GRIP_REAR = [0.2, -0.24, -0.12] as const
/** Aimed, the sights sit this far under the line of the eye (the eye looks over the rear sight onto the front one). */
const SIGHT_UNDER_EYE = 0.02

export type ViewHoldPlacement = {
  readonly THREE: typeof THREE_NS
  /** The group the viewmodel moves; its `holder` child turns the model's barrel (x) down the aim (-z). */
  readonly hand: THREE_NS.Object3D
  readonly holder: THREE_NS.Object3D
  readonly camera: THREE_NS.Camera
  /** Where the right hand holds the gun (`Hold.right`); null puts the rear of the bore at a fixed point low and right. */
  readonly right: HandAnchor | null
  /** The model's box in its own space (x along the barrel, rear at `min.x`), at rest. */
  readonly box: THREE_NS.Box3
  readonly kind: ViewHoldKind
  /** 0 at the hip to 1 aimed down the sights. */
  readonly aim: number
  /** Added to the holder, in the eye's frame: the bob of the step and the sway. */
  readonly offset: THREE_NS.Vector3
}

const scratch = { grip: null as THREE_NS.Vector3 | null, hip: null as THREE_NS.Vector3 | null, aimed: null as THREE_NS.Vector3 | null, tilt: null as THREE_NS.Quaternion | null }
const ease = (k: number): number => k * k * (3 - 2 * k)

/** Puts the gun in the first-person view (`VIEW_HOLD`): the hand on the camera and turned with it, the holder at the hip pose eased to the sights by `aim`, plus `offset`. */
export function placeInView(placement: ViewHoldPlacement): void {
  const { THREE, hand, holder, camera, right, box, kind } = placement
  const hold = VIEW_HOLD[kind]
  holder.scale.setScalar(1)
  hand.position.copy(camera.position)
  hand.quaternion.copy(camera.quaternion)
  if (hold.tilt) {
    scratch.tilt ??= new THREE.Quaternion()
    hand.quaternion.multiply(scratch.tilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), hold.tilt))
  }
  hand.scale.setScalar(1)
  holder.position.set(0, 0, 0)
  hand.updateMatrixWorld(true)
  scratch.hip ??= new THREE.Vector3()
  const hip = scratch.hip
  if (right) {
    scratch.grip ??= new THREE.Vector3()
    const grip = hand.worldToLocal(right.part.localToWorld(scratch.grip.copy(right.offset)))
    hip.set(hold.grip[0] - grip.x, hold.grip[1] - grip.y, hold.grip[2] - grip.z)
  } else hip.set(NO_GRIP_REAR[0], NO_GRIP_REAR[1], NO_GRIP_REAR[2] + box.min.x)
  // aimed: the top of the gun (its sights) on the line of the eye, `fromRear` along it at `distance` ahead; the holder turns model (x, y, z) to the eye's (z, y, -x)
  const k = ease(Math.max(0, Math.min(1, placement.aim)))
  if (k > 0) {
    const along = box.min.x + hold.sights.fromRear
    scratch.aimed ??= new THREE.Vector3()
    hip.lerp(scratch.aimed.set(0, -SIGHT_UNDER_EYE - box.max.y, along - hold.sights.distance), k)
  }
  holder.position.copy(hip).add(placement.offset)
  hand.updateMatrixWorld(true)
}

/**
 * Where the world draws a point of the first-person layer: the layer is drawn with the lens `lensFov` and the world with `worldFov`, so a point at a depth lands on the screen where the
 * world draws the point at the same depth moved toward the axis by tan(world / 2) / tan(lens / 2). The flash, the smoke and the casings, drawn by the world, start there.
 */
export function toWorldLens(camera: THREE_NS.Camera, point: THREE_NS.Vector3, worldFov: number, lensFov: number): THREE_NS.Vector3 {
  const k = Math.tan((worldFov * Math.PI) / 360) / Math.tan((lensFov * Math.PI) / 360)
  camera.updateMatrixWorld()
  camera.worldToLocal(point)
  point.x *= k
  point.y *= k
  return camera.localToWorld(point)
}
