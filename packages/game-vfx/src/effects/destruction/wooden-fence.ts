import { add, and, DELTA, div, ge, INDEX, min, mul, not, pick, rnd, scaled, sub, variable, vadd, mod } from '../dsl'
import { after, behavior, burst, cue, debris, repeat, screen, set, when } from '../steps'
import { normalized } from '../vector-math'
import type { EffectDef } from '../types'
import { SPOT, UP } from './spot'

/** The order the planks break in and where each stands along the fence (W1005-1006). */
const ORDER = [3, 4, 8, 5, 9, 2, 7]
const PLANK_X = Array.from({ length: 12 }, (_, index) => -1.43 + index * 0.26)
const BODIES = [[-0.8, 0.6], [0.5, 0.7], [0, 1.2]]
const SPLINTER_DIRECTION = normalized([0, 0.4, 1])
const FALL_SECONDS = 0.5
const PLANK_HEIGHT = 1.3

/** W1004-1020 (`cerca`): the planks snap one by one at a random height, the stump stays on the rail and the rest flies; the section finally tips over. */
export const WOODEN_FENCE: EffectDef = {
  id: 'wooden_fence',
  pageId: 'cerca',
  team: 'destruction',
  budget: { particles: 150, debris: 12 },
  loop: 7.5,
  view: { eye: [1, 1.6, 6], target: [-2.2, 0.7, 2.4] },
  setup: [
    cue('zombie_visible', { index: -1, visible: false }),
    cue('work_light', { intensity: 2.2 }),
    ...BODIES.map(([x, dz], index) => behavior('walkers', 'place', { index, x: SPOT[0] + x!, z: SPOT[2] - dz!, facing: 0 })),
  ],
  timeline: [
    repeat(
      ORDER.length,
      after(
        add(0.4, mul(INDEX, 0.5)),
        set('cut', rnd(0.32, 0.6)),
        set('top', sub(PLANK_HEIGHT, variable('cut'))),
        set('break', [add(SPOT[0], pick(PLANK_X, pick(ORDER, INDEX))), variable('cut'), SPOT[2]]),
        cue('zombie_swing', { index: mod(INDEX, 3), side: mod(INDEX, 2) }),
        cue('plank_snap', { plank: pick(ORDER, INDEX), cut: variable('cut') }),
        debris({ p: vadd(variable('break'), [0, div(variable('top'), 2), 0]), v: [rnd(-0.8, 0.8), rnd(1.5, 3), rnd(1.5, 3)], sp: 0, size: [0.17, variable('top'), 0.035], c: 0x8a6a44, spin: 7, life: 20, bounce: 0.2 }),
        repeat(scaled(6), debris({ p: variable('break'), dir: SPLINTER_DIRECTION, cone: 0.9, sp: [1, 3], size: [0.012, 0.012, 0.1], k: [0.6, 1.4], c: 0xb08a5a, life: 20 })),
        burst('normal', 8, { p: variable('break'), dir: [0, 0, 1], cone: 0.8, sp: [0.4, 1.4], drag: 2, life: [0.8, 1.4], size: [0.1, 0.18], grow: 3, c0: 0x7a6048, a: 0.4 }),
      ),
    ),
    after(
      4.2,
      set('fall', 0),
      set('falling', true),
      repeat(scaled(10), debris({ p: [add(SPOT[0], rnd(-1.4, 1.4)), 1, SPOT[2]], dir: SPLINTER_DIRECTION, cone: 0.9, sp: [1, 3], size: [0.012, 0.012, 0.1], c: 0xb08a5a, life: 20 })),
      cue('fence_rail_cracked'),
    ),
    after(4.8, repeat(BODIES.length, behavior('walkers', 'walk', { index: INDEX, to: [add(SPOT[0], pick(BODIES.map(([x]) => x), INDEX)), 0, SPOT[2] + 2.5], speed: 0.75 }))),
  ],
  tick: [
    when(variable('falling'), [
      set('fall', add(variable('fall'), DELTA)),
      set('progress', min(1, div(variable('fall'), FALL_SECONDS))),
      when(and(ge(variable('progress'), 1), not(variable('landed'))), [
        set('landed', true),
        screen({ add: { shake: 0.2 } }),
        burst('normal', 35, { p: [SPOT[0], 0.12, SPOT[2] + 0.8], box: [1.5, 0.05, 0.5], dir: UP, cone: 1.4, sp: [0.5, 1.6], drag: 1.8, life: [1.2, 2.2], size: [0.25, 0.45], grow: 3, c0: 0x6a5a48, a: 0.4 }),
      ]),
    ]),
  ],
}
