export type ConditionPhase = {
  readonly id: string
  /** When the phase starts, in the timeline's units (hours, or seconds on an accelerated clock). The first phase starts at 0. */
  readonly startsAt: number
  /** Numbers the phase drives (skin tint, hunch, arm raise, ...), by name. */
  readonly effects?: Readonly<Record<string, number>>
}

export type ConditionOptions = {
  readonly phases: readonly ConditionPhase[]
  /** Timeline units per real second: 1 on a clock already in seconds (the accelerated preset), 1/3600 for hours. Default 1. */
  readonly unitsPerSecond?: number
  /** Interpolate effects toward the next phase instead of stepping. Default false. */
  readonly blend?: boolean
}

export type ConditionSample = {
  readonly index: number
  readonly phase: ConditionPhase
  /** 0..1 inside the current phase (1 on the last one). */
  readonly progress: number
  readonly effects: Readonly<Record<string, number>>
  readonly isFinal: boolean
}

export type ConditionTimeline = {
  readonly elapsed: number
  /** Advances the clock by `seconds` of real time. */
  advance(seconds: number): ConditionSample
  /** Jumps the clock to `units` of the timeline. */
  seek(units: number): ConditionSample
  sample(): ConditionSample
  reset(): void
}

const phaseIndexAt = (phases: readonly ConditionPhase[], units: number): number => {
  let found = 0
  phases.forEach((phase, index) => {
    if (units >= phase.startsAt) found = index
  })
  return found
}

const mixEffects = (from: ConditionPhase['effects'], to: ConditionPhase['effects'], amount: number): Record<string, number> => {
  const result: Record<string, number> = {}
  for (const name of new Set([...Object.keys(from ?? {}), ...Object.keys(to ?? {})])) {
    const start = from?.[name] ?? 0
    result[name] = start + ((to?.[name] ?? 0) - start) * amount
  }
  return result
}

/** A condition that moves through ordered phases over time (an infection: well, fever, delirium, reanimated). Generic: phases and effects are data. */
export const createConditionTimeline = (options: ConditionOptions): ConditionTimeline => {
  const { phases, unitsPerSecond = 1, blend = false } = options
  if (phases.length === 0) throw new Error('createConditionTimeline: at least one phase is required')
  let units = 0
  const sample = (): ConditionSample => {
    const index = phaseIndexAt(phases, units)
    const phase = phases[index] as ConditionPhase
    const next = phases[index + 1]
    const progress = next ? Math.min(1, (units - phase.startsAt) / (next.startsAt - phase.startsAt)) : 1
    const effects = blend && next ? mixEffects(phase.effects, next.effects, progress) : { ...phase.effects }
    return { index, phase, progress, effects, isFinal: !next }
  }
  return {
    get elapsed() {
      return units
    },
    advance(seconds) {
      units += seconds * unitsPerSecond
      return sample()
    },
    seek(target) {
      units = Math.max(0, target)
      return sample()
    },
    sample,
    reset() {
      units = 0
    },
  }
}
