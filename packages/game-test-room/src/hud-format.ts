/** How the room writes numbers and rounds on its HUD. */
import type { WeaponState } from '@adatechnology/game-weapons'

/** A number with `digits` decimals, with a comma in Portuguese. */
export const numberFormat =
  (locale: string) =>
  (n: number, digits = 1): string => {
    const s = (Math.round(n * 10 ** digits) / 10 ** digits).toFixed(digits)
    return locale.toLowerCase().startsWith('pt') ? s.replace('.', ',') : s
  }

/** The rounds of a weapon as the HUD shows them: `12/17 · 34` for a firearm, the count for a thrown one, nothing for a hand, a blade or a tool. */
export const ammoText = (state: WeaponState, num: (n: number, digits?: number) => string): string => {
  const kind = state.def.action.kind
  if (kind === 'firearm') return `${state.ammo}/${state.capacity}${state.reserve ? ` · ${state.reserve}` : ''}`
  return kind === 'hand' || kind === 'melee' || kind === 'tool' ? '' : `${num(state.ammo, 0)}`
}
