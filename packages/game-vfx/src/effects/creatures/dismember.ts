import { ite, gt, lt, and, mul, sin, sub, vnorm, TIME } from '../dsl'
import { after, burst, debris, emit, when } from '../steps'
import type { EffectDef } from '../types'

const SHOULDER: readonly [number, number, number] = [0.36, 1.46, 0.05]
const FRESH_BLOOD = 0x8a0a0a

/** W487-500: the arm leaves as a loose piece and the shoulder spurts in pulses for half a second. */
export const DISMEMBER: EffectDef = {
  id: 'dismember',
  pageId: 'membro',
  team: 'creatures',
  budget: { particles: 60, debris: 1, decals: 4 },
  loop: 3.6,
  view: { eye: [3, 1.8, 2.2], target: [0.4, 1.1, 0] },
  timeline: [
    after(
      0.4,
      debris({ p: SHOULDER, v: [2.2, 2.5, -0.6], sp: 0, size: [0.12, 0.12, 0.66], c: 0x6d7a5a, spin: 9, life: 12, bounce: 0.25 }),
      burst('normal', 12, { p: SHOULDER, r: 0.05, sp: [0.3, 1.2], drag: 3, life: [0.3, 0.6], size: [0.1, 0.16], grow: 3, c0: FRESH_BLOOD, a: 0.6 }),
    ),
  ],
  tick: [
    when(and(gt(TIME, 0.4), lt(TIME, 1.1)), [
      emit('jet', 'normal', mul(90, ite(gt(sin(mul(sub(TIME, 0.4), 28)), 0), 1, 0.2)), { p: SHOULDER, dir: vnorm([1, 0.35, 0.1]), cone: 0.25, sp: [1.5, 3], life: 1.4, size: [0.03, 0.055], c0: FRESH_BLOOD, g: 9.8, fi: 0, gnd: 3, ds: [0.05, 0.12] }),
    ]),
  ],
}
