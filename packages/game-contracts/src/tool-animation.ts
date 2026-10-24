import type { AnimationClipSpec, AnimationEventSpec, AnimationPose } from './animation'
import { checkAnimation } from './animation'
import type { HostEvent } from './module'

/** Clips a tool can bring, one per move of its cycle. A tool brings the ones it has; a missing clip is simply not played. */
export const TOOL_CLIP = {
  DRAW: 'draw',
  SHOT: 'shot',
  MISFIRE: 'misfire',
  EMPTY: 'empty',
  CYCLE: 'cycle',
  RELOAD: 'reload',
  FEED: 'feed',
  FAULT: 'fault',
  CLEAR: 'clear',
  SAFETY_ON: 'safety_on',
  SAFETY_OFF: 'safety_off',
  MODE: 'mode',
  /** A throwable with the pin out, held until it is thrown. */
  COOK: 'cook',
} as const
export type ToolClipId = (typeof TOOL_CLIP)[keyof typeof TOOL_CLIP]

/** What a renderer does when a rule event arrives. `variant` picks `<clip>_<variant>` when the tool has it, else `<clip>`. */
export type ToolAnimationStep =
  | { readonly type: 'play'; readonly clip: ToolClipId; readonly variant?: string; readonly duration?: number; readonly repeat?: number }
  /** Move the clip that is playing to the marker (a clip event `stage` with `data.stage`) the rule just reached. */
  | { readonly type: 'sync'; readonly stage: string }
  /** The rule says the phase is over: the clip jumps to its end if it is still running. */
  | { readonly type: 'finish'; readonly clip: ToolClipId }

/** The move a host event asks of the tool in hand, or null when it has no motion. */
export const toolAnimationStep = (event: HostEvent): ToolAnimationStep | null => {
  switch (event.type) {
    case 'tool':
      return { type: 'play', clip: TOOL_CLIP.DRAW, ...(event.duration === undefined ? {} : { duration: event.duration }) }
    case 'shot':
      return { type: 'play', clip: TOOL_CLIP.SHOT, repeat: Math.max(1, event.rounds ?? 1) }
    case 'misfire':
      return { type: 'play', clip: TOOL_CLIP.MISFIRE }
    case 'empty':
      return { type: 'play', clip: TOOL_CLIP.EMPTY }
    case 'mode':
      return { type: 'play', clip: TOOL_CLIP.MODE, variant: event.mode }
    case 'fault':
      return { type: 'play', clip: TOOL_CLIP.FAULT, variant: event.fault }
    case 'clear':
      if (event.phase === 'end') return { type: 'finish', clip: TOOL_CLIP.CLEAR }
      return { type: 'play', clip: TOOL_CLIP.CLEAR, variant: event.fault, ...(event.duration === undefined ? {} : { duration: event.duration }) }
    case 'safety':
      return { type: 'play', clip: event.on ? TOOL_CLIP.SAFETY_ON : TOOL_CLIP.SAFETY_OFF }
    case 'cycle':
      if (event.phase === 'end') return { type: 'finish', clip: TOOL_CLIP.CYCLE }
      return { type: 'play', clip: TOOL_CLIP.CYCLE, ...(event.duration === undefined ? {} : { duration: event.duration }) }
    case 'reload':
      if (event.phase === 'end') return { type: 'finish', clip: TOOL_CLIP.RELOAD }
      return { type: 'play', clip: TOOL_CLIP.RELOAD, ...(event.kind === undefined ? {} : { variant: event.kind }), ...(event.duration === undefined ? {} : { duration: event.duration }) }
    case 'stage':
      return { type: 'sync', stage: event.stage }
    case 'feed':
      return { type: 'play', clip: TOOL_CLIP.FEED }
    case 'cook':
      if (event.phase === 'start') return { type: 'play', clip: TOOL_CLIP.COOK, duration: event.fuse }
      return { type: 'finish', clip: TOOL_CLIP.COOK }
    default:
      return null
  }
}

/** Where a renderer puts the poses: every part of the tool by id (the ids the clips move), and the whole tool. Poses are offsets from rest. */
export interface ToolRig {
  setPartPose(partId: string, pose: AnimationPose): void
  setRootPose?(pose: AnimationPose): void
}

/** Clips by id, with the variants as `<clip>_<variant>`. */
export type ToolClipSet = Readonly<Record<string, AnimationClipSpec>>

/** A renderer's tool animator: feed it the host events and the frame time. */
export interface ToolAnimator {
  handle(event: HostEvent): void
  update(dt: number): void
  /** Ids of the clips playing now. */
  readonly playing: readonly string[]
  dispose(): void
}

export const STAGE_EVENT = 'stage'

/** The clip with its times (keys and events) scaled so that it lasts `duration` seconds. */
export const scaleClip = (clip: AnimationClipSpec, duration: number): AnimationClipSpec => {
  const factor = clip.duration > 0 ? duration / clip.duration : 1
  return {
    ...clip,
    duration,
    keys: clip.keys.map((key) => ({ ...key, t: key.t * factor })),
    ...(clip.events ? { events: clip.events.map((event) => ({ ...event, t: event.t * factor })) } : {}),
  }
}

const ZERO: [number, number, number] = [0, 0, 0]
const mix = (from: readonly number[], to: readonly number[], fraction: number): [number, number, number] => [
  (from[0] ?? 0) + ((to[0] ?? 0) - (from[0] ?? 0)) * fraction,
  (from[1] ?? 0) + ((to[1] ?? 0) - (from[1] ?? 0)) * fraction,
  (from[2] ?? 0) + ((to[2] ?? 0) - (from[2] ?? 0)) * fraction,
]

/** Pose of the whole tool (`partId` undefined) or of one part at `time`, linear between keys; a key that does not name it means rest. */
export const sampleClip = (clip: AnimationClipSpec, partId: string | undefined, time: number): { position: [number, number, number]; rotation: [number, number, number] } => {
  const points = clip.keys.map((key) => {
    const pose = partId === undefined ? key : key.parts?.[partId]
    return { t: key.t, position: pose?.position ?? ZERO, rotation: pose?.rotation ?? ZERO }
  })
  const first = points[0]
  if (!first || first.t > 0) points.unshift({ t: 0, position: ZERO, rotation: ZERO })
  const last = points[points.length - 1]
  if (!last) return { position: ZERO, rotation: ZERO }
  if (time >= last.t) return { position: mix(last.position, last.position, 0), rotation: mix(last.rotation, last.rotation, 0) }
  const index = Math.max(0, points.findIndex((point, i) => time >= point.t && time < (points[i + 1]?.t ?? Infinity)))
  const from = points[index]
  const to = points[index + 1]
  if (!from || !to) return { position: ZERO, rotation: ZERO }
  const fraction = to.t > from.t ? (time - from.t) / (to.t - from.t) : 0
  return { position: mix(from.position, to.position, fraction), rotation: mix(from.rotation, to.rotation, fraction) }
}

/** Problems with a clip set (empty when valid): each key is the clip id (or `<clip>_<variant>`), every clip passes `checkAnimation`, and a `stage` event names its stage. */
export const checkToolClips = (clips: ToolClipSet, partIds: Iterable<string>): { ok: boolean; problems: string[] } => {
  const parts = [...partIds]
  const problems: string[] = []
  for (const [key, clip] of Object.entries(clips)) {
    if (clip.id !== key) problems.push(`clip "${key}" has the id "${clip.id}"`)
    if (!(clip.duration > 0)) problems.push(`clip "${key}" has no duration`)
    problems.push(...checkAnimation(clip, parts).problems)
    for (const event of clip.events ?? []) if (event.type === STAGE_EVENT && typeof event.data?.stage !== 'string') problems.push(`clip "${key}" has a stage event without data.stage`)
  }
  return { ok: problems.length === 0, problems }
}

interface Instance {
  readonly name: string
  readonly clip: AnimationClipSpec
  time: number
  delay: number
  fired: number
}

export interface ToolClipPlayerOptions {
  clips: ToolClipSet
  rig: ToolRig
  /** Called for each clip event as its time passes (`eject_casing`, `drop_magazine`, `stage`...). */
  onEvent?(event: AnimationEventSpec, clip: string): void
  /** Seconds between the rounds of a `repeat` (a burst): default 0.1. */
  repeatInterval?(): number
}

/** The default player of a tool's clips: runs the steps of `toolAnimationStep` against a rig, scaled to the duration the rule gives. */
export interface ToolClipPlayer {
  apply(step: ToolAnimationStep): void
  update(dt: number): void
  readonly playing: readonly string[]
}

export const createToolClipPlayer = (options: ToolClipPlayerOptions): ToolClipPlayer => {
  const { clips, rig, onEvent } = options
  let instances: Instance[] = []

  const find = (clip: string, variant?: string): { name: string; clip: AnimationClipSpec } | undefined => {
    const name = variant !== undefined && clips[`${clip}_${variant}`] ? `${clip}_${variant}` : clip
    const found = clips[name]
    return found ? { name, clip: found } : undefined
  }

  const render = (instance: Instance): void => {
    const time = Math.min(instance.time, instance.clip.duration)
    const root = sampleClip(instance.clip, undefined, time)
    if (instance.clip.keys.some((key) => key.position || key.rotation)) rig.setRootPose?.(root)
    const touched = new Set(instance.clip.keys.flatMap((key) => Object.keys(key.parts ?? {})))
    for (const id of touched) rig.setPartPose(id, sampleClip(instance.clip, id, time))
  }

  const fireEvents = (instance: Instance, upTo: number): void => {
    const events = instance.clip.events ?? []
    while (instance.fired < events.length && (events[instance.fired]?.t ?? Infinity) <= upTo + 1e-9) {
      const event = events[instance.fired]
      instance.fired += 1
      if (event) onEvent?.(event, instance.name)
    }
  }

  return {
    apply(step) {
      if (step.type === 'sync') {
        for (const instance of instances) {
          const marker = (instance.clip.events ?? []).find((event) => event.type === STAGE_EVENT && event.data?.stage === step.stage)
          if (marker && instance.time < marker.t) instance.time = marker.t
        }
        return
      }
      if (step.type === 'finish') {
        for (const instance of instances) {
          if (instance.name !== step.clip && !instance.name.startsWith(`${step.clip}_`)) continue
          fireEvents(instance, instance.clip.duration)
          instance.time = instance.clip.duration
        }
        return
      }
      const found = find(step.clip, step.variant)
      if (!found) return
      const clip = step.duration && step.duration > 0 ? scaleClip(found.clip, step.duration) : found.clip
      const interval = options.repeatInterval?.() ?? 0.1
      instances = instances.filter((existing) => existing.name !== found.name || existing.delay > 0)
      for (let round = 0; round < (step.repeat ?? 1); round++) {
        instances.push({ name: found.name, clip, time: 0, delay: round * interval, fired: 0 })
      }
    },
    update(dt) {
      for (const instance of instances) {
        const carried = instance.delay > 0 ? dt - instance.delay : dt
        if (instance.delay > 0) {
          instance.delay = Math.max(0, instance.delay - dt)
          if (instance.delay > 0) continue
        }
        instance.time += carried
        fireEvents(instance, instance.time)
        render(instance)
      }
      instances = instances.filter((instance) => instance.delay > 0 || instance.time < instance.clip.duration)
    },
    get playing() {
      return instances.map((instance) => instance.name)
    },
  }
}
