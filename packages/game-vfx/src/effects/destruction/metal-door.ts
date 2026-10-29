import { add, and, DELTA, div, floor, ge, INDEX, ite, min, mod, mul, not, pick, scaled, variable } from '../dsl'
import { after, behavior, burst, call, cue, debris, repeat, screen, set, when } from '../steps'
import { normalized } from '../vector-math'
import type { EffectDef } from '../types'
import { SPOT, UP } from './spot'

const HITS = [[0.4, 1.4], [0.75, 1.0], [0.3, 0.7], [0.6, 1.7], [0.5, 1.2]]
const HIT_X = HITS.map(([x]) => x)
const HIT_Y = HITS.map(([, y]) => y)
const SPARK_DIRECTION = normalized([0, 0.3, 1])
const CHIP_DIRECTION = normalized([0, 0.2, 1])
const HINGE_DIRECTION = normalized([1, 0.3, 1])
const SCRAPE_DIRECTION = normalized([0, 0.4, 1])
const FALL_SECONDS = 0.45
const SCRAPES = 5

/** W960-985 (`portametal`): each blow dents the plate where it lands and throws sparks, paint chips and rust; the top hinge bursts and the door scrapes down. */
export const METAL_DOOR_EFFECT: EffectDef = {
  id: 'metal_door',
  pageId: 'portametal',
  team: 'destruction',
  budget: { particles: 160, debris: 20 },
  loop: 7.5,
  view: { eye: [0.6, 1.6, 6.2], target: [-2.2, 1.1, 2.6] },
  props: ['plate'],
  setup: [
    cue('zombie_visible', { index: -1, visible: false }),
    cue('work_light', { intensity: 2.2 }),
    behavior('walkers', 'place', { index: 3, x: SPOT[0] + 0.1, z: SPOT[2] - 0.7, facing: 0 }),
  ],
  timeline: [
    repeat(
      HITS.length,
      after(
        add(0.5, mul(INDEX, 0.75)),
        cue('zombie_swing', { index: 3, side: mod(INDEX, 2) }),
        after(
          add(0.5, mul(INDEX, 0.75), 0.15),
          behavior('plate', 'dent', { x: pick(HIT_X, INDEX), y: pick(HIT_Y, INDEX), radius: 0.42, depth: add(0.09, mul(INDEX, 0.025)) }),
          set('spot', [add(SPOT[0] - 0.56, pick(HIT_X, INDEX)), pick(HIT_Y, INDEX), SPOT[2] + 0.06]),
          call('spark_at', variable('spot'), SPARK_DIRECTION, 8),
          repeat(scaled(5), debris({ p: variable('spot'), dir: CHIP_DIRECTION, cone: 0.9, sp: [0.8, 2.2], size: [0.035, 0.004, 0.03], k: [0.6, 1.4], c: ite(mod(INDEX, 2), 0x51625a, 0x8a8f86), life: 20, spin: 16 })),
          call('rust_at', variable('spot'), 6),
          cue('door_dent', { level: min(3, add(1, floor(div(INDEX, 1.7)))) }),
        ),
      ),
    ),
    after(4.4, call('spark_at', [SPOT[0] - 0.6, 2.05, SPOT[2] + 0.05], HINGE_DIRECTION, 30, 1.2), screen({ add: { shake: 0.15 } }), set('fall', 0), set('falling', true), cue('door_hinge_burst')),
    after(5.2, behavior('walkers', 'walk', { index: 3, to: [SPOT[0], 0, SPOT[2] + 2.4], speed: 0.8 })),
  ],
  tick: [
    when(variable('falling'), [
      set('fall', add(variable('fall'), DELTA)),
      set('progress', min(1, div(variable('fall'), FALL_SECONDS))),
      when(and(ge(variable('progress'), 1), not(variable('landed'))), [
        set('landed', true),
        screen({ add: { shake: 0.3 } }),
        repeat(SCRAPES, call('spark_at', [add(SPOT[0] - 0.5, mul(INDEX, 0.27)), 0.03, SPOT[2] + 2.1], SCRAPE_DIRECTION, 8, 1)),
        burst('normal', 40, { p: [SPOT[0], 0.15, SPOT[2] + 1.2], box: [0.6, 0.05, 1], dir: UP, cone: 1.4, sp: [0.6, 2], drag: 1.8, life: [1.4, 2.4], size: [0.25, 0.5], grow: 3, c0: 0x6a645a, a: 0.45 }),
      ]),
    ]),
  ],
}
