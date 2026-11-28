/**
 * Hunger and thirst of a body (the team game's `needs`, G 57255-57344): two levels from 0 (fed, quenched) to `max` (starving, parched) that rise with the game's
 * clock, faster when running and slower for a stronger body, and fall by what the body eats and drinks (`satiety` and `hydration` of an item, the thirst a litre
 * of a liquid quenches). Past `starvingAt` either one costs health every second. Pure and allocation-free: the host keeps one `NeedsState` and passes it in.
 */
import defaults from './data/defaults.json'

export type NeedsRules = typeof defaults.needs

/** The rules the team game shipped. */
export const NEEDS_DEFAULTS: NeedsRules = defaults.needs

/** Where a body stands: `hunger` and `thirst`, 0 fed and quenched, `NeedsRules.max` starving. */
export interface NeedsState {
  hunger: number
  thirst: number
}

/** What the body ate or drank: points of hunger (`satiety`) and of thirst (`hydration`) it takes off; a negative number adds (salted fish makes you thirsty). */
export interface Nourishment {
  readonly satiety?: number
  readonly hydration?: number
}

/** A fresh body's needs (`rules.start`). */
export const createNeedsState = (rules: NeedsRules = NEEDS_DEFAULTS): NeedsState => ({ hunger: rules.start.hunger, thirst: rules.start.thirst })

const clamp = (value: number, max: number): number => (value < 0 ? 0 : value > max ? max : value)

/** Game hours `dt` seconds are for a body of `vigor` (the vigor factor of the team game: 1.1 − 0.02 × vigor; never below zero). */
export const needsHoursOf = (dt: number, vigor: number, rules: NeedsRules = NEEDS_DEFAULTS): number =>
  (Math.max(0, dt) / rules.gameHourSeconds) * Math.max(0, rules.vigorBase + rules.vigorPerPoint * vigor)

/** Either need is past `starvingAt`. */
export const isStarving = (state: NeedsState, rules: NeedsRules = NEEDS_DEFAULTS): boolean => state.hunger > rules.starvingAt || state.thirst > rules.starvingAt

/** Moves `state` on by `dt` seconds and answers the health it costs in that time (0 unless the body is starving or parched). */
export function advanceNeeds(state: NeedsState, dt: number, body: { readonly running?: boolean; readonly vigor: number }, rules: NeedsRules = NEEDS_DEFAULTS): number {
  const hours = needsHoursOf(dt, body.vigor, rules)
  state.hunger = clamp(state.hunger + (body.running ? rules.hungerRunningPerHour : rules.hungerPerHour) * hours, rules.max)
  state.thirst = clamp(state.thirst + rules.thirstPerHour * hours, rules.max)
  return isStarving(state, rules) ? rules.starvingDamagePerSecond * Math.max(0, dt) : 0
}

/** Takes what was eaten or drunk off `state` (kept within 0 and `max`) and answers how much each level moved (negative: it went down). */
export function nourish(state: NeedsState, food: Nourishment, rules: NeedsRules = NEEDS_DEFAULTS): { hunger: number; thirst: number } {
  const hunger = state.hunger
  const thirst = state.thirst
  state.hunger = clamp(hunger - (food.satiety ?? 0), rules.max)
  state.thirst = clamp(thirst - (food.hydration ?? 0), rules.max)
  return { hunger: state.hunger - hunger, thirst: state.thirst - thirst }
}
