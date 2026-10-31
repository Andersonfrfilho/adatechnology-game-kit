import type { FirstPersonClip, PoseClipEvent } from '@adatechnology/game-characters'
import type { HandTargets } from '@adatechnology/game-contracts'

import type { THREE_NS } from '../three'

type Triple = [number, number, number]

/**
 * A hand (or the foot) at rest, in the camera's space: x to the right, y up, the view looks down -z. `p` is the middle of the palm, `r` the Euler angles `[roll, yaw, pitch]` in the order YZX:
 * with all three at 0 the fingers point to the right (+x) and the back of the hand up; a yaw of pi/2 turns the fingers to the front (-z), the pitch tilts them up (+) or down (-) and the roll turns
 * the hand about its fingers. The hand-local frame is the one of `HandPose` in `game-contracts`: x to the knuckles, y the back of the hand, z the little-finger side of a right hand.
 */
export type RestPose = { p: Triple; r: Triple; grip?: number }

/** Where the hands are while the stance is held. `follow` takes the hands from the targets (a hand without one goes to the `fallback` stance); a left hand of `'mirror'` is the mirror image of the right. */
export type StanceDef = { R?: RestPose; L?: RestPose | 'mirror'; follow?: boolean; fallback?: string }

/** The body of the arms, in metres in the camera's space. */
export type FirstPersonRig = {
  /** Right shoulder; the left one is its mirror image. */
  shoulder: Triple
  upper: number
  fore: number
  /** How far (m) a shoulder may move toward a hand it cannot reach, so long tools stay in the hands. 0 keeps the shoulders where they are. */
  reachShift: number
  /**
   * The elbow bend (radians, 0 straight) an arm keeps when its shoulder comes forward to a far hand, right then left: the shoulder stops short of a straight arm, so the
   * elbow and the wrist read on screen. Leave it out to stretch the arm to its full length first.
   */
  reachBend?: readonly [number, number]
  /**
   * Holding a tool, the way from the wrist to the elbow (camera space, right arm then left; x right, y up, -z ahead): the elbow is put there, kept inside the view, and the shoulder
   * behind it out of the view, so the bend of the arm shows on screen (a trigger elbow out to the side, a support elbow out under the forend). Leave it out to keep the
   * shoulders fixed and bend the elbows toward `elbowPole`; null for one arm keeps that arm so (a support hand cups a handguard from below, its elbow under the view).
   */
  elbowView?: readonly [Triple | null, Triple | null]
  /** From the wrist (where the sleeve ends) to the middle of the palm. */
  wrist: number
  /** The way the elbow bends, for the right arm; mirrored for the left. */
  elbowPole: Triple
  /** The left shoulder and the way its elbow bends, when they are not the mirror image of the right's: the support hand cups a handguard from below, so its shoulder sits nearer the middle and the elbow hangs under the forearm. */
  shoulderLeft?: Triple
  elbowPoleLeft?: Triple
  radius: { shoulder: number; elbow: number; wrist: number; cuff: number }
  /** The right hip, the bones of the leg, the way the knee bends, and where the foot waits below the view. */
  hip: Triple
  thigh: number
  shin: number
  kneePole: Triple
  foot: RestPose
}

export type FirstPersonBob = {
  /** Radians of the bob per metre walked. */
  frequency: number
  /** Metres of sway to the side and of rise and fall at a full walk. */
  x: number
  y: number
  /** The bob of running against walking. */
  run: number
  /** Speed (m/s) at which the bob is full. */
  fullSpeed: number
  /** Metres the arms sink when crouched. */
  crouch: number
}

export type FirstPersonColors = {
  /** 0xRRGGBB. Defaults come from the player's preset (`player-avatar.json`) and, with `createPlayerAvatar`, from the body itself. */
  skin: number
  sleeve: number
  cuff: number
  trouser: number
  shoe: number
}

export type FirstPersonArmsOptions = {
  colors?: Partial<FirstPersonColors>
  rig?: Partial<Omit<FirstPersonRig, 'radius' | 'foot'>> & { radius?: Partial<FirstPersonRig['radius']>; foot?: RestPose }
  /** Stances by id, merged over `relaxed`, `fists` and `hold`. */
  stances?: Readonly<Record<string, StanceDef>>
  /** The clips `play(id)` finds, such as `FIRST_PERSON_CLIPS` of game-characters-people. Default none. */
  clips?: readonly FirstPersonClip[]
  /** Seconds to move from one stance (or from a held tool to the rest) to the next. Default 0.18. */
  blend?: number
  /** In the `relaxed` stance with no clip playing (walking, standing, nothing in the hands) the hands drop out of the view and are not drawn; a strike, a shove, a held tool or `fists` bring them back. Default false. */
  hideWhenIdle?: boolean
  bob?: Partial<FirstPersonBob>
}

export type FirstPersonArmsState = {
  /** The player's eye. The arms are drawn in its space, so they cannot leave the view. */
  camera: THREE_NS.Object3D
  /** Where the tool in the hands asks them to be (world space), as `ModuleHost.setHandTargets` lends it. */
  targets?: HandTargets | null
  /** `hold` follows the targets; any other stance is a rest pose. Default `relaxed`. */
  stance?: string
  /** Where the world is: the distance along a ray (world space) to the first surface, or null for none within `maxDistance`. The hands and the foot stop at the surface (the elbow bends) instead of going into it. */
  contact?(origin: [number, number, number], direction: [number, number, number], maxDistance: number): number | null
  /** Ground speed, m/s. */
  speed?: number
  running?: boolean
  crouch?: boolean
}

export type FirstPersonEvent = PoseClipEvent & { clip: string }

export type FirstPersonArms = {
  /** Add it to the scene: it follows the camera by itself. */
  root: THREE_NS.Group
  /** Starts a clip; false when no registered clip has that id. The previous clip is dropped. */
  /** `leg: 'left'` plays the foot of the clip (the right foot) as the left one, in a mirror; `hand: 'left'` plays the hands in a mirror (the right hand's punch thrown by the left). */
  play(clip: string, options?: { leg?: 'left' | 'right'; hand?: 'left' | 'right' }): boolean
  stop(): void
  /** The clip being played, or null. */
  readonly playing: string | null
  /** The stance of the last update. */
  readonly stance: string
  update(dt: number, state: FirstPersonArmsState): void
  /** The clip's events (`impact` included), at the moment the clock reaches them. Returns the unsubscribe function. */
  on(type: 'event', listener: (event: FirstPersonEvent) => void): () => void
  /** The camera-space pose the hand is drawn at (for tests and for hosts that attach things to it). */
  handPose(side: 'R' | 'L'): { position: THREE_NS.Vector3; quaternion: THREE_NS.Quaternion; grip: number }
  /** Where the arm is drawn, in the camera's space: the shoulder, the elbow and the wrist (for tests of the way an arm reaches a hand). */
  joints(side: 'R' | 'L'): { shoulder: THREE_NS.Vector3; elbow: THREE_NS.Vector3; wrist: THREE_NS.Vector3 }
  dispose(): void
}
