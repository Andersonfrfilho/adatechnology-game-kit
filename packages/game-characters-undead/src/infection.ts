import { createConditionTimeline } from '@adatechnology/game-characters'
import type { ConditionPhase, ConditionSample, ConditionTimeline } from '@adatechnology/game-characters'

import type { UndeadInfection, WoundKind } from './types'

export type InfectionClock = 'hours' | 'accelerated'

const SECONDS_PER_HOUR = 3600

/** The phases of the infection from the catalog: the Elenco's hours (2, 12, 30, 48) or the game's accelerated seconds (fever 30, delirium 70, death 120, reanimation 8 s later). */
export const infectionPhases = (infection: UndeadInfection, clock: InfectionClock): ConditionPhase[] => {
  const [healthy, malaise, fever, delirium, reanimated] = infection.stages
  const effects = (stage: typeof healthy): Record<string, number> => ({ skin: stage!.skin, hunch: stage!.hunch, arms: stage!.arms })
  if (clock === 'hours') {
    return [
      { id: 'well', startsAt: 0, effects: effects(healthy) },
      { id: 'malaise', startsAt: malaise!.fromHours ?? 2, effects: effects(malaise) },
      { id: 'fever', startsAt: fever!.fromHours ?? 12, effects: effects(fever) },
      { id: 'delirium', startsAt: delirium!.fromHours ?? 30, effects: effects(delirium) },
      { id: 'reanimated', startsAt: delirium!.toHours ?? 48, effects: effects(reanimated) },
    ]
  }
  const { feverSeconds, deliriumSeconds, deathSeconds, reanimateSeconds } = infection.accelerated
  return [
    { id: 'malaise', startsAt: 0, effects: effects(malaise) },
    { id: 'fever', startsAt: feverSeconds, effects: effects(fever) },
    { id: 'delirium', startsAt: deliriumSeconds, effects: effects(delirium) },
    { id: 'dead', startsAt: deathSeconds, effects: effects(delirium) },
    { id: 'reanimated', startsAt: deathSeconds + reanimateSeconds, effects: effects(reanimated) },
  ]
}

/** Builds the timeline: real seconds in, phases out. In hours the clock runs `1 / 3600` units per second unless the game scales it. */
export const createInfectionTimeline = (infection: UndeadInfection, clock: InfectionClock, hoursPerSecond?: number): ConditionTimeline =>
  createConditionTimeline({ phases: infectionPhases(infection, clock), unitsPerSecond: clock === 'hours' ? (hoursPerSecond ?? 1 / SECONDS_PER_HOUR) : 1 })

export type InfectionCase = {
  readonly wound: WoundKind
  /** Seconds since the wound, on the case's own clock. */
  readonly elapsedSeconds: number
  advance(seconds: number): ConditionSample
  sample(): ConditionSample
  /** The body has died of it (the accelerated `dead` phase, or the reanimation). */
  readonly dead: boolean
  /** The body is ready to turn: call `undead.turn`. */
  readonly reanimated: boolean
}

/** Which wound a hit opens, from one draw (G 62016 `FERIDA`: scratch 60%, laceration 30%, bite 10%). */
export const pickWound = (infection: UndeadInfection, random: () => number): WoundKind => {
  const draw = random()
  let acc = 0
  for (const kind of Object.keys(infection.wounds) as WoundKind[]) {
    acc += infection.wounds[kind].share
    if (draw < acc) return kind
  }
  return 'scratch'
}

/** Whether a wound of this kind infects: one draw against the kind's chance (scratch 6%, laceration 22%, bite 100%). */
export const woundInfects = (infection: UndeadInfection, kind: WoundKind, random: () => number): boolean => {
  const chance = infection.wounds[kind].infectionChance
  return chance >= 1 || random() < chance
}

export const createInfectionCase = (infection: UndeadInfection, wound: WoundKind, clock: InfectionClock, hoursPerSecond?: number): InfectionCase => {
  const timeline = createInfectionTimeline(infection, clock, hoursPerSecond)
  const secondsPerUnit = clock === 'hours' ? 1 / (hoursPerSecond ?? 1 / SECONDS_PER_HOUR) : 1
  return {
    wound,
    get elapsedSeconds() {
      return timeline.elapsed * secondsPerUnit
    },
    advance: (seconds) => timeline.advance(seconds),
    sample: () => timeline.sample(),
    get dead() {
      const id = timeline.sample().phase.id
      return id === 'dead' || id === 'reanimated'
    },
    get reanimated() {
      return timeline.sample().phase.id === 'reanimated'
    },
  }
}
