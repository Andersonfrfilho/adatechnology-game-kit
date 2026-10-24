import { CAR_ORIGIN } from './car'
import { ENGINE_SMOKE } from './engine-smoke'
import { FUEL_LEAK } from './fuel-leak'
import type { EffectDef } from '../types'

/**
 * The Garagem's recipes written around a car, to be played at a vehicle: the Workshop's `engine_smoke` and `fuel_leak` keep the car where the page stood
 * it (`CAR_ORIGIN`), so each alias names that spot as its `anchor` and the effect lands on the point it is played at. The values are the recipes' own;
 * only the id, the condition they start in and (for the exhaust) how long one play lasts change. Ids a vehicle module asks for: `vehicle_fire`, `vehicle_leak`, `vehicle_exhaust`.
 * The other vehicle requests use point-based entries that already exist: the explosion catalogue's `car_fuel_tank`, `glass_burst` and `impact_metal`.
 */
const aliasOf = (base: EffectDef, id: string, changes: Partial<EffectDef>): EffectDef => ({ ...base, id, pageId: `vehicle:${id}`, anchor: CAR_ORIGIN, ...changes })

export const VEHICLE_EFFECTS: readonly EffectDef[] = [
  /** The engine on fire: `engine_smoke` at its worst condition (black smoke, flames in the hood, a light). */
  aliasOf(ENGINE_SMOKE, 'vehicle_fire', { params: { id: 'condition', options: ['100', '60', '30', '10'], default: 3 }, loop: 12 }),
  /** The exhaust of a car under way: `engine_smoke` in the best condition, for half a second so a moving car asks again. */
  aliasOf(ENGINE_SMOKE, 'vehicle_exhaust', { params: { id: 'condition', options: ['100', '60', '30', '10'], default: 0 }, loop: 0.5 }),
  /** A hole in the tank: the page's own petrol leak (drips, pool, sparks, fire running to the tank). */
  aliasOf(FUEL_LEAK, 'vehicle_leak', {}),
]
