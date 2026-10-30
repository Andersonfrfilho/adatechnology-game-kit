import { POSE_CLIPS, POSE_CLIP_LOCALES } from '@adatechnology/game-characters'
import type { PoseClip } from '@adatechnology/game-characters'
import type { BenchChange, ModuleArea, ModuleControl, ModuleHost, ModuleMetric, TestableModule } from '@adatechnology/game-contracts'

import type { PlayerAvatar } from './avatar'
import { AVATAR_TEXT } from './test-text'

export const AVATAR_AREA_ID = 'avatar_area'

export type AvatarTestOptions = {
  /** The body under test (the example makes it with `createPlayerAvatar(THREE)` and gives the same one to the room). */
  avatar: PlayerAvatar
  /** The text language when the host does not ask for one. Default `pt-BR`. */
  locale?: string
  /** The clips offered as buttons. Default `POSE_CLIPS` (the two of the Bestiário); a game adds its strikes, such as `ATTACK_CLIPS` of game-characters-people. */
  clips?: readonly PoseClip[]
  /** Texts of the `phase` labels of `clips` by locale, merged over `POSE_CLIP_LOCALES` (for example `ATTACK_CLIP_LOCALES`). */
  clipLocales?: Readonly<Record<string, Readonly<Record<string, string>>>>
  /** The room's view: `mode()` reads it, `set` changes it (`room.cameraMode` and `room.setCameraMode`). Without it the camera buttons only log. */
  camera?: { mode(): 'first' | 'third'; set(mode: 'first' | 'third'): void }
  /** The room's avatar state (`room.setAvatarState`): the module drives crouch, down and the armed arms through it. */
  state?: { set(state: { crouch?: boolean; down?: boolean; armed?: boolean | null }): void }
}

const round = (value: number): string => (Math.round(value * 100) / 100).toString()

/**
 * The player's body as a `TestableModule` for the area `avatar_area`: bench buttons for the view (1st and 3rd person), crouch, fall and get up, the armed arms and every registered
 * pose clip (grab, bite), and metrics for the camera, the clip, its last event and the joints. Every action goes to the room's
 * log as JSON. It uses only the contracts: the body, the camera and the state come in by option, so the module knows no room.
 */
export function createAvatarTestModule(options: AvatarTestOptions): TestableModule & { readonly state: { crouch: boolean; down: boolean; armed: boolean | null } } {
  const clips = options.clips ?? POSE_CLIPS
  const textOf = (locale?: string) => AVATAR_TEXT[locale ?? options.locale ?? 'pt-BR'] ?? (AVATAR_TEXT['pt-BR'] as (typeof AVATAR_TEXT)[string])
  const phaseLabel = (label: unknown, locale?: string): string => {
    const id = locale ?? options.locale ?? 'pt-BR'
    const table = { ...(POSE_CLIP_LOCALES[id] ?? POSE_CLIP_LOCALES['pt-BR']), ...(options.clipLocales?.[id] ?? options.clipLocales?.['pt-BR']) }
    return typeof label === 'string' ? (table[label] ?? label) : ''
  }
  const state = { crouch: false, down: false, armed: null as boolean | null }
  let host: ModuleHost | null = null
  let lastEvent = ''

  const log = (action: string, extra: Record<string, unknown> = {}): void => {
    const entry = { type: 'avatar', action, ...extra }
    host?.log(JSON.stringify(entry), entry)
  }
  const push = (action: string, patch: Partial<typeof state>, extra: Record<string, unknown> = {}): void => {
    Object.assign(state, patch)
    options.state?.set(patch)
    log(action, { crouch: state.crouch, down: state.down, armed: state.armed, ...extra })
  }
  const setCamera = (mode: 'first' | 'third'): void => {
    options.camera?.set(mode)
    log(`camera_${mode}`, { mode: options.camera?.mode() ?? null })
  }

  const onChange = (change: BenchChange): void => {
    if (change.kind !== 'action') return
    switch (change.id) {
      case 'camera_first':
        return setCamera('first')
      case 'camera_third':
        return setCamera('third')
      case 'crouch':
        return push('crouch', { crouch: true })
      case 'stand':
        return push('stand', { crouch: false })
      case 'fall':
        return push('fall', { down: true })
      case 'get_up':
        return push('get_up', { down: false })
      case 'armed_on':
        return push('armed_on', { armed: true })
      case 'armed_off':
        return push('armed_off', { armed: false })
      case 'stop_clip':
        options.avatar.stop()
        return log('stop_clip', { playing: options.avatar.playing })
      default: {
        const clip = clips.find((item) => `play_${item.id}` === change.id)
        if (!clip) return
        options.avatar.play(clip)
        log('play_clip', { clip: clip.id, duration: clip.duration, loop: clip.loop ?? false, channels: clip.channels ?? 'full' })
      }
    }
  }

  const joints = (): string => {
    const rig = options.avatar.rig
    const [armA, armB] = rig.arms
    const [legA, legB] = rig.legs
    return `arms ${round(armA!.g.rotation.x)}/${round(armB!.g.rotation.x)} elbows ${round(armA!.el.rotation.x)}/${round(armB!.el.rotation.x)} legs ${round(legA!.g.rotation.x)}/${round(legB!.g.rotation.x)} knees ${round(legA!.kn.rotation.x)}/${round(legB!.kn.rotation.x)} lean ${round(rig.upper.rotation.x)}`
  }

  return {
    id: AVATAR_AREA_ID,
    name: textOf().name,
    ground: { surface: 'concrete_slab' },
    group: textOf().group,
    state,
    items: () => [],
    area: (): ModuleArea => ({ placements: [], view: { eye: [0, 1.7, 6], target: [0, 1.2, 0] } }),
    controls: (locale): ModuleControl[] => {
      const text = textOf(locale)
      const action = (id: string, name: string, hint?: string): ModuleControl => ({ kind: 'action', id, name, ...(hint ? { hint } : {}) })
      return [
        action('camera_first', text.actions.camera_first),
        action('camera_third', text.actions.camera_third),
        action('crouch', text.actions.crouch),
        action('stand', text.actions.stand),
        action('fall', text.actions.fall),
        action('get_up', text.actions.get_up),
        action('armed_on', text.actions.armed_on),
        action('armed_off', text.actions.armed_off),
        ...clips.map((clip) => action(`play_${clip.id}`, `${text.play}: ${clip.id}`)),
        action('stop_clip', text.actions.stop_clip),
      ]
    },
    metrics: (locale): ModuleMetric[] => {
      const text = textOf(locale)
      return [
        { id: 'camera', name: text.metrics.camera, read: () => options.camera?.mode() ?? text.none },
        { id: 'clip', name: text.metrics.clip, read: () => options.avatar.playing ?? text.none },
        { id: 'last_event', name: text.metrics.last_event, read: () => lastEvent || text.none },
        { id: 'state', name: text.metrics.state, read: () => `${state.crouch ? 'crouch ' : ''}${state.down ? 'down ' : ''}${state.armed === null ? '' : state.armed ? 'armed' : 'unarmed'}`.trim() || text.none },
        { id: 'joints', name: text.metrics.joints, read: joints },
      ]
    },
    attach(lent) {
      host = lent
      const stopChange = lent.bench?.onChange(onChange)
      const stopEvents = options.avatar.on('event', (event) => {
        lastEvent = `${event.clip} ${event.type} ${round(event.t)}s${event.data && 'label' in event.data ? ` ${phaseLabel(event.data.label)}` : ''}`
        log('clip_event', { clip: event.clip, event: event.type, t: event.t, data: event.data ?? null })
        if (event.type === 'impact') log('impact', { clip: event.clip, t: event.t, kind: event.data?.kind ?? null })
      })
      return () => {
        stopChange?.()
        stopEvents()
        host = null
      }
    },
  }
}
