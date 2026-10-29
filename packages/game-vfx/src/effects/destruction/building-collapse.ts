import { abs, add, and, cos, DELTA, gt, local, lt, mul, rand, rnd, scaled, sin, TIME, variable, vnorm } from '../dsl'
import { after, cue, debris, emit, repeat, screen, spawn, when } from '../steps'
import type { EffectDef } from '../types'

const CENTRE = [-1.4, 3.35, -3.75] as const

/** W872-886 (`desaba`): dust trickles from the awning for a second as a warning, then the slab drops in blocks and a cloud rolls along the street. */
export const BUILDING_COLLAPSE: EffectDef = {
  id: 'building_collapse',
  pageId: 'desaba',
  team: 'destruction',
  budget: { particles: 350, debris: 26 },
  loop: 8,
  view: { eye: [4, 2.4, 5], target: [-1.4, 1.4, -2.8] },
  setup: [cue('zombie_visible', { index: -1, visible: false })],
  timeline: [
    after(
      1.5,
      cue('slab_gone'),
      screen({ add: { shake: 0.3 } }),
      repeat(6, debris({ p: CENTRE, box: [2, 0.05, 0.6], v: [rnd(-0.5, 0.5), rnd(-0.5, 0), rnd(0, 0.8)], sp: 0, size: [rnd(0.5, 1.1), 0.25, rnd(0.4, 0.8)], c: 0x6e6a63, spin: 3, life: 30, bounce: 0.1 })),
      repeat(scaled(20), debris({ p: CENTRE, box: [2.1, 0.1, 0.7], v: [rnd(-1, 1), rnd(-1, 1), rnd(0, 1.5)], sp: 0, size: [0.12, 0.1, 0.12], k: [0.5, 1.5], c: 0x5e5a54, life: 30 })),
    ),
    after(
      2.15,
      screen({ add: { shake: 0.45 } }),
      repeat(
        scaled(70),
        spawn('normal', local('angle', rnd(-0.4, 3.5), {
          p: [add(-1.4, rnd(-2, 2)), 0.2, add(-3.4, rnd(-0.5, 0.5))],
          dir: vnorm([mul(cos(variable('angle')), 0.6), 0.25, abs(sin(variable('angle')))]),
          cone: 0.5, sp: [1, 3.2], drag: 1.1, life: [3, 6], size: [0.7, 1.2], grow: 3, c0: 0x7a7268, c1: 0x4a4640, a: 0.5, fi: 0.12,
        })),
      ),
    ),
  ],
  tick: [
    when(and(gt(TIME, 0.3), lt(TIME, 1.5)), [
      emit('trk', 'normal', 30, { p: [add(-1.4, rnd(-2, 2)), 3.2, -3.05], dir: [0, -1, 0], cone: 0.1, sp: [0.2, 0.5], life: [1, 1.6], size: [0.04, 0.08], grow: 2.5, c0: 0x8a8478, a: 0.5, g: 1 }),
      when(lt(rand(), mul(DELTA, 6)), [debris({ p: [add(-1.4, rnd(-2, 2)), 3.2, -3.05], sp: 0.2, size: [0.04, 0.04, 0.04], c: 0x6e6a63, life: 10 })]),
    ]),
  ],
}
