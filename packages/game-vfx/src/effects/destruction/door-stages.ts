import { add, and, div, DELTA, ge, INDEX, min, mul, not, rnd, scaled, sub, variable } from '../dsl'
import { after, behavior, burst, cue, debris, repeat, screen, set, when } from '../steps'
import { normalized } from '../vector-math'
import type { EffectDef, EffectStep } from '../types'

const FRAME_DUST = normalized([0, -0.3, 1])
const SPLINTER_DIRECTION = normalized([0, 0.3, 1])
const FALL_SECONDS = 0.4

/** One blow on the door (`hit`, W779): the frame sheds dust and splinters; a heavy blow sheds twice as much. */
const blow = (heavy: boolean): EffectStep[] => [
  cue('door_shake', { strength: 0.25 }),
  burst('normal', heavy ? 24 : 12, { p: [2, 2.3, -4.38], box: [0.6, 0.05, 0.02], dir: FRAME_DUST, cone: 0.6, sp: [0.2, 0.8], drag: 1.5, life: [0.8, 1.4], size: [0.08, 0.16], grow: 3, c0: 0x7a7366, a: 0.45, g: 0.4 }),
  repeat(scaled(heavy ? 5 : 2), debris({ p: [add(2, rnd(-0.5, 0.5)), rnd(0.4, 2), -4.36], dir: SPLINTER_DIRECTION, cone: 0.6, sp: [1, 2.5], size: [0.015, 0.015, 0.1], c: 0x7a5530, life: 12 })),
]

/** W856-871 (`porta`): blows loosen dust from the frame, a plank cracks at 66 %, falls at 33 % and the door drops at the third stage. */
export const DOOR_STAGES: EffectDef = {
  id: 'door_stages',
  pageId: 'porta',
  team: 'destruction',
  budget: { particles: 120, debris: 6 },
  loop: 7.5,
  view: { eye: [4.2, 1.7, 1.4], target: [2, 1.1, -4] },
  setup: [behavior('walkers', 'place', { index: 0, x: 2, z: -5.4, facing: 0 })],
  timeline: [
    after(0.5, ...blow(false)),
    after(1.2, ...blow(false)),
    after(1.9, ...blow(true), cue('door_plank_crack', { stage: 1 })),
    after(2.7, ...blow(false)),
    after(
      3.3,
      ...blow(true),
      cue('door_plank_fall', { stage: 2 }),
      repeat(3, debris({ p: [add(2, mul(sub(INDEX, 1), 0.4)), 1.1, -4.3], v: [rnd(-0.3, 0.3), 0.5, 1.2], sp: 0, size: [0.38, 0.68, 0.07], c: 0x5a3c22, spin: 4, life: 20, bounce: 0.15 })),
    ),
    after(4.4, set('fall', 0), set('falling', true), cue('door_fall', { stage: 3 })),
    after(4.6, behavior('walkers', 'walk', { index: 0, to: [2, 0, -2.2], speed: 0.9 })),
  ],
  tick: [
    when(variable('falling'), [
      set('fall', add(variable('fall'), DELTA)),
      set('progress', min(1, div(variable('fall'), FALL_SECONDS))),
      when(and(ge(variable('progress'), 1), not(variable('landed'))), [
        set('landed', true),
        screen({ add: { shake: 0.2 } }),
        burst('normal', 45, { p: [2, 0.15, -3.4], box: [0.7, 0.05, 1], dir: [0, 1, 0], cone: 1.4, sp: [0.6, 2], drag: 1.8, life: [1.5, 2.8], size: [0.25, 0.5], grow: 3, c0: 0x6a645a, a: 0.45 }),
      ]),
    ]),
  ],
}
