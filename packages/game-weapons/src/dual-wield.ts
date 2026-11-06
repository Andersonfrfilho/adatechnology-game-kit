import type { Arsenal, WeaponId, WeaponRules } from './types'

/**
 * Whether a body can hold one of this weapon in each hand (`rules.dualWield`): its category is listed or its id is, and it is not excluded. A game changes the lists through
 * `ArsenalOptions.rules`; an unknown id answers false.
 */
export function canDualWield(arsenal: Pick<Arsenal, 'weapons' | 'rules'>, weaponId: WeaponId): boolean {
  const def = arsenal.weapons.get(weaponId)
  if (!def) return false
  return isDualWieldable(arsenal.rules.dualWield, weaponId, def.category)
}

const isDualWieldable = (rule: WeaponRules['dualWield'], weaponId: WeaponId, category: string): boolean => {
  if (rule.exclude.includes(weaponId)) return false
  return rule.weapons.includes(weaponId) || (rule.categories as readonly string[]).includes(category)
}
