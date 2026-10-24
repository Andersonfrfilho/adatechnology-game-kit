import { STAGE_EVENT } from '@adatechnology/game-contracts'
import type { AnimationClipSpec, AnimationEventSpec, AnimationPose } from '@adatechnology/game-contracts'

export type Axis = 'x' | 'y' | 'z'
type Channel = 'position' | 'rotation'

/** The gallery's `tw(delay, duration, e => part.property = from + (to - from) * e)`: one axis of one part, eased, then held at `to`. */
export interface Tween {
  readonly part: string
  readonly channel: Channel
  readonly axis: Axis
  readonly start: number
  readonly duration: number
  readonly from: number
  readonly to: number
}

/** The part id of the whole weapon in a clip's tweens. */
export const ROOT = 'root'

const AXIS_INDEX: Record<Axis, number> = { x: 0, y: 1, z: 2 }
// the gallery eases with this curve; keys are linear, so each tween is sampled at this many steps (largest error 0.4% of the move)
const EASE_STEPS = 10

export const ease = (progress: number): number => (progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2)

export const move = (part: string, axis: Axis, start: number, duration: number, from: number, to: number): Tween => ({ part, channel: 'position', axis, start, duration, from, to })
export const turn = (part: string, axis: Axis, start: number, duration: number, from: number, to: number): Tween => ({ part, channel: 'rotation', axis, start, duration, from, to })

/** A step of the clip at `t` the host maps (`muzzle_flash`, `eject_casing`, `drop_magazine`...). */
export const cue = (t: number, type: string, data?: Record<string, unknown>): AnimationEventSpec => ({ t, type, ...(data ? { data } : {}) })

export const stage = (id: string, t: number): AnimationEventSpec => ({ t, type: STAGE_EVENT, data: { stage: id } })

const valueAt = (tweens: readonly Tween[], t: number, includeInstants: boolean): number => {
  let value = 0
  for (const tween of tweens) {
    if (tween.start > t || (tween.duration === 0 && (tween.start === t ? !includeInstants : false))) continue
    if (tween.duration === 0 || t >= tween.start + tween.duration) value = tween.to
    else value = tween.from + (tween.to - tween.from) * ease((t - tween.start) / tween.duration)
  }
  return value
}

const round = (value: number): number => Math.round(value * 1e6) / 1e6

/** Builds a clip from tweens and cue events: one key at every start, end and sample of a tween, and a step (two keys at one time) for an instant set. */
export function composeClip(id: string, tweens: readonly Tween[], events: readonly AnimationEventSpec[] = [], minDuration = 0): AnimationClipSpec {
  const ordered = [...tweens].sort((a, b) => a.start - b.start)
  const duration = Math.max(minDuration, 0.001, ...ordered.map((tween) => tween.start + tween.duration), ...events.map((event) => event.t))
  const times = new Set<number>([0, duration])
  for (const tween of ordered) {
    times.add(round(tween.start))
    if (tween.duration > 0) for (let step = 1; step <= EASE_STEPS; step++) times.add(round(tween.start + (tween.duration * step) / EASE_STEPS))
  }
  const instants = new Set(ordered.filter((tween) => tween.duration === 0).map((tween) => round(tween.start)))
  const channels = new Map<string, Tween[]>()
  for (const tween of ordered) {
    const key = `${tween.part}|${tween.channel}|${tween.axis}`
    channels.set(key, [...(channels.get(key) ?? []), tween])
  }
  const sampleKey = (t: number, includeInstants: boolean): AnimationClipSpec['keys'][number] => {
    const poses = new Map<string, { position: [number, number, number]; rotation: [number, number, number] }>()
    for (const [key, list] of channels) {
      const [part, channel, axis] = key.split('|') as [string, Channel, Axis]
      const pose = poses.get(part) ?? { position: [0, 0, 0], rotation: [0, 0, 0] }
      pose[channel][AXIS_INDEX[axis]] = round(valueAt(list, t, includeInstants))
      poses.set(part, pose)
    }
    const root = poses.get(ROOT)
    poses.delete(ROOT)
    const parts: Record<string, AnimationPose> = {}
    for (const [part, pose] of poses) parts[part] = pose
    return { t, ...(root ? { position: root.position, rotation: root.rotation } : {}), ...(poses.size ? { parts } : {}) }
  }
  const keys: AnimationClipSpec['keys'] = []
  for (const t of [...times].sort((a, b) => a - b)) {
    if (instants.has(t)) keys.push(sampleKey(t, false))
    keys.push(sampleKey(t, true))
  }
  const sorted = [...events].sort((a, b) => a.t - b.t)
  return { id, duration, keys, ...(sorted.length ? { events: sorted } : {}) }
}

/** The same clip under another id (the clip set keys are the ids). */
export const renamed = (clip: AnimationClipSpec, id: string): AnimationClipSpec => ({ ...clip, id })
