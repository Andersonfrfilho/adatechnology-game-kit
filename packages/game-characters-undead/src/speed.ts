import type { UndeadMoments, UndeadType } from './types'

/** The moments a body can be in when its speed is asked for. */
export type SpeedMoment = 'wander' | 'alert' | 'chase' | 'sprint' | 'frenzy' | 'stalk' | 'water'

export type SpeedContext = {
  readonly moment: SpeedMoment
  /** A screamer's call is active (the chase is faster: `moments.scream`). */
  readonly screamBoost?: boolean
  /** A leg is hurt (`moments.injured`). */
  readonly limp?: boolean
  /** Crawling (capped at `moments.crawlCap`). */
  readonly crawling?: boolean
  /** In water: the drowned swim at `speed.water`, everybody else is slowed (`moments.water.others`). */
  readonly inWater?: boolean
  readonly night?: boolean
}

/** The speeds of one body: the type's absolute m/s already scaled by its age and build. */
export type SpeedSet = Readonly<Record<string, number>>

/**
 * Metres per second of a body at a moment (P3). The set holds the absolute speeds of the type (`wander`, `chase`, and `sprint`, `frenzy`, `water`, `stalk`
 * when it has them); the moment picks one, then the modifiers of the game apply in its order: scream boost, water, crawl cap, limp, night.
 * A moment the body has no speed for falls back to `chase` (a `frenzy` of a type without one is its chase).
 */
export const speedFor = (speeds: SpeedSet, context: SpeedContext, moments: UndeadMoments, typeId?: string, drownedId = 'drowned'): number => {
  const wander = speeds.wander ?? 0
  const chase = speeds.chase ?? wander
  let speed: number
  switch (context.moment) {
    case 'wander':
      speed = wander
      break
    case 'alert':
      speed = wander * moments.alert
      break
    case 'chase':
      speed = chase
      break
    default:
      speed = speeds[context.moment] ?? chase
  }
  if (context.screamBoost && (context.moment === 'chase' || context.moment === 'sprint' || context.moment === 'frenzy')) speed *= moments.scream
  if (context.inWater) speed = typeId === drownedId && speeds.water !== undefined ? speeds.water : speed * moments.water.others
  if (context.night) speed *= moments.night
  if (context.crawling) speed = Math.min(speed, moments.crawlCap)
  else if (context.limp) speed *= moments.injured
  return speed
}

/** The absolute speeds of a type's data (`speed`) and, for the `team-game` preset, the game's single chase speed. */
export const baseSpeedsOf = (type: UndeadType, preset: 'default' | 'team-game'): Record<string, number> => {
  const speeds: Record<string, number> = { ...type.speed }
  // the game has one chase speed per type: for blind, charred, drowned and devourer that is what the catalog calls `frenzy`
  if (preset === 'team-game' && speeds.frenzy !== undefined) speeds.chase = speeds.frenzy
  return speeds
}
