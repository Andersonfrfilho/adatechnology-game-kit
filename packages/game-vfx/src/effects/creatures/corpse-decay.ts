import { and, gt, lt, TIME } from '../dsl'
import { after, decal, emit, when } from '../steps'
import type { EffectDef } from '../types'

const UP: readonly [number, number, number] = [0, 1, 0]

/** W540-553: fifteen minutes in eight seconds: the pool dries, flies appear from the minute five and the body turns to dust. */
export const CORPSE_DECAY: EffectDef = {
  id: 'corpse_decay',
  pageId: 'corpo',
  team: 'creatures',
  budget: { particles: 40 },
  loop: 8.5,
  view: { eye: [2.4, 1.6, 2.6], target: [0, 0.3, -0.6] },
  timeline: [after(0.8, decal(0, 0, -0.9, 1.1, 0x5a0c10, { grow: 1.5, dark: 5, dry: 0x3b1d14 }))],
  tick: [
    when(and(gt(TIME, 2.5), lt(TIME, 7)), [
      emit('fly', 'normal', 6, { p: [0, 0.35, -0.8], r: 0.5, sp: [0.3, 0.8], life: [0.6, 1.2], size: 0.02, c0: 0x050505, a: 1, fi: 0.2 }),
    ]),
    when(and(gt(TIME, 6.8), lt(TIME, 7.6)), [
      emit('dust', 'normal', 40, { p: [0, 0.15, -0.8], box: [0.25, 0.05, 0.8], dir: UP, cone: 0.6, sp: [0.2, 0.6], drag: 1, life: [1, 1.8], size: [0.12, 0.22], grow: 3, c0: 0x2b2722, a: 0.5 }),
    ]),
  ],
}
