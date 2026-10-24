import { createStream, drawBetween } from './rng'
import type { Climate } from './types'

const SECONDS_PER_HOUR = 3600
/** A state lasts at least this long, so a climate patched to a zero dwell cannot stall the clock. */
const MIN_DWELL_SECONDS = 1

export type Scheduler = {
  /** Game seconds at which the current state ends. */
  nextChangeAt(): number
  /** Picks the state after `current`, then draws how long it lasts from `at`. Returns the new state's id. */
  next(current: string, at: number): string
  /** Draws a new duration from `at` (after a forced change). */
  restart(at: number): void
}

/**
 * A seeded Markov chain in game time. Draw order, fixed so the timeline repeats: at start one dwell; at each change the next state first
 * (one draw, over the weights in the climate's order), then its dwell. States `isKnown` rejects are left out of the weights.
 */
export function createScheduler(climate: Climate, seed: number, isKnown: (id: string) => boolean): Scheduler {
  const rng = createStream(seed, 'schedule')
  let changeAt = 0
  const drawDwell = (from: number): number => from + Math.max(MIN_DWELL_SECONDS, drawBetween(rng, climate.dwellHours) * SECONDS_PER_HOUR)
  changeAt = drawDwell(0)
  return {
    nextChangeAt: () => changeAt,
    next(current, at) {
      const options = Object.entries(climate.transitions[current] ?? {}).filter(([id, weight]) => weight > 0 && isKnown(id))
      const total = options.reduce((sum, [, weight]) => sum + weight, 0)
      let chosen = current
      if (total > 0) {
        let pick = rng() * total
        chosen = options[options.length - 1]![0]
        for (const [id, weight] of options) {
          if (pick < weight) {
            chosen = id
            break
          }
          pick -= weight
        }
      }
      changeAt = drawDwell(at)
      return chosen
    },
    restart(at) {
      changeAt = drawDwell(at)
    },
  }
}
