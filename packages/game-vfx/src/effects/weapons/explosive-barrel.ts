import { add, and, cos, gt, ge, INDEX, ite, lt, mod, mul, rnd, scaled, sin, sub, TIME, variable, vadd, concat } from '../dsl'
import { after, append, burst, call, cue, debris, emit, fireLight, fireLightOff, repeat, set, when } from '../steps'
import type { EffectDef } from '../types'

const BARREL = [-4.4, 0, 1.4] as const
const UP = [0, 1, 0] as const
const RED = 0x9b1c18
const YELLOW = 0xd8b02a
const POOLS = 3
const above = (height: number) => vadd(BARREL, [0, height, 0])

/** W831-845 (`lab: 1`): the barrel goes up in a mushroom, its lid and red scraps fly, three pools of petrol burn for 5 s and a black column marks it from afar. */
export const EXPLOSIVE_BARREL: EffectDef = {
  id: 'explosive_barrel',
  pageId: 'barril',
  team: 'weapons',
  lab: 'barrel',
  budget: { particles: 450, lights: 1 },
  loop: 9,
  view: { eye: [2.4, 3, 7.5], target: [-4.4, 1.6, 1.4] },
  setup: [cue('zombie_visible', { index: -1, visible: false })],
  timeline: [
    set('pools', []),
    after(
      0.4,
      cue('barrel_visible', { visible: false }),
      call('explode', BARREL, 1.3, RED),
      burst('add', 30, { p: above(0.8), r: 0.4, dir: UP, cone: 0.25, sp: [3, 5], drag: 1.2, life: [1, 1.6], size: [0.9, 1.4], grow: 1.4, c0: 0xffb050, c1: 0x3a0d05, g: -1, fi: 0.05 }),
      debris({ p: above(1), v: [0.6, 9, 0.3], sp: 0, size: [0.7, 0.05, 0.7], c: RED, spin: 8, life: 12 }),
      repeat(scaled(8), debris({ p: BARREL, dir: UP, cone: 1, sp: [3, 7], size: [0.25, 0.04, 0.18], c: ite(mod(INDEX, 2), RED, YELLOW), life: 12 })),
      repeat(
        POOLS,
        set('poolAngle', add(mul(INDEX, 2.1), rnd(0, 0.6))),
        append('pools', vadd(BARREL, [mul(cos(variable('poolAngle')), 1.4), 0.05, mul(sin(variable('poolAngle')), 1.4)])),
      ),
    ),
  ],
  tick: [
    when(and(variable('pools'), gt(TIME, 0.5), lt(TIME, 6)), [
      set('poolFade', ite(gt(TIME, 5), sub(1, sub(TIME, 5)), 1)),
      repeat(POOLS, call('fire_emit', concat('bp', INDEX), { $: 'at', a: [variable('pools'), INDEX] }, 0.45, mul(0.6, variable('poolFade')), { smoke: 6 })),
      fireLight(0, above(1), mul(2.6, variable('poolFade')), TIME),
    ]),
    when(and(gt(TIME, 0.6), lt(TIME, 8)), [
      emit('col', 'normal', 6, { p: above(1.5), r: 0.6, dir: UP, cone: 0.2, sp: [1.5, 2.5], v: [0.4, 0, 0], drag: 0.05, life: [4, 6], size: [1.2, 1.8], grow: 3, c0: 0x1a1817, c1: 0x0c0d10, a: 0.5, fi: 0.2 }),
    ]),
    when(ge(TIME, 6), [fireLightOff(0)]),
  ],
}
