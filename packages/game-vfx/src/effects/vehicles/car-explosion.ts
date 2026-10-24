import { DELTA, gt, query, TIME, vadd } from '../dsl'
import { after, behavior, call, cue, fireLight, when } from '../steps'
import type { EffectDef } from '../types'
import { VEHICLE_BOOM } from './boom'

/** W1133-1139 (`explosao`, `lab: 1`): a big blast (scale 1.8 of the grenade), the car jumps and lands crooked, bonnet, doors and a wheel fly, and the wreck burns. */
export const CAR_EXPLOSION: EffectDef = {
  id: 'car_explosion',
  pageId: 'explosao',
  team: 'vehicles',
  lab: 'car_fuel_tank',
  budget: { particles: 600, debris: 34, lights: 1 },
  loop: 10,
  view: { eye: [12, 4.2, 8], target: [5.6, 1, 0.8] },
  props: ['car'],
  setup: [cue('zombie_visible', { index: -1, visible: false })],
  timeline: [after(0.4, ...VEHICLE_BOOM)],
  tick: [
    when(gt(TIME, 0.5), [
      call('fire_emit', 'wr', vadd(query('car', 'position'), [0, 0.9, 0]), 0.8, 1.4, { smoke: 18, smokeAlpha: 0.55 }),
      fireLight(0, vadd(query('car', 'position'), [0, 1.6, 0]), 3.4, TIME),
    ]),
    behavior('car', 'step', { dt: DELTA }),
  ],
}
