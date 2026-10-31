import { ATTACK_CLIPS, FIRST_PERSON_CLIPS } from '@adatechnology/game-characters-people'
import { mirrorPoseClip } from '@adatechnology/game-characters'
import type { FirstPersonClip, PoseClip } from '@adatechnology/game-characters'
import type { HandTargets } from '@adatechnology/game-contracts'

import { createFirstPersonArms } from '../first-person/arms'
import type { FirstPersonArms, FirstPersonArmsOptions } from '../first-person/types'
import type { AvatarItemUsePose, PlayerAvatar } from './avatar'
import type { THREE_NS } from '../three'

/** What `@adatechnology/game-test-room` calls a `RoomAvatar`, restated here so this package does not depend on the room. */
export type RoomAvatarLike = {
  root: THREE_NS.Object3D
  update(dt: number, state: { speed: number; running: boolean; crouch: boolean; down: boolean; armed: boolean; pitch: number; push?: { readonly phase: 'grip' | 'push' | 'strain'; readonly progress: number } | null; holding?: boolean; itemUse?: AvatarItemUsePose | null; seat?: { readonly pose: 'sit' | 'lie'; readonly hip: number } | null }): void
  hand(side: 'R' | 'L'): THREE_NS.Object3D
  shoulder(side: 'R' | 'L'): THREE_NS.Object3D
  /** The arms of the first-person view (`RoomAvatar.firstPerson`); absent when `toRoomAvatar` was told to make none. */
  firstPerson?: { root: THREE_NS.Object3D; update(dt: number, state: { camera: THREE_NS.Object3D; targets: HandTargets | null; stance: string; speed: number; running: boolean; crouch: boolean; contact?(origin: [number, number, number], direction: [number, number, number], maxDistance: number): number | null }): void }
  /** Brings the body's hands to the tool in them, in third person (`RoomAvatar.reach`). */
  reach(targets: HandTargets | null): void
  /** Plays a strike on the body and the arms and answers the seconds to its impact (`RoomAvatar.strike`). */
  strike(clipId: string, options?: { leg?: 'left' | 'right'; hand?: 'left' | 'right' }): number | null
  /** The avatar it wraps. */
  readonly avatar: PlayerAvatar
  /** The first-person arms, for whoever wants more of them than the room asks (`play`, `on('event')`). */
  readonly arms: FirstPersonArms | null
}

export type ToRoomAvatarOptions = {
  /** The first-person arms: `false` for none, else the options of `createFirstPersonArms` (merged over the colours of the body and `firstPersonClips`). */
  firstPerson?: false | FirstPersonArmsOptions
  /** The third-person strike clips `strike` finds by id. Default `ATTACK_CLIPS` of game-characters-people. */
  strikeClips?: readonly PoseClip[]
  /** The first-person clips the arms play. Default `FIRST_PERSON_CLIPS` of game-characters-people. */
  firstPersonClips?: readonly FirstPersonClip[]
  /** The looping clip the body holds between punches (a clip of `strikeClips`), so a combo goes guard, punch, guard instead of dropping the hands each time; `false` for none. Default `'fight_guard'`. */
  guardClip?: string | false
  /** Seconds the guard stays up after a punch ends. Default 1.2. */
  guardHold?: number
  /** Seconds a punch takes to blend in over the walk (or the guard it comes from). Default 0.05: the fist leaves at once. */
  punchBlend?: number
}

/** The impact second of a clip: the time of its first `impact` event. */
const impactOf = (clip: PoseClip): number | null => clip.events?.find((event) => event.type === 'impact')?.t ?? null
/** A punch is a clip whose impact is a `punch` (the hands close for it); after one the body keeps the guard. */
const isPunch = (clip: PoseClip): boolean => clip.events?.some((event) => event.type === 'impact' && event.data?.kind === 'punch') ?? false
/** Below this ground speed the body stands to keep the guard; walking gives the legs back to the gait. */
const GUARD_SPEED = 0.3

/**
 * Fits the player's body to the test room's `RoomAvatar` (`room.setAvatar(toRoomAvatar(createPlayerAvatar(THREE)))`). It changes the sign of the pitch: the room
 * counts a look up as positive, the team game's `view.pitch` (what `AvatarUpdate.pitch` reads) counts a look down as positive. It also gives the room the first-person arms, dressed in the
 * colours of the body (`firstPerson: false` for none), and `strike(clipId)`: the strike plays on the body (the attack clips) and on the arms (the first-person clips), and answers the seconds to its
 * impact, which are the same in both views. A kick with the left leg (`leg: 'left'`) or a punch with the left hand (`hand: 'left'`) plays the mirror of the clip written for the right.
 * After a punch the body holds the guard (`guardClip`) for `guardHold` seconds while it stands, so the next punch leaves from the guard.
 */
export const toRoomAvatar = (avatar: PlayerAvatar, options: ToRoomAvatarOptions = {}): RoomAvatarLike => {
  const arms =
    options.firstPerson === false
      ? null
      : createFirstPersonArms(avatar.three, {
          colors: { skin: avatar.colors.skin, sleeve: avatar.colors.longSleeves ? avatar.colors.shirt : avatar.colors.skin, trouser: avatar.colors.trousers, shoe: avatar.colors.shoes, ...options.firstPerson?.colors },
          clips: options.firstPersonClips ?? FIRST_PERSON_CLIPS,
          hideWhenIdle: true,
          ...options.firstPerson,
        })
  const strikes = new Map((options.strikeClips ?? ATTACK_CLIPS).map((clip) => [clip.id, clip]))
  const mirrored = new Map<string, PoseClip>()
  /** The clip for a kick with the left leg or a punch with the left hand: the mirror of the one that is written for the right. */
  const leftOf = (clip: PoseClip): PoseClip => {
    let found = mirrored.get(clip.id)
    if (!found) mirrored.set(clip.id, (found = mirrorPoseClip(clip, `${clip.id}_left`)))
    return found
  }
  const guard = options.guardClip === false ? undefined : strikes.get(options.guardClip ?? 'fight_guard')
  const guardHold = options.guardHold ?? 1.2
  const punchBlend = options.punchBlend ?? 0.05
  let strikeLeft = 0 // seconds of the punch still to play
  let guardLeft = 0 // seconds the guard stays up after it
  let guarding = false
  const stepGuard = (dt: number, state: Parameters<RoomAvatarLike['update']>[1]): void => {
    if (!guard) return
    const free = state.speed < GUARD_SPEED && !state.down && !state.armed && !state.holding && !state.push && !state.itemUse && !state.running
    if (strikeLeft > 0) {
      strikeLeft -= dt
      if (strikeLeft <= 0 && guardLeft > 0 && free) {
        avatar.play(guard)
        guarding = true
      }
      return
    }
    guardLeft = Math.max(0, guardLeft - dt)
    if (guarding && (guardLeft <= 0 || !free || avatar.playing !== guard.id)) {
      if (avatar.playing === guard.id) avatar.stop()
      guarding = false
    }
  }
  return {
    root: avatar.root,
    avatar,
    arms,
    ...(arms ? { firstPerson: { root: arms.root, update: (dt: number, state: Parameters<NonNullable<RoomAvatarLike['firstPerson']>['update']>[1]) => arms.update(dt, state) } } : {}),
    update: (dt, state) => {
      stepGuard(dt, state)
      avatar.update(dt, {
        speed: state.speed,
        running: state.running,
        crouch: state.crouch,
        down: state.down,
        armed: state.armed,
        pitch: -state.pitch,
        ...(state.holding !== undefined ? { holding: state.holding } : {}),
        ...(state.itemUse !== undefined ? { itemUse: state.itemUse } : {}),
        ...(state.push !== undefined ? { push: state.push } : {}),
        ...(state.seat !== undefined ? { seat: state.seat } : {}),
      })
    },
    hand: (side) => avatar.hand(side),
    shoulder: (side) => avatar.shoulder(side),
    reach: (targets) => avatar.reach(targets),
    strike: (clipId, strikeOptions) => {
      const clip = strikes.get(clipId)
      if (!clip) return null
      const left = strikeOptions?.leg === 'left' || strikeOptions?.hand === 'left'
      const punch = guard !== undefined && isPunch(clip)
      avatar.play(left ? leftOf(clip) : clip, punch ? { blend: punchBlend } : undefined)
      strikeLeft = punch ? clip.duration : 0
      guardLeft = punch ? guardHold : 0
      guarding = false
      arms?.play(clipId, strikeOptions?.leg === 'left' ? { leg: 'left' } : strikeOptions?.hand === 'left' ? { hand: 'left' } : undefined)
      return impactOf(clip)
    },
  }
}
