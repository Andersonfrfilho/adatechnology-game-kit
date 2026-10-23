import type { Vec3 } from './destruction'

/** Pose of one part (or of the whole item) at a key: position offset in metres and Euler XYZ rotation in radians, both relative to the rest pose. */
export interface AnimationPose {
  position?: Vec3
  rotation?: Vec3
}

export interface AnimationKey {
  /** Seconds from the start of the clip. */
  t: number
  /** Pose of the item's root. */
  position?: Vec3
  rotation?: Vec3
  /** Poses of named parts: the key is a destruction part id (a pistol `reload` moves `mag`; a car door `open` rotates `door_l`). */
  parts?: Record<string, AnimationPose>
}

export interface AnimationEventSpec {
  /** Seconds from the start of the clip. */
  t: number
  /** snake_case type the host maps (`sound`, `eject_casing`, `door_latch`...). */
  type: string
  data?: Record<string, unknown>
}

/** A use animation a module brings with its item. Poses between keys are interpolated by the player (the test room does it linearly). */
export interface AnimationClipSpec {
  /** snake_case: `reload`, `open`, `drink`... Unique within the item. */
  id: string
  /** Seconds. */
  duration: number
  keys: AnimationKey[]
  events?: AnimationEventSpec[]
}

/** What an item exposes when it brings its own animations. */
export interface ItemAnimationContract {
  animations: AnimationClipSpec[]
}

const finite3 = (v: unknown): boolean => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))

/**
 * Problems with a clip (empty when it is valid): a snake_case id, a positive finite duration, at least one key, key and event times inside
 * `[0, duration]` and not going backwards, finite vectors, every named part one of `partIds`, event types that are non-empty strings and
 * JSON-serializable event data.
 */
export const checkAnimation = (clip: AnimationClipSpec, partIds: Iterable<string>): { ok: boolean; problems: string[] } => {
  const problems: string[] = []
  const parts = new Set(partIds)
  const id = String(clip?.id ?? '')
  if (!/^[a-z][a-z0-9_]*$/.test(id)) problems.push(`clip id "${id}" must be snake_case`)
  const label = `clip "${id}"`
  if (!(typeof clip?.duration === 'number' && Number.isFinite(clip.duration) && clip.duration > 0)) problems.push(`${label} needs a positive finite duration`)
  const dur = typeof clip?.duration === 'number' && clip.duration > 0 ? clip.duration : Infinity
  if (!Array.isArray(clip?.keys) || clip.keys.length === 0) {
    problems.push(`${label} needs at least one key`)
    return { ok: false, problems }
  }
  let prev = -Infinity
  clip.keys.forEach((k, i) => {
    if (!(typeof k.t === 'number' && Number.isFinite(k.t)) || k.t < 0 || k.t > dur + 1e-9) problems.push(`${label} key ${i} has t=${String(k.t)} outside 0..${dur}`)
    else if (k.t < prev) problems.push(`${label} key ${i} goes back in time (${k.t} < ${prev})`)
    else prev = k.t
    for (const f of ['position', 'rotation'] as const) if (k[f] !== undefined && !finite3(k[f])) problems.push(`${label} key ${i} has an invalid ${f}`)
    for (const [pid, pose] of Object.entries(k.parts ?? {})) {
      if (!parts.has(pid)) problems.push(`${label} key ${i} moves unknown part "${pid}"`)
      for (const f of ['position', 'rotation'] as const) if (pose?.[f] !== undefined && !finite3(pose[f])) problems.push(`${label} key ${i} part "${pid}" has an invalid ${f}`)
    }
  })
  let prevEv = -Infinity
  ;(clip.events ?? []).forEach((e, i) => {
    if (!(typeof e.t === 'number' && Number.isFinite(e.t)) || e.t < 0 || e.t > dur + 1e-9) problems.push(`${label} event ${i} has t=${String(e.t)} outside 0..${dur}`)
    else if (e.t < prevEv) problems.push(`${label} event ${i} goes back in time`)
    else prevEv = e.t
    if (typeof e.type !== 'string' || e.type === '') problems.push(`${label} event ${i} needs a type`)
    try {
      JSON.stringify(e.data ?? {})
    } catch {
      problems.push(`${label} event ${i} data is not JSON`)
    }
  })
  return { ok: problems.length === 0, problems }
}
