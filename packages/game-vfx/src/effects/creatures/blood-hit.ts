import { add, and, gt, lt, mul, param, PARAM, pick, TIME, vnorm } from '../dsl'
import { after, call, decal, emit, when } from '../steps'
import type { EffectDef } from '../types'

const BLOOD = param(0x8a0a0a, 0x5a0c10, 0x3a1c12, 0x1d1914)
const BLEED = [1, 0.7, 0.35]

/** W449-473: blood by infection age: a mist at the entry, a jet at the exit, a pool that grows and darkens. */
export const BLOOD_HIT: EffectDef = {
  id: 'blood_hit',
  pageId: 'sangue',
  team: 'creatures',
  params: { id: 'age', options: ['fresh', 'recent', 'old', 'decrepit'], default: 0 },
  budget: { particles: 70, decals: 1 },
  loop: 3.2,
  view: { eye: [2.6, 1.9, 3.4], target: [0, 1, -0.6] },
  timeline: [
    after(0.3, call('blood_hit', [0, 1.3, 0.1], vnorm([0.15, 0.1, -1]), PARAM)),
    after(1.5, call('blood_hit', [0.1, 1.05, 0.1], vnorm([-0.2, 0.05, -1]), PARAM, 0.8)),
    when(lt(PARAM, 3), [after(0.7, decal(0, 0, -0.2, add(0.5, mul(0.7, pick(BLEED, PARAM))), BLOOD, { grow: add(2, mul(2, pick(BLEED, PARAM))), dark: 60, dry: 0x3b1d14 }))]),
  ],
  tick: [
    when(and(lt(PARAM, 2), gt(TIME, 0.3)), [
      emit('drip', 'normal', param(7, 3), {
        p: [0.05, 1.15, 0.17], box: [0.08, 0.05, 0], dir: [0, 1, 0], cone: 0.2, sp: [0, 0.2], life: 1.2, size: 0.03, c0: BLOOD, g: 9.8, fi: 0, gnd: 3, ds: [0.04, 0.08],
      }),
    ]),
  ],
}
