import { add, and, clamp, DELTA, div, ge, gt, lt, mul, query, sub, TIME, variable, vadd, vlerp } from '../dsl'
import { after, behavior, burst, call, cue, decal, emit, fireLight, set, when } from '../steps'
import type { EffectDef } from '../types'
import { VEHICLE_BOOM } from './boom'
import { carDirection, carPoint } from './car'

const TANK = carPoint(-0.6, 0.25, -1.3)
const TANK_FLOOR = [TANK[0], 0, TANK[2]] as const
const POOL = [TANK_FLOOR[0] - 1.2, 0, TANK_FLOOR[2] - 0.6] as const
const BOOM_AT = 7.2
const HOLE = carPoint(-0.96, 0.6, -1.2)

/** W1113-1132 (`vazamento`): petrol drips into a pool, a shot into the metal throws a spark, the fire runs along the pool to the tank and the car blows up. */
export const FUEL_LEAK: EffectDef = {
  id: 'fuel_leak',
  pageId: 'vazamento',
  team: 'vehicles',
  budget: { particles: 400, lights: 1 },
  loop: 11,
  view: { eye: [10, 2.4, 4.2], target: [5.6, 0.4, 0] },
  setup: [cue('zombie_visible', { index: -1, visible: false })],
  timeline: [
    decal(POOL[0], 0, POOL[2], 2.2, 0x1f2230, { grow: 3, life: 60, ar: 0.6, fluid: 'oil' }),
    after(
      3.4,
      call('impact', 'metal', HOLE, carDirection(HOLE, carPoint(-2, 0.6, -1.2)), 1.5),
      burst('streak', 14, { p: [POOL[0], 0.05, POOL[2]], cone: 1.4, sp: [1, 3], life: 0.3, len: 0.02, c0: 0xffd080, c1: 0xff4000, g: 9.8 }),
    ),
    after(BOOM_AT, ...VEHICLE_BOOM),
  ],
  tick: [
    when(lt(TIME, BOOM_AT), [
      emit('drip', 'normal', 12, { p: TANK, box: [0.05, 0, 0.05], sp: 0, life: 1, size: 0.03, c0: 0x5a5a7a, a: 0.9, g: 9.8, fi: 0, gnd: 1 }),
    ]),
    when(and(gt(TIME, 3.5), lt(TIME, BOOM_AT)), [
      set('spread', clamp(div(sub(TIME, 3.5), 2.5), 0, 1)),
      set('front', vlerp(POOL, TANK_FLOOR, mul(variable('spread'), 0.8))),
      call('fire_emit', 'vz', variable('front'), add(0.6, mul(variable('spread'), 0.4)), 1.1, { smoke: 14 }),
      call('fire_emit', 'vz2', POOL, 0.7, 0.8, { smoke: 6 }),
      fireLight(0, vadd(variable('front'), [0, 1, 0]), 3, TIME),
    ]),
    when(ge(TIME, BOOM_AT), [
      call('fire_emit', 'wr', vadd(query('car', 'position'), [0, 0.9, 0]), 0.8, 1.4, { smoke: 18, smokeAlpha: 0.55 }),
      fireLight(0, vadd(query('car', 'position'), [0, 1.6, 0]), 3.4, TIME),
      behavior('car', 'step', { dt: DELTA }),
    ]),
  ],
}
