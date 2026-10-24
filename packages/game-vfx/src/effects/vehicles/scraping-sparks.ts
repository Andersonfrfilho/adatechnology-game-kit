import { add, DELTA, lt, mul, rand, rnd, sub, TIME, variable, vx, vz } from '../dsl'
import { cue, decal, emit, fireLight, set, when } from '../steps'
import { normalized } from '../vector-math'
import type { EffectDef } from '../types'

const YAW = -Math.PI / 2
const COS = Math.cos(YAW)
const SIN = Math.sin(YAW)
const START_X = 10
const SPEED = 2.4
/** `carW(0.6, 0.06, 2.15)` for a car turned by `YAW`, as the matrix multiplies it (the y component is replaced by 0.04). */
const contactX = (carX: number | object) => add(COS * 0.6, 0 * 0.06, SIN * 2.15, carX)
const contactZ = add(-SIN * 0.6, 0 * 0.06, COS * 2.15, 1.5)
const BACKWARD = normalized([1, 0.35, 0])

/** W1090-1100 (`faisca`): a bumper dragging on the asphalt throws a river of sparks that bounce and go from white to orange, with a short light and dark scratches. */
export const SCRAPING_SPARKS: EffectDef = {
  id: 'scraping_sparks',
  pageId: 'faisca',
  team: 'vehicles',
  budget: { particles: 200, lights: 1 },
  loop: 4.4,
  view: { eye: [2, 1.6, 5.5], target: [3, 0.3, 1.5] },
  setup: [cue('zombie_visible', { index: -1, visible: false }), cue('car_pose', { x: START_X, z: 1.5, yaw: YAW })],
  timeline: [],
  tick: [
    set('carX', sub(START_X, mul(TIME, SPEED))),
    set('contact', [contactX(variable('carX')), 0.04, contactZ]),
    cue('car_pose', { x: variable('carX'), z: 1.5, yaw: YAW }),
    emit('sp', 'streak', 200, { p: variable('contact'), dir: BACKWARD, cone: 0.55, sp: [3, 8], v: [-2.4, 0, 0], life: [0.2, 0.5], len: 0.02, c0: 0xfff0c0, c1: 0xff5010, g: 9.8, gnd: 2 }),
    emit('gl', 'add', 40, { p: variable('contact'), r: 0.05, size: [0.08, 0.16], life: 0.05, c0: 0xffd8a0, fi: 0 }),
    when(lt(rand(), mul(DELTA, 14)), [decal(vx(variable('contact')), 0, add(vz(variable('contact')), rnd(-0.05, 0.05)), 0.12, 0x0a0a0a, { grow: 0, life: 60, ar: 0.25 })]),
    fireLight(0, [vx(variable('contact')), 0.34, vz(variable('contact'))], 1.6, mul(TIME, 3)),
  ],
}
