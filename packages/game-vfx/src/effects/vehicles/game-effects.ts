import { CAR_ORIGIN } from './car'
import { ENGINE_SMOKE } from './engine-smoke'
import { FUEL_LEAK, FUEL_LEAK_ONLY, TANK } from './fuel-leak'
import { NORMAL, variable } from '../dsl'
import { call } from '../steps'
import type { EffectDef } from '../types'

/**
 * The Garagem's recipes written around a car, to be played at a vehicle: the Workshop's `engine_smoke` and `fuel_leak` keep the car where the page stood
 * it (`CAR_ORIGIN`), so each alias names that spot as its `anchor` and the effect lands on the point it is played at. The values are the recipes' own;
 * only the id, the condition they start in and (for the exhaust) how long one play lasts change. Ids a vehicle module asks for: `vehicle_fire`, `vehicle_leak`, `vehicle_leak_ignited`, `vehicle_exhaust`.
 * The other vehicle requests use point-based entries that already exist (the explosion catalogue's `car_fuel_tank`, `glass_burst`) and `impact_bodywork`.
 */
const aliasOf = (base: EffectDef, id: string, changes: Partial<EffectDef>): EffectDef => ({ ...base, id, pageId: `vehicle:${id}`, anchor: CAR_ORIGIN, ...changes })

/**
 * A round into a vehicle's skin, played at the hit with the panel's `normal` (world) and the values `bore` (metres), `paint`, `metal` (0xRRGGBB) and `dx`, `dy`, `dz` (the round's path, world): sparks off the reflected path, a
 * flash, paint flakes and sheet slivers as debris pieces. It leaves no mark: the vehicle draws the hole on the panel (`impact_metal` would leave a world decal
 * that faces its own axes, not the panel, and stays in the air when the door swings).
 */
export const BODYWORK_IMPACT: EffectDef = {
  id: 'impact_bodywork',
  pageId: 'vehicle:impact_bodywork',
  team: 'vehicles',
  budget: { particles: 80, debris: 20, lights: 1 },
  loop: 2,
  timeline: [call('bodywork_impact', [0, 0, 0], NORMAL, [variable('dx'), variable('dy'), variable('dz')], variable('bore'), variable('paint'), variable('metal'))],
}

export const VEHICLE_EFFECTS: readonly EffectDef[] = [
  BODYWORK_IMPACT,
  /** The engine on fire: `engine_smoke` at its worst condition (black smoke, flames in the hood, a light). */
  aliasOf(ENGINE_SMOKE, 'vehicle_fire', { params: { id: 'condition', options: ['100', '60', '30', '10'], default: 3 }, loop: 12 }),
  /** The exhaust of a car under way: `engine_smoke` in the best condition, for half a second so a moving car asks again. */
  aliasOf(ENGINE_SMOKE, 'vehicle_exhaust', { params: { id: 'condition', options: ['100', '60', '30', '10'], default: 0 }, loop: 0.5 }),
  /**
   * A hole in a tank: the page's drips, falling from the point it is played at (the hole). No pool of its own: the pool is the liquid that came out, laid by the
   * host's fluid world as it leaks (it grows with the volume and spreads by the liquid's own kind), not a drawing of a size the page chose.
   */
  aliasOf(FUEL_LEAK_ONLY, 'vehicle_leak', { anchor: TANK, timeline: [] }),
  /** The leak caught fire (an incendiary or tracer round, a spark, a fire near): the page's whole sequence, the fire running along the pool to the tank and the blast. */
  aliasOf(FUEL_LEAK, 'vehicle_leak_ignited', {}),
]
