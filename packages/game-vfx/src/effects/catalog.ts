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
import { SHOPFRONT_GLASS } from './destruction/shopfront-glass'
import { DOOR_STAGES } from './destruction/door-stages'
import { BUILDING_COLLAPSE } from './destruction/building-collapse'
import { BLOCK_WALL } from './destruction/block-wall'
import { METAL_DOOR_EFFECT } from './destruction/metal-door'
import { IRON_RAILING } from './destruction/iron-railing'
import { WOODEN_FENCE } from './destruction/wooden-fence'
import { HIT_POINT_BREAKAGE } from './destruction/hit-point-breakage'
import { PRESSURE_CYLINDERS } from './destruction/pressure-cylinders'
import { BUILDING_FIRE } from './world/building-fire'
import { FOG_AND_ASH } from './world/fog-and-ash'
import { RAIN_AND_PUDDLES } from './world/rain'
import { HEADLIGHTS_IN_RAIN } from './vehicles/headlights'
import { SCRAPING_SPARKS } from './vehicles/scraping-sparks'
import { ENGINE_SMOKE } from './vehicles/engine-smoke'
import { FUEL_LEAK } from './vehicles/fuel-leak'
import { CAR_EXPLOSION } from './vehicles/car-explosion'
import { WINDSHIELD } from './vehicles/windshield'
import { DAMAGE_AND_BITE } from './screen/damage-and-bite'
import { INFECTION_PHASES } from './screen/infection-phases'
import { PANIC } from './screen/panic'
import { BLOATER_BLINDNESS } from './screen/bloater-blindness'
import { CAMPFIRE } from './screen/campfire'
import { COUGH_AND_BREATH } from './screen/cough-and-breath'
import { EVENT_EFFECTS } from './events'
import { VIEWMODEL_EFFECTS } from './weapons/viewmodel'
import { VEHICLE_EFFECTS } from './vehicles/game-effects'
import type { EffectDef } from './types'

const ALL_EFFECTS: readonly EffectDef[] = [BLOOD_HIT, HEADSHOT, DISMEMBER, BLOATER_CLOUD, SCREAMER_SHRIEK, CORPSE_DECAY, REANIMATION, EYES_IN_FOG, MUZZLE_FLASH, IMPACT_BY_MATERIAL, PENETRATION, CASINGS_AND_MAGAZINE, MOLOTOV, GRENADE, EXPLOSIVE_BARREL, SHOPFRONT_GLASS, DOOR_STAGES, BUILDING_COLLAPSE, BLOCK_WALL, METAL_DOOR_EFFECT, IRON_RAILING, WOODEN_FENCE, HIT_POINT_BREAKAGE, PRESSURE_CYLINDERS, BUILDING_FIRE, RAIN_AND_PUDDLES, FOG_AND_ASH, SCRAPING_SPARKS, ENGINE_SMOKE, FUEL_LEAK, CAR_EXPLOSION, WINDSHIELD, HEADLIGHTS_IN_RAIN, DAMAGE_AND_BITE, INFECTION_PHASES, PANIC, BLOATER_BLINDNESS, CAMPFIRE, COUGH_AND_BREATH]

/** Every effect of the Workshop by id. A game adds, changes or removes entries with `patchEffects`. */
export const WORKSHOP_EFFECTS: Readonly<Record<string, EffectDef>> = Object.fromEntries(ALL_EFFECTS.map((effect) => [effect.id, effect]))

/** The Workshop's recipes plus the one-shot effects the destruction events play (`event-effects.json`) and the ones of the weapon in the player's hands and the vehicle ones (`vehicle_fire`, `vehicle_exhaust`, `vehicle_leak`, written around a car): what a world plays by default. */
export const GAME_EFFECTS: Readonly<Record<string, EffectDef>> = { ...WORKSHOP_EFFECTS, ...Object.fromEntries([...EVENT_EFFECTS, ...VIEWMODEL_EFFECTS, ...VEHICLE_EFFECTS].map((effect) => [effect.id, effect])) }

/** A copy of the recipes with some changed (a partial replaces the fields it names), added or removed (`null`); a game tunes the Workshop's effects without touching the core. */
export function patchEffects(base: Readonly<Record<string, EffectDef>>, changes: Readonly<Record<string, Partial<EffectDef> | EffectDef | null>>): Record<string, EffectDef> {
  const result: Record<string, EffectDef> = { ...base }
  for (const [id, change] of Object.entries(changes)) {
    if (change === null) delete result[id]
    else result[id] = { ...(base[id] ?? {}), ...change, id } as EffectDef
  }
  return result
}
