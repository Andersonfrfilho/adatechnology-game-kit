import { createArsenal } from '../../src'
import type { Vec3 } from '../../src'

const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]
const FRAME = 1 / 60
const MAX_SECONDS = 36_000

export type HeatSessionOptions = {
  readonly weaponId: string
  /** Seconds between pulls of the trigger; absent: the weapon's own cyclic rate (a held trigger on an automatic one). */
  readonly pullEverySeconds?: number
  /** Stop after this many rounds even if the warning never came. */
  readonly maxRounds?: number
  /** Extra seconds spent on every reload on top of the weapon's own. */
  readonly extraReloadSeconds?: number
}

export type HeatSessionResult = {
  /** Rounds fired when the barrel first reached the warning; undefined when it never did. */
  readonly roundsAtWarning: number | undefined
  readonly roundsFired: number
  readonly peakHeat: number
  readonly seconds: number
}

/** Fires a cold weapon with the faults off, reloading when it runs dry, until the barrel reaches the warning or the rounds run out. */
export function fireUntilWarning(options: HeatSessionOptions): HeatSessionResult {
  const arsenal = createArsenal({ rules: { faults: false } })
  const weapon = arsenal.create(options.weaponId, { reserve: 100_000 })
  const warning = arsenal.rules.heat.faultFrom
  const maxRounds = options.maxRounds ?? 100_000
  const automatic = weapon.mode === 'auto'
  let rounds = 0
  let peakHeat = 0
  let seconds = 0
  let nextPull = 0
  while (seconds < MAX_SECONDS && rounds < maxRounds) {
    if (weapon.ammo === 0 && !weapon.reloading) {
      weapon.reload()
      nextPull = seconds + (options.extraReloadSeconds ?? 0)
    }
    if (seconds >= nextPull && !weapon.reloading) {
      const fired = weapon.trigger(ORIGIN, AIM, FRAME, options.pullEverySeconds === undefined ? automatic : false)
      rounds += fired.rounds
      if (options.pullEverySeconds !== undefined && fired.rounds > 0) nextPull = seconds + options.pullEverySeconds
    } else {
      weapon.update(FRAME)
    }
    seconds += FRAME
    peakHeat = Math.max(peakHeat, weapon.heat)
    if (weapon.heat >= warning) return { roundsAtWarning: rounds, roundsFired: rounds, peakHeat, seconds }
  }
  return { roundsAtWarning: undefined, roundsFired: rounds, peakHeat, seconds }
}
