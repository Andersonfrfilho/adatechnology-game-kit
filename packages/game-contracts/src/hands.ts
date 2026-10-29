import type { Vec3 } from './destruction'

/**
 * Where a hand should be, in world space. `position` is the middle of the palm; the orientation follows one convention for every hand: the hand-local +x runs from the wrist to the
 * knuckles (the way the fingers point when open), +y is the back of the hand and +z completes the frame (for a right hand the little finger side; the thumb is at -z). A left hand is the
 * mirror image of a right one, so the same numbers describe the same grip: its thumb is at +z.
 */
export interface HandPose {
  position: Vec3
  /** Unit quaternion `[x, y, z, w]`, hand-local to world. */
  quaternion: [number, number, number, number]
}

/**
 * What a tool in the hands asks of the hands that hold it (a weapon asks for a grip on its grip and handguard, a carried item for a hand under it). A side left out or null is not held:
 * the hand stays in its rest stance. Nothing here knows what the tool is.
 */
export interface HandTargets {
  R?: HandPose | null
  L?: HandPose | null
  /** How closed the fingers are, 0 open to 1 closed on a grip. Default 1. */
  grip?: number
  /** The same for the left hand, when it differs from `grip` (a hand laid on a forend is looser than the one on the trigger). */
  gripL?: number
  /** The size of the hands against life size (a tool drawn smaller than real takes smaller hands). Default 1. */
  scale?: number
  /** Fingers of the right hand that curl by themselves, 0 extended to 1 fully curled (the index finger of a trigger hand); the others follow `grip`. */
  fingers?: { index?: number }
}

/** Read every frame by whoever draws the arms; answers null while nothing is held. */
export type HandTargetSource = () => HandTargets | null
