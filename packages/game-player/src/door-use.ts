/**
 * Opening and closing a hinged or sliding leaf by hand (a house door, a wardrobe or fridge door, a drawer, a car door, a hood): the hand reaches the handle, the leaf
 * follows the hand at a speed set by its mass, stops where something is in its way, and a locked leaf only rattles.
 * Engine-agnostic: the host says how open the leaf is (0 closed, 1 open) and answers whether it can go to a new opening; this says how far it goes each step.
 */

export type DoorUsePhase = 'idle' | 'reach' | 'swing' | 'release' | 'rattle'
export type DoorUseBlock = 'locked' | 'obstacle' | null

/** Every number of the use; a game overrides what it wants (`createDoorUse(rules)`). */
export interface DoorUseRules {
  /** The hand going to the handle before the leaf moves, seconds. */
  readonly reachSeconds: number
  /** A full swing: `base + perKg * mass` of the leaf, between `min` and `max` seconds (a fridge door is quick, a car door slower, a steel door slower still). */
  readonly swingSeconds: { readonly base: number; readonly perKg: number; readonly min: number; readonly max: number }
  /** The hand letting go and coming back, seconds. */
  readonly releaseSeconds: number
  /** How long a locked leaf is shaken before the hand gives up, seconds. */
  readonly rattleSeconds: number
  /** The part of the swing tested at a time against what is around (smaller is finer and costs more). */
  readonly stepFraction: number
  /** Within this of closed or open a leaf counts as there: the last use's way no longer turns it round. */
  readonly endTolerance: number
}

export const DOOR_USE_DEFAULTS: DoorUseRules = {
  reachSeconds: 0.3,
  swingSeconds: { base: 0.45, perKg: 0.02, min: 0.45, max: 1.6 },
  releaseSeconds: 0.22,
  rattleSeconds: 0.6,
  stepFraction: 0.04,
  endTolerance: 0.02,
}

export type DoorUseTarget = {
  /** How open the leaf is now, 0 closed to 1 open. */
  readonly opening: number
  readonly massKg: number
  readonly locked?: boolean
  /** Where the last use sent this leaf: a leaf stopped between closed and open goes the other way (a door blocked half open closes). */
  readonly lastGoal?: 0 | 1
}

export type DoorUseStep = {
  readonly phase: DoorUsePhase
  /** How open the leaf is after the step. */
  readonly opening: number
  /** The phase's own progress, 0 to 1 (how far the hand is to the handle, how far the swing went, how much of the rattle is left). */
  readonly progress: number
  /** Set on the step the leaf stopped short or would not move. */
  readonly block: DoorUseBlock
  /** The leaf got where it was going on this step (fully open or fully closed). */
  readonly arrived: boolean
}

/** Seconds of a full swing for a leaf of this mass. */
export const swingSecondsFor = (massKg: number, rules: DoorUseRules = DOOR_USE_DEFAULTS): number =>
  Math.min(rules.swingSeconds.max, Math.max(rules.swingSeconds.min, rules.swingSeconds.base + rules.swingSeconds.perKg * Math.max(0, massKg)))

export interface DoorUse {
  readonly phase: DoorUsePhase
  /** Where the leaf is going: 1 opening, 0 closing. */
  readonly goal: 0 | 1
  readonly opening: number
  /**
   * Starts using a leaf: the other way from where the last use sent it (`lastGoal`), else a closed or half-open leaf opens and an open
   * one closes. A use in the middle of a swing turns it round.
   * Answers the goal (1 open, 0 closed), or null when the leaf is locked (it rattles instead).
   */
  begin(target: DoorUseTarget): 0 | 1 | null
  /** Advances the use; `isFree(from, to)` answers whether the leaf can go from one opening to the other (nothing in the way of its sweep). */
  step(dt: number, isFree: (from: number, to: number) => boolean): DoorUseStep
  /** Lets go at once. */
  cancel(): void
}

export function createDoorUse(rules: Partial<DoorUseRules> = {}): DoorUse {
  const r: DoorUseRules = { ...DOOR_USE_DEFAULTS, ...rules, swingSeconds: { ...DOOR_USE_DEFAULTS.swingSeconds, ...rules.swingSeconds } }
  let phase: DoorUsePhase = 'idle'
  let goal: 0 | 1 = 1
  let opening = 0
  let time = 0
  let swing = 1
  let start = 0

  const out = (progress: number, arrived = false, b: DoorUseBlock = null): DoorUseStep => ({ phase, opening, progress: Math.max(0, Math.min(1, progress)), block: b, arrived })

  return {
    get phase() {
      return phase
    },
    get goal() {
      return goal
    },
    get opening() {
      return opening
    },
    begin(target) {
      opening = Math.max(0, Math.min(1, target.opening))
      time = 0
      if (target.locked) {
        phase = 'rattle'
        return null
      }
      // in the middle of a swing the hand is already on the handle: the leaf turns round at once
      if (phase === 'swing' || phase === 'reach') goal = goal === 1 ? 0 : 1
      else if (target.lastGoal !== undefined && opening > r.endTolerance && opening < 1 - r.endTolerance) goal = target.lastGoal === 1 ? 0 : 1
      else goal = opening > 0.5 ? 0 : 1
      swing = swingSecondsFor(target.massKg, r)
      start = opening
      phase = phase === 'swing' ? 'swing' : 'reach'
      return goal
    },
    step(dt, isFree) {
      if (phase === 'idle') return out(0)
      time += dt
      if (phase === 'rattle') {
        const p = time / r.rattleSeconds
        if (p >= 1) {
          phase = 'idle'
          return out(1, false, 'locked')
        }
        return out(p, false, time === dt ? 'locked' : null)
      }
      if (phase === 'reach') {
        const p = time / r.reachSeconds
        if (p < 1) return out(p)
        phase = 'swing'
        time = 0
        start = opening
      }
      if (phase === 'swing') {
        const want = goal - opening
        const reach = Math.min(Math.abs(want), dt / swing)
        // the sweep is tested a little at a time, so a leaf stops at the first thing in its way and not past it
        let moved = 0
        let stopped = false
        while (moved < reach - 1e-9) {
          const inc = Math.min(r.stepFraction, reach - moved)
          const next = opening + Math.sign(want) * inc
          if (!isFree(opening, next)) {
            stopped = true
            break
          }
          opening = next
          moved += inc
        }
        const travel = Math.abs(goal - start) || 1
        if (stopped) {
          phase = 'release'
          time = 0
          return out(1 - Math.abs(goal - opening) / travel, false, 'obstacle')
        }
        if (Math.abs(goal - opening) < 1e-6) {
          opening = goal
          phase = 'release'
          time = 0
          return out(1, true)
        }
        return out(1 - Math.abs(goal - opening) / travel)
      }
      // release
      const p = time / r.releaseSeconds
      if (p >= 1) {
        phase = 'idle'
      }
      return out(p, false, null)
    },
    cancel() {
      phase = 'idle'
      time = 0
    },
  }
}
