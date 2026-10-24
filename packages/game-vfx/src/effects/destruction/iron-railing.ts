import { add, and, DELTA, div, ge, gt, INDEX, lt, min, mul, not, pick, rnd, sub, TIME, variable } from '../dsl'
import { after, behavior, burst, call, cue, emit, repeat, screen, set, when } from '../steps'
import { normalized } from '../vector-math'
import type { EffectDef } from '../types'
import { SPOT, UP } from './spot'

/** Where the four pushing bodies stand, relative to the railing (W987). */
const PUSHERS = [[-0.6, 0.45], [0.1, 0.5], [0.6, 0.42], [-0.1, 1]]
const BEND_LIMIT = 0.42
const BEND_STEP = 0.004
const FALL_SECONDS = 0.55
const WELD = normalized([0, 0.3, 1])

/** W986-1003 (`grade`): the horde pushes, the bars bend and rust falls in a thread; the weld bursts in sparks twice and the railing topples. */
export const IRON_RAILING: EffectDef = {
  id: 'iron_railing',
  pageId: 'grade',
  team: 'destruction',
  budget: { particles: 200 },
  loop: 7.5,
  view: { eye: [1.4, 1.8, 6.4], target: [-2.2, 0.7, 2.4] },
  setup: [
    cue('zombie_visible', { index: -1, visible: false }),
    cue('work_light', { intensity: 2.2 }),
    set('bend', 0),
    ...PUSHERS.map(([x, dz], index) => behavior('walkers', 'place', { index, x: SPOT[0] + x!, z: SPOT[2] - dz!, facing: 0 })),
  ],
  timeline: [
    after(1.6, call('spark_at', [SPOT[0], 0.75, SPOT[2] + 0.05], WELD, 20, 1), screen({ add: { shake: 0.08 } }), cue('weld_burst')),
    after(3.2, call('spark_at', [SPOT[0] + 0.02, 1.2, SPOT[2] + 0.1], WELD, 20, 1), screen({ add: { shake: 0.1 } })),
    after(
      4.3,
      set('fall', 0),
      set('falling', true),
      call('spark_at', [SPOT[0] - 1.5, 0.25, SPOT[2]], normalized([-0.3, 0.5, 1]), 14, 1),
      call('spark_at', [SPOT[0] + 1.5, 0.25, SPOT[2]], normalized([0.3, 0.5, 1]), 14, 1),
      cue('railing_gave_way'),
    ),
    after(
      4.9,
      repeat(PUSHERS.length, behavior('walkers', 'walk', { index: INDEX, to: [add(SPOT[0], pick(PUSHERS.map(([x]) => x), INDEX)), 0, add(SPOT[2], 2.6, mul(INDEX, 0.3))], speed: 0.7 })),
    ),
  ],
  tick: [
    when(lt(TIME, 4.3), [
      set('target', min(BEND_LIMIT, mul(TIME, 0.1))),
      when(gt(sub(variable('target'), variable('bend')), BEND_STEP), [set('bend', variable('target')), cue('railing_bend', { amount: variable('bend') })]),
      emit('rust', 'normal', 10, { p: [add(SPOT[0], rnd(-0.6, 0.6)), rnd(0.3, 1.2), add(SPOT[2], mul(variable('bend'), 0.8))], sp: [0, 0.2], life: [0.8, 1.2], size: [0.015, 0.03], c0: 0x7a4a2a, a: 0.9, g: 6, fi: 0, gnd: 1 }),
    ]),
    when(variable('falling'), [
      set('fall', add(variable('fall'), DELTA)),
      set('progress', min(1, div(variable('fall'), FALL_SECONDS))),
      when(and(ge(variable('progress'), 1), not(variable('landed'))), [
        set('landed', true),
        screen({ add: { shake: 0.25 } }),
        repeat(4, call('spark_at', [add(SPOT[0] - 1.2, mul(INDEX, 0.8)), 0.04, SPOT[2] + 1.2], normalized([0, 0.5, 1]), 6, 1)),
        burst('normal', 30, { p: [SPOT[0], 0.12, SPOT[2] + 0.8], box: [1.4, 0.05, 0.5], dir: UP, cone: 1.4, sp: [0.5, 1.6], drag: 1.8, life: [1.2, 2.2], size: [0.2, 0.4], grow: 3, c0: 0x6a645a, a: 0.4 }),
      ]),
    ]),
  ],
}
