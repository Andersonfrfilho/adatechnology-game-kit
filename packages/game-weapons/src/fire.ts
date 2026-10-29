import type { CaliberDef, FireMode, FirearmAction, WeaponAction, WeaponRules, WeaponTimings } from './types'

const EPS = 1e-9
const MANUAL_MODES: ReadonlySet<FireMode> = new Set(['pump', 'bolt', 'lever'])

export const weaponSpeed = (action: FirearmAction, caliber: CaliberDef): number => action.muzzleSpeed ?? caliber.muzzleSpeed * (action.barrel ?? 1)

export const weaponNoise = (action: FirearmAction, caliber: CaliberDef): number => action.noise ?? caliber.noise ?? 0

export const timingsOf = (action: WeaponAction): WeaponTimings | undefined => ('timings' in action ? action.timings : undefined)

export const drawSeconds = (action: WeaponAction, rules: WeaponRules): number => timingsOf(action)?.draw ?? rules.draw

export const clearSeconds = (action: WeaponAction, rules: WeaponRules): number => timingsOf(action)?.clear ?? rules.clear

/** Seconds a manual action (pump, bolt, lever) needs to cycle after a shot; 0 for every other mode. */
export const manualCycleSeconds = (action: FirearmAction, mode: FireMode): number => (MANUAL_MODES.has(mode) ? action.timings?.cycle ?? 0 : 0)

/** When each round of one pull leaves the barrel: a held auto trigger fires through the frame, a burst at the cyclic rate, a volley all at once. */
export const planRounds = (action: FirearmAction, mode: FireMode, ammo: number, firstAt: number, frameEnd: number): number[] => {
  const interval = 60 / action.rpm
  const times: number[] = []
  if (mode === 'auto') {
    for (let t = firstAt; times.length < ammo && (times.length === 0 ? t <= frameEnd + EPS : t < frameEnd - EPS); t += interval) times.push(t)
    return times
  }
  if (mode === 'burst') {
    const count = Math.min(action.burst ?? 3, ammo)
    for (let k = 0; k < count; k++) times.push(firstAt + k * interval)
    return times
  }
  if (mode === 'volley') return Array.from({ length: Math.min(action.magazine, ammo) }, () => firstAt)
  return [firstAt]
}
