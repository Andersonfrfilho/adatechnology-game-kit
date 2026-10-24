import { gt, lt, and, INDEX, ite, mod, scaled, TIME } from '../dsl'
import { after, burst, debris, decal, emit, repeat, ring, screen, when } from '../steps'
import type { EffectDef } from '../types'

const CENTRE: readonly [number, number, number] = [0, 1.1, 0]
const UP: readonly [number, number, number] = [0, 1, 0]

/** W501-520: the belly bursts after a second and leaves a green cloud near the ground for eight. */
export const BLOATER_CLOUD: EffectDef = {
  id: 'bloater_cloud',
  pageId: 'inchado',
  team: 'creatures',
  budget: { particles: 180 },
  loop: 9,
  view: { eye: [5.5, 3.2, 6], target: [0, 1, 0] },
  timeline: [
    after(
      1,
      burst('normal', 40, { p: CENTRE, r: 0.4, sp: [1.5, 4], drag: 2.2, life: [4, 6], size: [1, 2.2], grow: 2, c0: 0x6f8a3c, c1: 0x3b4a26, a: 0.32, fi: 0.08, g: 0.05 }),
      burst('normal', 30, { p: CENTRE, dir: UP, cone: 1.3, sp: [2, 4], life: 1.4, size: [0.04, 0.08], c0: 0x4a5a1c, g: 9.8, fi: 0, gnd: 3, ds: [0.1, 0.2] }),
      repeat(scaled(10), debris({ p: CENTRE, dir: UP, cone: 1.2, sp: [2, 5], size: [0.07, 0.05, 0.07], k: [0.6, 1.4], c: ite(mod(INDEX, 2), 0x6b7a52, 0x4a1a12), life: 9 })),
      decal(0, 0, 0, 1.6, 0x6a7a24, { grow: 0.6, life: 60, fluid: 'bile' }),
      ring([0, 0.02, 0], 4, 4, 8, 0x3a5a20, UP, 0.35),
      screen({ add: { shake: 0.15 } }),
    ),
  ],
  tick: [
    when(and(gt(TIME, 1), lt(TIME, 8)), [
      emit('gas', 'normal', 7, { p: [0, 0.4, 0], r: 3.4, flat: true, dir: UP, cone: 1.3, sp: [0.1, 0.35], drag: 0.4, life: [3, 5], size: [1.2, 2.2], grow: 1.5, c0: 0x6f8a3c, c1: 0x3b4a26, a: 0.22, fi: 0.3 }),
      emit('mote', 'add', 10, { p: [0, 0.6, 0], r: 3.6, flat: true, dir: UP, cone: 0.6, sp: [0.05, 0.25], life: [1.5, 2.5], size: [0.04, 0.07], c0: 0x5fe08a, a: 0.7, fi: 0.4 }),
    ]),
  ],
}
