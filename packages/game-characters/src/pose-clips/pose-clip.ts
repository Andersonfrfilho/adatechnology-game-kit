import { lerpPose } from '../gait/cascade'

/** One key of a clip: the time in seconds and the joint targets by name (the names of the rich body's `setPose`; a clip may add channels of its own, such as `x` or `run`). */
export type PoseKey = { t: number; pose: Record<string, number> }

/** What a clip says happens at a time: `impact` ("the blow lands now"), `phase` (a label for the screen), or any type a game defines. */
export type PoseClipEvent = { t: number; type: string; data?: Record<string, unknown> }

/** Which joints a clip drives: `upper` leaves the legs to the gait, `lower` leaves the trunk, head and arms, `full` sets everything. */
export type PoseClipChannels = 'full' | 'upper' | 'lower'

export type PoseClip = {
  id: string
  duration: number
  loop?: boolean
  keys: PoseKey[]
  events?: PoseClipEvent[]
  channels?: PoseClipChannels
  /** Where the clip was ported from (file and variable), for the diff against the team page. */
  source?: Record<string, unknown>
}

/**
 * The Bestiário's `sample(K, t)`: finds the segment of two keys, clamps the fraction to [0, 1], eases it with smoothstep `k·k·(3 − 2k)` and
 * blends the two poses by joint name (`lerpPose`). Before the first key it holds the first segment's start, after the last it holds the end.
 */
export const samplePoseClip = (clip: Pick<PoseClip, 'keys'>, time: number): Record<string, number> => {
  const keys = clip.keys
  if (keys.length === 0) return {}
  if (keys.length === 1) return { ...keys[0]!.pose }
  let index = 0
  while (index < keys.length - 2 && time > keys[index + 1]!.t) index++
  const a = keys[index]!
  const b = keys[index + 1]!
  const k = Math.min(1, Math.max(0, (time - a.t) / (b.t - a.t)))
  const eased = k * k * (3 - 2 * k)
  return lerpPose(a.pose, b.pose, eased)
}

/** The events a clip fires while the clock goes from `from` (excluded) to `to` (included), in time order. */
export const clipEventsBetween = (clip: Pick<PoseClip, 'events'>, from: number, to: number): PoseClipEvent[] =>
  (clip.events ?? []).filter((event) => event.t > from && event.t <= to).sort((x, y) => x.t - y.t)

/** The names of the joints a channel set drives, from the names `PoseTargets` of the rich animator knows. */
export const POSE_CHANNEL_JOINTS: Readonly<Record<PoseClipChannels, readonly string[] | undefined>> = {
  full: undefined,
  upper: ['lean', 'twist', 'side', 'headX', 'headY', 'headZ', 'armR', 'armL', 'elbR', 'elbL', 'armRz', 'armLz'],
  lower: ['drop', 'legL', 'legR', 'kneeL', 'kneeR'],
}

/** Keeps from a sampled pose only the joints of the channel set (`full` keeps everything, including extra channels such as `x`). */
export const filterPoseChannels = (pose: Record<string, number>, channels: PoseClipChannels = 'full'): Record<string, number> => {
  const allowed = POSE_CHANNEL_JOINTS[channels]
  if (!allowed) return pose
  const out: Record<string, number> = {}
  for (const name of allowed) if (pose[name] !== undefined) out[name] = pose[name] as number
  return out
}

/** Joints that swap with their opposite when a clip is mirrored, and the channels that change sign (side, twist and the sideways turns). */
const MIRROR_PAIRS: ReadonlyArray<readonly [string, string]> = [['armR', 'armL'], ['elbR', 'elbL'], ['armRz', 'armLz'], ['legR', 'legL'], ['kneeR', 'kneeL']]
const MIRROR_NEGATED: ReadonlySet<string> = new Set(['side', 'twist', 'headY', 'headZ'])

/** The clip as seen in a mirror: left and right swap and the sideways channels change sign; the times, the events and the duration stay, so the impact falls at the same second. */
export const mirrorPoseClip = (clip: PoseClip, id: string): PoseClip => ({
  ...clip,
  id,
  keys: clip.keys.map((key) => {
    const pose: Record<string, number> = {}
    for (const [name, value] of Object.entries(key.pose)) pose[name] = MIRROR_NEGATED.has(name) ? -value : value
    for (const [a, b] of MIRROR_PAIRS) {
      const va = key.pose[a]
      const vb = key.pose[b]
      const sign = a === 'armRz' ? -1 : 1 // the sideways swing of an arm opens to the other side
      if (vb !== undefined) pose[a] = sign * vb
      else delete pose[a]
      if (va !== undefined) pose[b] = sign * va
      else delete pose[b]
    }
    return { t: key.t, pose }
  }),
  ...(clip.events ? { events: clip.events.map((event) => ({ ...event })) } : {}),
})
