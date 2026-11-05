import { ARCHETYPE_IDS } from './arsenal'
import type { Arsenal, WeaponId } from './types'

// the archetypes that are a generic gun ("pistola 9 mm"): a firearm, or a flamethrower a real one stands for; the bows, the melee weapons and the throwables are the real object
const isGenericKind = (kind: string, category: string): boolean => (kind === 'firearm' && category !== 'bow' && category !== 'crossbow') || kind === 'flame'

/**
 * The generic guns of the arsenal (the `9 mm service pistol`, the `5.56 mm assault rifle`...) and the real weapon that stands for each: the brand weapon of lowest id that names
 * it as its `archetype` and fires the same way, the one whose model it wears; `undefined` for a generic no real weapon stands for (the `.22 LR pistol`).
 */
export function genericWeapons(arsenal: Arsenal): ReadonlyMap<WeaponId, WeaponId | undefined> {
  const archetypes = new Set<string>(ARCHETYPE_IDS)
  const generics = new Map<WeaponId, WeaponId | undefined>()
  for (const def of arsenal.weapons.values()) if (archetypes.has(def.id) && isGenericKind(def.action.kind, def.category) && !def.maker) generics.set(def.id, undefined)
  for (const def of [...arsenal.weapons.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const { archetype } = def
    if (!archetype || archetypes.has(def.id) || !generics.has(archetype) || generics.get(archetype)) continue
    if (arsenal.weapons.get(archetype)?.action.kind === def.action.kind) generics.set(archetype, def.id)
  }
  // a flame no real weapon stands for is the object itself (the lighter)
  for (const [id, brand] of generics) if (!brand && arsenal.weapons.get(id)?.action.kind === 'flame') generics.delete(id)
  return generics
}

/** A loadout with each generic gun swapped for the real weapon that stands for it (dropped when none does), and no id twice. */
export function realLoadout(arsenal: Arsenal, loadout: readonly WeaponId[]): WeaponId[] {
  const generics = genericWeapons(arsenal)
  const real = loadout.flatMap((id) => (generics.has(id) ? [generics.get(id)].filter((brand): brand is WeaponId => brand !== undefined) : [id]))
  return [...new Set(real)]
}
