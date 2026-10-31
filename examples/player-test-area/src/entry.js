// Bundle entry (IIFE global `PlayerArea`): the player bench module of @adatechnology/game-player, ready for any room page:
// `PlayerArea.loadInto(room)` loads it with `room.loadModule` and opens its area. The module is written against the generic contracts only: the room's
// camera is the player body, and the footsteps and flesh sounds go to the room's engine (`host.audio`).
// Bench: individual infection (off by default), agility, vigor, seed; hurt, bite, grab, push, knife, bandage, knocked down, crouch, start again.
// Metrics: health, stamina, bleeding, wounds, infection, time left, panic, aim spread, grab timer, last noise, footsteps, message.
//
// The body: `loadInto` gives the room the player's avatar (`createPlayerAvatar` of @adatechnology/game-characters-three) and starts in third person (V toggles),
// loads the avatar area (`avatar_area`: view, crouch, fall, armed, the grab and bite clips and the strikes: punch, shove, kick, the recoil of a rifle and of a pistol) and links the player to the body: crouching crouches it, a knock-down
// (or death) lays it down, and being grabbed plays the Bestiário clip `grabbed_bitten_human` until the player is let go. three.js comes from the page (`options.THREE`,
// else `window.__THREE`): the bundle never carries a second copy.
import { POSE_CLIPS } from '@adatechnology/game-characters'
import { ATTACK_CLIPS, ATTACK_CLIP_LOCALES } from '@adatechnology/game-characters-people'
import { PLAYER_DEFAULTS, createPlayer } from '@adatechnology/game-player'
import { createPlayerTestModule } from '@adatechnology/game-player/testing'
import { AVATAR_AREA_ID, createAvatarTestModule, createPlayerAvatar, toRoomAvatar } from '@adatechnology/game-characters-three'
import { defaultCharacterClips } from '@adatechnology/game-kit-defaults'

export { PLAYER_DEFAULTS, createPlayer, createPlayerTestModule, AVATAR_AREA_ID }

const localeOf = (options) => options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')

/** The module for the room's locale (`?lang=en` or pt-BR); other pages (the furniture area) load it next to their own. */
export function createModule(options = {}) {
  return createPlayerTestModule({ ...options, locale: localeOf(options) })
}

/**
 * A module with no items and no bench that links the gameplay state to the body every frame: the player's crouch, knock-down and death to
 * `room.setAvatarState`, and a grab to the clip (`grab_clip`, default `grabbed_bitten_human`), which stops when the player is released.
 */
export function createAvatarLink(room, playerModule, avatar, options = {}) {
  const clip = options.grabClip ?? 'grabbed_bitten_human'
  let grabbed = false
  return {
    id: 'player_avatar_link',
    name: 'Player avatar link',
    group: 'Avatar link',
    items: () => [],
    attach(host) {
      return host.onFrame(() => {
        const P = playerModule.player.state
        const down = P.downTimer > 0 || !P.alive
        room.setAvatarState({ crouch: P.crouch, down })
        const nowGrabbed = P.grabbedBy >= 0 && P.alive
        if (nowGrabbed && !grabbed) {
          avatar.play(clip)
          host.log(JSON.stringify({ type: 'avatar', action: 'grabbed', clip }), { type: 'avatar', action: 'grabbed', clip })
        } else if (!nowGrabbed && grabbed && avatar.playing === clip) {
          avatar.stop()
          host.log(JSON.stringify({ type: 'avatar', action: 'released', clip }), { type: 'avatar', action: 'released', clip })
        }
        grabbed = nowGrabbed
      })
    },
  }
}

/**
 * Creates the player module and the body, loads both areas and the link, and opens the player area in third person. Returns the room's module report
 * (the player's, plus `avatar` with the avatar area's and `modules`).
 */
export function loadInto(room, options = {}) {
  const THREE = options.THREE ?? globalThis.__THREE
  if (!THREE) throw new Error('PlayerArea.loadInto needs three.js: pass { THREE } or expose it as window.__THREE')
  const locale = localeOf(options)
  const previous = room.avatar
  const avatar = createPlayerAvatar(THREE, options.avatar)
  room.setAvatar(toRoomAvatar(avatar, defaultCharacterClips()))
  previous?.avatar?.dispose?.()
  const playerModule = createModule(options)
  const report = room.loadModule(playerModule)
  const avatarReport = room.loadModule(
    createAvatarTestModule({
      avatar,
      locale,
      clips: [...POSE_CLIPS, ...ATTACK_CLIPS],
      clipLocales: ATTACK_CLIP_LOCALES,
      camera: { mode: () => room.cameraMode, set: (mode) => room.setCameraMode(mode) },
      state: { set: (state) => room.setAvatarState(state) },
    }),
  )
  const linkReport = room.loadModule(createAvatarLink(room, playerModule, avatar, options))
  room.setCameraMode(options.cameraMode ?? 'third')
  room.openArea('player_area')
  const reports = [report, avatarReport, linkReport]
  return { ...report, ok: reports.every((r) => r.ok), problems: reports.flatMap((r) => r.problems), avatar: avatarReport, modules: reports.map((r) => r.module) }
}
