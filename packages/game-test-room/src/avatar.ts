/**
 * The player's body in the room and the third-person camera. Generic: the room knows an avatar only by this interface (a body from any package
 * that fits it, such as `createPlayerAvatar` of `@adatechnology/game-characters-three`), and no character code is imported here.
 */
import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'
import type { HandTargets } from '@adatechnology/game-contracts'

/** What the room tells the avatar every frame. */
export interface RoomAvatarState {
  /** Ground speed of the player, m/s (from the movement of the feet, jumps ignored). */
  speed: number
  /** Shift held. */
  running: boolean
  crouch: boolean
  down: boolean
  /** A firearm is the tool in hand. */
  armed: boolean
  /** Camera pitch, radians, positive looking up (the room's own convention). */
  pitch: number
}

/** What the room tells the first-person arms every frame, after the modules have placed the tool in the hands. */
export interface RoomFirstPersonState {
  /** The player's eye: the arms are drawn in its space. */
  camera: THREE_NS.Object3D
  /** Where the tool in the hands asks them to be (world space): the module's, else the carried item's, else null. */
  targets: HandTargets | null
  /** `hold` when something is held (targets), else the rest stance of the tool in hand (`relaxed`, `fists`...; `RoomOptions.handStances`). */
  stance: string
  speed: number
  running: boolean
  crouch: boolean
}

/** A body the room can show. The room puts `root` at the player's feet turned to where the player looks: the body's front is +z (as the catalogue items'), so `rotation.y` is the player's yaw plus pi. */
export interface RoomAvatar {
  root: THREE_NS.Object3D
  update(dt: number, state: RoomAvatarState): void
  /** A socket at a hand: the carried item follows `hand('R')` in third person. */
  hand?(side: 'R' | 'L'): THREE_NS.Object3D
  /**
   * The arms of the first-person view. The room shows `root` only in first person (the body only in third), updates it every frame after the modules'
   * frame hooks (so the tool in the hands is already placed) and before the render.
   */
  firstPerson?: { root: THREE_NS.Object3D; update(dt: number, state: RoomFirstPersonState): void }
  /**
   * Plays the strike `clipId` (on the body and on the arms) and answers the seconds until its impact, or null when this avatar has no such clip. The room then waits that long
   * before the blow lands (`strikeClips`); an avatar without `strike`, or one that answers null, gets the blow at the click.
   */
  strike?(clipId: string): number | null
}

export type CameraMode = 'first' | 'third'

/** Which clip a melee tool plays before its blow lands (`TestRoomOptions.strikeClips`). */
export const DEFAULT_STRIKE_CLIPS: Readonly<Record<string, string>> = { fists: 'punch_right', shove: 'shove_two_hands', kick: 'front_kick' }
/** The first-person stance of the tools that choose one (`TestRoomOptions.handStances`). */
export const DEFAULT_HAND_STANCES: Readonly<Record<string, string>> = { fists: 'fists' }

/**
 * The over-the-shoulder view, metres. Defaults are the numbers of the team game's shoulder camera
 * (`site/pages/jogo/zombiada-modo-livre.html`, `cameraUpdate`, line 76546): `view.cb` 3.8 back, `view.cs` 0.9 to the side, `view.cu` 1.95 high
 * (1.4 crouched), the `+ 0.1` lift of the camera at line 76551, and three probe rays (centre and +-0.2 m, line 76557) that pull the camera in
 * 0.3 m short of a wall (`h.t - 0.3`, never closer than 0.2 m) and let it out again slowly (`dt * 4`, line 76558).
 */
export interface ThirdPersonOptions {
  /** Distance behind the pivot. Default 3.8. */
  back?: number
  /** Pivot offset to the right of the player (negative: left shoulder). Default 0.9. */
  side?: number
  /** Pivot height above the feet. Default 1.95. */
  up?: number
  /** Pivot height above the feet while crouched. Default 1.4. */
  crouchUp?: number
  /** Extra height of the camera over the line from the pivot. Default 0.1. */
  lift?: number
  /** How far short of a wall the camera stops. Default 0.3. */
  margin?: number
  /** Closest the camera comes to the pivot. Default 0.2. */
  minDistance?: number
  /** Sideways offsets of the probe rays. Default `[0, 0.2, -0.2]`. */
  probes?: readonly number[]
  /** Per second rate at which the camera returns after a wall is gone. Default 4. */
  recover?: number
}

export const THIRD_PERSON_DEFAULTS: Required<ThirdPersonOptions> = {
  back: 3.8,
  side: 0.9,
  up: 1.95,
  crouchUp: 1.4,
  lift: 0.1,
  margin: 0.3,
  minDistance: 0.2,
  probes: [0, 0.2, -0.2],
  recover: 4,
}

/** First blocking distance along a ray from `origin` (unit `direction`) within `max`, or null. */
export type FreeProbe = (origin: Vec3, direction: Vec3, max: number) => number | null

export interface ThirdPersonInput {
  x: number
  z: number
  feet: number
  yaw: number
  pitch: number
  crouch: boolean
}

export interface ThirdPersonPose {
  /** Where the camera stands (pulled in to `free`). */
  position: Vec3
  /** Where the camera would stand `distance` metres from the pivot along the same line. */
  at(distance: number): Vec3
  /** The point it looks past (the shoulder pivot). */
  pivot: Vec3
  /** Unit view direction, the same as the first-person one. */
  direction: Vec3
  /** The distance from pivot the view asks for, and how far a wall lets it go. */
  wanted: number
  free: number
}

/** The camera of the shoulder view: behind and beside the player along the view direction, pulled in against walls. */
export function thirdPersonPose(input: ThirdPersonInput, options: Required<ThirdPersonOptions>, probe: FreeProbe): ThirdPersonPose {
  const cy = Math.cos(input.pitch)
  const d: Vec3 = [-Math.sin(input.yaw) * cy, Math.sin(input.pitch), -Math.cos(input.yaw) * cy]
  const rx = Math.cos(input.yaw)
  const rz = -Math.sin(input.yaw)
  const pivot: Vec3 = [input.x + rx * options.side, input.feet + (input.crouch ? options.crouchUp : options.up), input.z + rz * options.side]
  const dx = -d[0] * options.back
  const dy = -d[1] * options.back + options.lift
  const dz = -d[2] * options.back
  const wanted = Math.hypot(dx, dy, dz)
  const dir: Vec3 = [dx / wanted, dy / wanted, dz / wanted]
  let free = wanted
  for (const o of options.probes) {
    const hit = probe([pivot[0] + rx * o, pivot[1], pivot[2] + rz * o], dir, wanted)
    if (hit !== null) free = Math.min(free, Math.max(options.minDistance, hit - options.margin))
  }
  const at = (distance: number): Vec3 => [pivot[0] + dir[0] * distance, Math.max(0.1, pivot[1] + dir[1] * distance), pivot[2] + dir[2] * distance]
  return { position: at(free), at, pivot, direction: d, wanted, free }
}
