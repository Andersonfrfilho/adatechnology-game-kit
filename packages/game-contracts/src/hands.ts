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
  /**
   * The shaft of a two-handed tool (a shovel, an axe, a sledgehammer) the left hand may slide along, world space: a left grip out of the arm's reach is taken at the nearest point of
   * this segment the hand reaches, the hand still closed on the shaft, as one shortens the grip on a handle. Absent, the left hand goes to `L` or stops short of it.
   */
  slideL?: { readonly from: Vec3; readonly to: Vec3 } | null
  /** How closed the fingers are, 0 open to 1 closed on a grip. Default 1. */
  grip?: number
  /** The same for the left hand, when it differs from `grip` (a hand laid on a forend is looser than the one on the trigger). */
  gripL?: number
  /** The size of the hands against life size (a tool drawn smaller than real takes smaller hands). Default 1. */
  scale?: number
  /** Fingers of the right hand that curl by themselves, 0 extended to 1 fully curled (the index finger of a trigger hand); the others follow `grip`. */
  fingers?: { index?: number }
  /** The same for the left hand (its index on the trigger of a tool of its own, with a tool in each hand); absent, the left hand's fingers all follow `gripL`. */
  fingersL?: { index?: number }
  /**
   * Where the elbows go: `view` puts them on screen beside the hand, out to the side, as a tool held out in front (default); `body` lets them hang down and back by the body, as an item
   * carried close (a can, a bottle), where an elbow out to the side would lift it above the shoulder.
   */
  elbows?: 'view' | 'body'
}

/** Read every frame by whoever draws the arms; answers null while nothing is held. */
export type HandTargetSource = () => HandTargets | null

/** The muzzle of the tool in the hands as it is drawn now (world space): where a shot's flash and tracer leave, and which way the barrel points. */
export interface MuzzlePose {
  readonly position: Vec3
  /** Unit vector along the barrel, out of the muzzle. */
  readonly direction: Vec3
  /** The module draws the muzzle flash itself: the host draws none of its own. */
  readonly drawsFlash: boolean
}

/** A hand of the body: `R` the right, `L` the left. A tool in one hand alone is in the right; the left holds one of its own only with a tool in each hand (`HostTool.offHand`). */
export type ToolHand = 'R' | 'L'

/**
 * Read by the host at each shot; null while the tool in the hands has no muzzle (a knife, a bare hand). `hand` is the hand that fired (absent: the right one); a source that draws
 * one tool only answers the same for both.
 */
export type MuzzleSource = (hand?: ToolHand) => MuzzlePose | null

/**
 * The layer of what the first-person view draws over the world (three.js `Object3D.layers`): the tool in the hands and the arms that hold it. A host with a first-person view draws
 * the world without this layer, then this layer alone over it with the depth cleared and its own field of view (`ModuleHost.setViewmodelFov`), as shooters draw the weapon in the hands:
 * it never goes into a wall, and the gun and the arms are framed by the lens chosen for them. Seen from outside (third person) nothing is on it.
 */
export const FIRST_PERSON_LAYER = 9
