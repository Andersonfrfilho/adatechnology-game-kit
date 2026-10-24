/** A game day lasts 20 real minutes in the slice (jogo.js L69127: `dayT + dt / 1200`). */
export const DAY_REAL_SECONDS = 1200
export const GAME_DAY_SECONDS = 86400
/** Game seconds per real second of the 20-minute day. */
export const DEFAULT_TIME_SCALE = GAME_DAY_SECONDS / DAY_REAL_SECONDS

const NIGHT_SPAN = 2.2

const clamp = (value: number, low: number, high: number): number => (value < low ? low : value > high ? high : value)

export type Daylight = {
  /** Sun height 0..1 (`s` of the game). */
  readonly sun: number
  /** 0 in full daylight, 1 in the darkest night. */
  readonly nightFactor: number
}

/** jogo.js L69128-L69130: `s = clamp(sin(dayT·2π − π/2)·0.5 + 0.5, 0, 1)`, `nightF = 1 − clamp(s·2.2, 0, 1)`. `dayFraction` 0 is midnight. */
export function daylight(dayFraction: number): Daylight {
  const sun = clamp(Math.sin(dayFraction * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5, 0, 1)
  return { sun, nightFactor: 1 - clamp(sun * NIGHT_SPAN, 0, 1) }
}

/** The fraction of the day after `gameSeconds` from `startHour`. */
export function dayFractionAt(startHour: number, gameSeconds: number): number {
  const fraction = (startHour / 24 + gameSeconds / GAME_DAY_SECONDS) % 1
  return fraction < 0 ? fraction + 1 : fraction
}
