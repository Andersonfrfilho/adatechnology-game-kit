import { DELTA, eq, gt, ite, lt, mul, PARAM, rand, TIME } from '../dsl'
import { burst, call, emit, fireLight, fireLightOff, when } from '../steps'
import type { EffectDef } from '../types'
import { carDirection, carPoint } from './car'

const HOOD = carPoint(0, 1.02, 1.4)
const EXHAUST = carPoint(0.5, 0.3, -2.2)
const EXHAUST_DIRECTION = carDirection(EXHAUST, carPoint(0.5, 0.3, -3))
const SPARK_FROM = carPoint(0, 0.7, 2.1)
const SPARK_DIRECTION = carDirection(SPARK_FROM, carPoint(0, 0.9, 3))
const WORN = 1
const BAD = 2
const CRITICAL = 3

/** W1101-1112 (`motor`): exhaust only at 100, a thread of white steam at 60, steady grey smoke and the odd spark at 30, thick black smoke with fire at 10. */
export const ENGINE_SMOKE: EffectDef = {
  id: 'engine_smoke',
  pageId: 'motor',
  team: 'vehicles',
  params: { id: 'condition', options: ['100', '60', '30', '10'], default: 2 },
  budget: { particles: 120, lights: 1 },
  loop: 0,
  view: { eye: [9.5, 2.6, 5.2], target: [5.2, 0.9, 1.5] },
  timeline: [],
  tick: [
    emit('ex', 'normal', ite(eq(PARAM, CRITICAL), 6, 3), { p: EXHAUST, dir: EXHAUST_DIRECTION, cone: 0.3, sp: [0.6, 1.2], drag: 1.2, life: [1, 1.8], size: [0.06, 0.12], grow: 5, c0: ite(gt(PARAM, 1), 0x55524e, 0x9a9a96), a: 0.18, g: -0.2 }),
    when(eq(PARAM, WORN), [
      emit('st', 'normal', 14, { p: HOOD, box: [0.4, 0, 0.3], dir: [0, 1, 0], cone: 0.35, sp: [0.5, 1], drag: 0.8, life: [1.4, 2.4], size: [0.15, 0.25], grow: 4, c0: 0xc8ccd0, a: 0.22, g: -0.3 }),
    ]),
    when(eq(PARAM, BAD), [
      emit('st', 'normal', 22, { p: HOOD, box: [0.4, 0, 0.3], dir: [0, 1, 0], cone: 0.35, sp: [0.6, 1.2], drag: 0.6, life: [2, 3], size: [0.2, 0.35], grow: 4, c0: 0x6a6a68, c1: 0x3a3a3c, a: 0.4, g: -0.35 }),
      when(lt(rand(), mul(DELTA, 0.8)), [burst('streak', 8, { p: SPARK_FROM, dir: SPARK_DIRECTION, cone: 0.6, sp: [2, 4], life: 0.3, len: 0.02, c0: 0xffd080, c1: 0xff4000, g: 9.8 })]),
    ]),
    when(eq(PARAM, CRITICAL), [
      emit('st', 'normal', 34, { p: HOOD, box: [0.5, 0, 0.4], dir: [0, 1, 0], cone: 0.3, sp: [0.8, 1.6], drag: 0.4, life: [2.5, 3.8], size: [0.3, 0.5], grow: 4.5, c0: 0x1c1b1b, c1: 0x0e0e10, a: 0.6, g: -0.4 }),
      call('fire_emit', 'hood', carPoint(0, 0.8, 2.0), 0.3, 0.45, { noSmoke: true }),
      fireLight(0, carPoint(0, 1.2, 2.6), 2.2, TIME),
    ], [fireLightOff(0)]),
  ],
}
