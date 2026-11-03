/**
 * Opening and closing a hinged or sliding leaf by hand (a house door, a wardrobe or fridge door, a drawer, a car door, a hood): the hand reaches the handle, the leaf
 * follows the hand at a speed set by its mass, stops where something is in its way, and a locked leaf only rattles.
 * The player does not follow the leaf: when the handle leaves arm reach a leaf that goes away is shoved on (`push`) and one that comes toward the body is let go (`release`),
 * and either one finishes its swing on its own.
 * Engine-agnostic: the host says how open the leaf is (0 closed, 1 open) and answers whether it can go to a new opening; this says how far it goes each step.
 */

export type DoorUsePhase = 'idle' | 'reach' | 'swing' | 'push' | 'release' | 'rattle'
export type DoorUseBlock = 'locked' | 'obstacle' | null

/** Every number of the use; a game overrides what it wants (`createDoorUse(rules)`). */
export interface DoorUseRules {
  /** The hand going to the handle before the leaf moves, seconds. */
  readonly reachSeconds: number
  /** A full swing: `base + perKg * mass` of the leaf, between `min` and `max` seconds (a fridge door is quick, a car door slower, a steel door slower still). */
  readonly swingSeconds: { readonly base: number; readonly perKg: number; readonly min: number; readonly max: number }
  /** The shove of a leaf that goes away once the handle is out of reach, seconds. */
  readonly pushSeconds: number
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
  pushSeconds: 0.18,
  releaseSeconds: 0.22,
  rattleSeconds: 0.6,
  stepFraction: 0.04,
  endTolerance: 0.02,
}

/**
 * Fallbacks for a host whose body does not say its own (the room asks the avatar: its shoulder joint and `armLength`): the shoulder height over the feet and the reach of the arm, metres,
 * as the rich body of game-characters-three draws its door pose (`DOOR_SHOULDER` and `DOOR_ARM` of its avatar).
 */
export const DEFAULT_SHOULDER_HEIGHT = 1.42
export const DEFAULT_ARM_REACH = 0.62

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

export type DoorUseHand = { readonly reaches: () => boolean; readonly pull: boolean }

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
  /**
   * Advances the use; `isFree(from, to)` answers whether the leaf can go from one opening to the other (nothing in the way of its sweep). `hand` says whether the handle is still
   * within arm reach after the step and whether the leaf comes toward the body (`pull`): once the handle is out of reach the swing hands over to `push` (a leaf going away is shoved
   * on) or `release` (a leaf coming toward the body is let go) and the leaf finishes on its own. Without `hand` the hand never lets go.
   */
  step(dt: number, isFree: (from: number, to: number) => boolean, hand?: DoorUseHand): DoorUseStep
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
  /** The hand let go and the leaf is still going to its goal on its own. */
  let coasting = false

  const out = (progress: number, arrived = false, b: DoorUseBlock = null): DoorUseStep => ({ phase, opening, progress: Math.max(0, Math.min(1, progress)), block: b, arrived })

  /** Moves the leaf toward its goal for `dt` seconds, a little at a time so it stops at the first thing in its way and not past it. */
  const advance = (dt: number, isFree: (from: number, to: number) => boolean): 'moving' | 'stopped' | 'arrived' => {
    const want = goal - opening
    const reach = Math.min(Math.abs(want), dt / swing)
    let moved = 0
    while (moved < reach - 1e-9) {
      const inc = Math.min(r.stepFraction, reach - moved)
      const next = opening + Math.sign(want) * inc
      if (!isFree(opening, next)) return 'stopped'
      opening = next
      moved += inc
    }
    return Math.abs(goal - opening) < 1e-6 ? 'arrived' : 'moving'
  }

  /** The hand coming back to rest; it waits there (progress 1) while the leaf still goes on its own. */
  const releaseOut = (arrived: boolean, b: DoorUseBlock = null): DoorUseStep => {
    const p = time / r.releaseSeconds
    if (p >= 1 && !coasting) phase = 'idle'
    return out(p, arrived, b)
  }

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
      coasting = false
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
    step(dt, isFree, hand) {
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
        // the hand is on the handle: the leaf starts to move with the next step, so a host that paces the swing sees the hand holding before the leaf goes
        phase = 'swing'
        time = 0
        start = opening
        return out(0)
      }
      if (phase === 'swing' || phase === 'push' || coasting) {
        const result = advance(dt, isFree)
        const travel = Math.abs(goal - start) || 1
        const progress = 1 - Math.abs(goal - opening) / travel
        const inHand = phase !== 'release'
        if (result === 'stopped' || result === 'arrived') {
          if (result === 'arrived') opening = goal
          coasting = false
          if (inHand) {
            phase = 'release'
            time = 0
          }
          if (result === 'arrived') return inHand ? out(1, true) : releaseOut(true)
          return inHand ? out(progress, false, 'obstacle') : releaseOut(false, 'obstacle')
        }
        if (phase === 'swing' && hand && !hand.reaches()) {
          time = 0
          if (hand.pull) {
            phase = 'release'
            coasting = true
          } else phase = 'push'
          return out(0)
        }
        if (phase === 'push') {
          if (time >= r.pushSeconds) {
            phase = 'release'
            time = 0
            coasting = true
            return out(0)
          }
          return out(time / r.pushSeconds)
        }
        if (phase === 'swing') return out(progress)
      }
      return releaseOut(false)
    },
    cancel() {
      phase = 'idle'
      time = 0
    },
  }
}
