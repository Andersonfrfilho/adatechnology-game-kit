import type { PoseClipEvent } from './pose-clip'

type Triple = [number, number, number]

/**
 * A hand or a foot in the camera's space (x to the right, y up, the view looks down -z), in metres and radians. `p` is the middle of the palm (the ankle for a foot) and `r` the Euler angles
 * (order XYZ) of its frame: x from the wrist to the knuckles (from the heel to the toes), y the back of the hand (the top of the foot), z the rest of the right-handed frame; a left hand is the
 * mirror image of a right one, so the same numbers describe the same grip.
 */
export type FirstPersonPoseKey = {
  p: Triple
  r: Triple
  /** How closed the fingers are, 0 open to 1 closed; left out, the fingers keep what the stance has. */
  grip?: number
  /** How much of the clip replaces what the hand is doing otherwise (holding a weapon, the stance), 0 none to 1 all. Default 1. */
  w?: number
}

/** One key: at `t` seconds the right hand (`R`), the left hand (`L`, or `'mirror'` for the mirror image of the right) and the right foot (`F`) are where the entries say. A side without an entry here is not driven by this key. */
export type FirstPersonKey = { t: number; R?: FirstPersonPoseKey; L?: FirstPersonPoseKey | 'mirror'; F?: FirstPersonPoseKey }

/** A first-person animation of the hands and the foot: the counterpart of a third-person `PoseClip`, with the same events. */
export type FirstPersonClip = {
  id: string
  duration: number
  keys: FirstPersonKey[]
  events?: PoseClipEvent[]
  /** Where the clip was ported from, or who authored it. */
  source?: Record<string, unknown>
}

/** What a channel does at a time. `mirror` says the numbers are the right hand's and the left hand is their mirror image. */
export type FirstPersonSampleChannel = { p: Triple; r: Triple; grip: number | undefined; w: number; mirror: boolean }
export type FirstPersonSample = { R?: FirstPersonSampleChannel; L?: FirstPersonSampleChannel; F?: FirstPersonSampleChannel }

const ease = (k: number): number => k * k * (3 - 2 * k)
const mix = (a: number, b: number, k: number): number => a + (b - a) * k
const mixTriple = (a: Triple, b: Triple, k: number): Triple => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)]

type Track = { t: number; key: FirstPersonPoseKey; mirror: boolean }

const trackOf = (clip: Pick<FirstPersonClip, 'keys'>, side: 'R' | 'L' | 'F'): Track[] => {
  const out: Track[] = []
  for (const key of clip.keys) {
    if (side === 'L') {
      if (key.L === 'mirror') {
        if (key.R) out.push({ t: key.t, key: key.R, mirror: true })
      } else if (key.L) out.push({ t: key.t, key: key.L, mirror: false })
    } else {
      const entry = key[side]
      if (entry) out.push({ t: key.t, key: entry, mirror: false })
    }
  }
  return out.sort((a, b) => a.t - b.t)
}

const sampleTrack = (track: Track[], time: number): FirstPersonSampleChannel | undefined => {
  if (track.length === 0) return undefined
  const first = track[0]!
  const last = track[track.length - 1]!
  const of = (entry: Track): FirstPersonSampleChannel => ({ p: [...entry.key.p], r: [...entry.key.r], grip: entry.key.grip, w: entry.key.w ?? 1, mirror: entry.mirror })
  if (time <= first.t) return of(first)
  if (time >= last.t) return of(last)
  let index = 0
  while (index < track.length - 2 && time > track[index + 1]!.t) index++
  const a = track[index]!
  const b = track[index + 1]!
  const k = ease(Math.min(1, Math.max(0, (time - a.t) / (b.t - a.t))))
  const ga = a.key.grip
  const gb = b.key.grip
  return {
    p: mixTriple(a.key.p, b.key.p, k),
    r: mixTriple(a.key.r, b.key.r, k),
    grip: ga === undefined ? gb : gb === undefined ? ga : mix(ga, gb, k),
    w: mix(a.key.w ?? 1, b.key.w ?? 1, k),
    mirror: a.mirror,
  }
}

/** Where each driven channel is at `time`: between two keys of a channel the numbers are blended with the smoothstep of `samplePoseClip`; before its first key and after its last it holds them. */
export const sampleFirstPersonClip = (clip: Pick<FirstPersonClip, 'keys'>, time: number): FirstPersonSample => {
  const out: FirstPersonSample = {}
  for (const side of ['R', 'L', 'F'] as const) {
    const sample = sampleTrack(trackOf(clip, side), time)
    if (sample) out[side] = sample
  }
  return out
}
