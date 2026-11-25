import { canDualWield } from './dual-wield'
import type { Arsenal, WeaponId } from './types'

/**
 * The hands a weapon takes (`0` the bare hand, nothing to put away; `1` one hand, the other is free; `2` both) and the place on the body that takes it when the hands are wanted
 * for something else (`rules.hands.slots`: `hip`, `back`...), or null when it has none and has to go to the ground.
 */
export interface WeaponHands {
  readonly hands: 0 | 1 | 2
  readonly slot: string | null
}

const BARE: WeaponHands = { hands: 0, slot: null }

/** What `rules.hands` of the arsenal says of a weapon; an unknown id is the bare hand. */
export function weaponHandsOf(arsenal: Pick<Arsenal, 'weapons' | 'rules'>, weaponId: WeaponId): WeaponHands {
  const def = arsenal.weapons.get(weaponId)
  const rule = arsenal.rules.hands
  if (!def || def.category === 'hand' || rule.bare.includes(weaponId)) return BARE
  const isTwoHanded = (rule.twoHanded.categories.includes(def.category) || rule.twoHanded.weapons.includes(weaponId) || (def.tags ?? []).includes('two_handed')) && !canDualWield(arsenal, weaponId)
  const slot = weaponId in rule.weaponSlots ? rule.weaponSlots[weaponId] : rule.slots[def.category]
  return { hands: isTwoHanded ? 2 : 1, slot: slot ?? null }
}
