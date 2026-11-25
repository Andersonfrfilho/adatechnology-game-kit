/**
 * The hands take a thing in steps one can see (decision of the owner, 2026-11-25): first each weapon in the way goes off the hands (`stow` to its holster, `sling` onto its sling, or
 * `drop`: tossed to the ground), then the hand `reach`es the thing's grip, the fingers `close` on it, and it is `lift`ed to where it is carried. A weapon comes back to the hands the
 * same way round (`draw`). Engine-agnostic and clock-free: the host advances it by its own frame's `dt` and does what each step says.
 */
import type { HandsMove, HandsPlan } from './hands'
import { easeInOut } from './hand-math'

/** Seconds each step takes. */
export interface HandsTiming {
  readonly stow: number
  readonly sling: number
  readonly drop: number
  readonly reach: number
  readonly close: number
  readonly lift: number
  readonly draw: number
}

export const HANDS_TIMING: HandsTiming = { stow: 0.5, sling: 0.45, drop: 0.4, reach: 0.38, close: 0.16, lift: 0.3, draw: 0.5 }

export type TakeStepKind = 'stow' | 'sling' | 'drop' | 'reach' | 'close' | 'lift' | 'draw'

export interface TakeStep {
  readonly kind: TakeStepKind
  /** The weapon the step moves (`stow`, `sling`, `drop`, `draw`). */
  readonly move?: HandsMove
  readonly start: number
  readonly end: number
}

export interface TakeSequence {
  readonly steps: readonly TakeStep[]
  readonly duration: number
}

const KIND_OF_MOVE: Readonly<Record<HandsMove['move'], 'stow' | 'sling' | 'drop'>> = { holster: 'stow', sling: 'sling', drop: 'drop' }

const lay = (parts: readonly { readonly kind: TakeStepKind; readonly seconds: number; readonly move?: HandsMove }[]): TakeSequence => {
  let at = 0
  const steps = parts.map((part) => {
    const step: TakeStep = { kind: part.kind, start: at, end: at + part.seconds, ...(part.move ? { move: part.move } : {}) }
    at = step.end
    return step
  })
  return { steps, duration: at }
}

/** The steps of taking a thing with `plan`: the weapons off the hands (the off hand first), then reach, close and lift. `take` false leaves the thing out (a push). */
export function planTakeSequence(plan: HandsPlan, options: { readonly timing?: HandsTiming; readonly take?: boolean } = {}): TakeSequence {
  const timing = options.timing ?? HANDS_TIMING
  const moves = [...plan.moves].reverse().map((move) => ({ kind: KIND_OF_MOVE[move.move], seconds: timing[KIND_OF_MOVE[move.move]], move }))
  const take = options.take === false ? [] : [
    { kind: 'reach' as const, seconds: timing.reach },
    { kind: 'close' as const, seconds: timing.close },
    { kind: 'lift' as const, seconds: timing.lift },
  ]
  return lay([...moves, ...take])
}

/** The steps of bringing weapons back to the hands, one after the other. */
export function planDrawSequence(moves: readonly HandsMove[], timing: HandsTiming = HANDS_TIMING): TakeSequence {
  return lay(moves.map((move) => ({ kind: 'draw' as const, seconds: timing.draw, move })))
}

export interface TakeProgress {
  /** The step going on now, null once the sequence is over. */
  readonly step: TakeStep | null
  /** How far into it, 0..1, eased (slow in, slow out). */
  readonly progress: number
  /** The steps that began during this advance, in order. */
  readonly started: readonly TakeStep[]
  /** The steps that ended during this advance, in order. */
  readonly ended: readonly TakeStep[]
  readonly done: boolean
}

export interface TakeTimeline {
  readonly sequence: TakeSequence
  /** Seconds since it began. */
  readonly time: number
  /** Moves the timeline on by `dt` seconds (the host's frame). The first call with 0 starts the first step. */
  advance(dt: number): TakeProgress
}

export function createTakeTimeline(sequence: TakeSequence): TakeTimeline {
  let time = 0
  // the steps already begun and already over: each is reported once
  let begun = 0
  let over = 0
  const steps = sequence.steps
  return {
    sequence,
    get time() {
      return time
    },
    advance(dt) {
      time = Math.min(sequence.duration, time + Math.max(0, dt))
      const startedFrom = begun
      while (begun < steps.length && (steps[begun] as TakeStep).start <= time) begun++
      const endedFrom = over
      while (over < begun && (steps[over] as TakeStep).end <= time) over++
      const started = steps.slice(startedFrom, begun)
      const ended = steps.slice(endedFrom, over)
      const step = steps.find((entry) => time < entry.end) ?? null
      const progress = step ? easeInOut((time - step.start) / Math.max(1e-6, step.end - step.start)) : 1
      return { step, progress, started, ended, done: time >= sequence.duration }
    },
  }
}
