import { add, gt, TIME, variable } from '../dsl'
import { after, burst, cue, set, when } from '../steps'
import { normalized } from '../vector-math'
import type { EffectDef, EffectStep } from '../types'

const FACING = 0.5
/** The survivor's mouth and the way it breathes out, with the survivor at (-1.6, 0, 1.8) turned by `FACING` (W1236-1238). */
const MOUTH = [Math.sin(FACING) * 0.2 + -1.6, 1.68, Math.cos(FACING) * 0.2 + 1.8] as const
const BREATH = normalized([Math.sin(FACING), -0.15, Math.cos(FACING)])
const BREATH_EVERY = 2.4
const COUGH_EVERY = 6.5

/** A puff of breath (`puff`, W1239): `strength` scales how many and how fast. */
const puff = (strength: number): EffectStep =>
  burst('normal', 8 * strength, { p: MOUTH, dir: BREATH, cone: 0.35, sp: [0.5, 1.1 * strength], drag: 1.6, life: [1.2, 1.8], size: [0.05, 0.09], grow: 6, c0: 0xdfe6ee, a: 0.22, g: -0.1 })

/** W1234-1243 (`tosse`): a short breath every 2.4 s; in a cough, three quick bigger ones and a jolt of the body; the torch shows its beam in the fog. */
export const COUGH_AND_BREATH: EffectDef = {
  id: 'cough_and_breath',
  pageId: 'tosse',
  team: 'screen',
  budget: { particles: 40, lights: 1 },
  loop: 0,
  view: { eye: [2.4, 1.8, 6.5], target: [-1.4, 1.3, 1.6] },
  setup: [cue('zombie_visible', { index: -1, visible: false }), cue('survivor_pose', { x: -1.6, z: 1.8, turn: FACING }), cue('torch', { on: true })],
  timeline: [set('nextBreath', 0.5), set('nextCough', 3)],
  tick: [
    when(gt(TIME, variable('nextBreath')), [set('nextBreath', add(TIME, BREATH_EVERY)), puff(1)]),
    when(gt(TIME, variable('nextCough')), [
      set('nextCough', add(TIME, COUGH_EVERY)),
      ...[0, 0.25, 0.5].map((delay) => after(add(TIME, delay), puff(1.6), cue('survivor_jolt', { tilt: 0.25 }))),
    ]),
  ],
}
