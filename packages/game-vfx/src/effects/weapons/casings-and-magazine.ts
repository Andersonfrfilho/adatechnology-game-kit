import { add, gt, INDEX, lt, and, mul, TIME } from '../dsl'
import { after, call, cue, debris, emit, repeat, when } from '../steps'
import type { EffectDef } from '../types'

const TIP = [-0.8, 1.38, 3.4 - 0.78] as const
const PORT = [-0.76, 1.4, 3.32] as const
const FORWARD = [0, 0, -1] as const
const UP = [0, 1, 0] as const
const BURST_SHOTS = 12

/** W787-797: twelve rounds of an AK with their brass, the empty magazine falling at 1.8 s and a thread of smoke from the hot barrel. */
export const CASINGS_AND_MAGAZINE: EffectDef = {
  id: 'casings_and_magazine',
  pageId: 'capsulas',
  team: 'weapons',
  budget: { particles: 200, debris: 13 },
  loop: 4.6,
  view: { eye: [0.9, 1.3, 4.6], target: [-0.6, 0.6, 3.1] },
  setup: [cue('gun_visible', { visible: true }), cue('zombie_visible', { index: -1, visible: false })],
  timeline: [
    repeat(
      BURST_SHOTS,
      after(add(0.2, mul(INDEX, 0.1)), call('muzzle', 'ak', TIP, FORWARD), call('casing', PORT, ''), cue('gun_recoil', { kick: 0.05 })),
    ),
    after(1.8, debris({ p: [-0.8, 1.15, 3.3], v: [0.1, -0.5, 0.1], sp: 0, size: [0.05, 0.2, 0.09], c: 0x2a2a2a, spin: 3, life: 20, bounce: 0.2 })),
  ],
  tick: [
    when(and(gt(TIME, 1.4), lt(TIME, 3.6)), [
      emit('hot', 'normal', 10, { p: TIP, dir: UP, cone: 0.25, sp: [0.2, 0.5], life: [1.4, 2.2], size: [0.03, 0.06], grow: 5, c0: 0x9a9a96, a: 0.18, g: -0.2, fi: 0.2 }),
    ]),
  ],
}
