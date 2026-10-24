import { BLOATER_CLOUD } from './creatures/bloater-cloud'
import { BLOOD_HIT } from './creatures/blood-hit'
import { CORPSE_DECAY } from './creatures/corpse-decay'
import { EYES_IN_FOG } from './creatures/eyes-in-fog'
import { DISMEMBER } from './creatures/dismember'
import { HEADSHOT } from './creatures/headshot'
import { REANIMATION } from './creatures/reanimation'
import { SCREAMER_SHRIEK } from './creatures/screamer-shriek'
import { IMPACT_BY_MATERIAL } from './weapons/impact-by-material'
import { PENETRATION } from './weapons/penetration'
import { CASINGS_AND_MAGAZINE } from './weapons/casings-and-magazine'
import { MOLOTOV } from './weapons/molotov'
import { GRENADE } from './weapons/grenade'
import { EXPLOSIVE_BARREL } from './weapons/explosive-barrel'
import { MUZZLE_FLASH } from './weapons/muzzle-flash'
import type { EffectDef } from './types'

const ALL_EFFECTS: readonly EffectDef[] = [BLOOD_HIT, HEADSHOT, DISMEMBER, BLOATER_CLOUD, SCREAMER_SHRIEK, CORPSE_DECAY, REANIMATION, EYES_IN_FOG, MUZZLE_FLASH, IMPACT_BY_MATERIAL, PENETRATION, CASINGS_AND_MAGAZINE, MOLOTOV, GRENADE, EXPLOSIVE_BARREL]

/** Every effect of the Workshop by id. A game adds, changes or removes entries with `patchEffects`. */
export const WORKSHOP_EFFECTS: Readonly<Record<string, EffectDef>> = Object.fromEntries(ALL_EFFECTS.map((effect) => [effect.id, effect]))

/** A copy of the recipes with some changed (a partial replaces the fields it names), added or removed (`null`); a game tunes the Workshop's effects without touching the core. */
export function patchEffects(base: Readonly<Record<string, EffectDef>>, changes: Readonly<Record<string, Partial<EffectDef> | EffectDef | null>>): Record<string, EffectDef> {
  const result: Record<string, EffectDef> = { ...base }
  for (const [id, change] of Object.entries(changes)) {
    if (change === null) delete result[id]
    else result[id] = { ...(base[id] ?? {}), ...change, id } as EffectDef
  }
  return result
}
