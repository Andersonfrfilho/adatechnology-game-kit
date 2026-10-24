import { add, CAMERA_POSITION, cameraForward, DELTA, eq, gt, INDEX, lt, max, mod, mul, PARAM, rand, rnd, sin, TIME, variable, vadd } from '../dsl'
import { burst, cue, post, repeat, screen, set, when } from '../steps'
import type { EffectDef } from '../types'

const MALAISE = 0
const FEVER = 1
const DELIRIUM = 2
const LAST_HOURS = 3
const GHOSTS = [[-3, -1.8], [3.5, -2.4], [-6, 1.5]]

/** W1186-1205 (`infeccao`): malaise (washed colour, a breathing vignette), fever (cold edge, waves of blur, a cough that shakes the camera), delirium, the last hours. */
export const INFECTION_PHASES: EffectDef = {
  id: 'infection_phases',
  pageId: 'infeccao',
  team: 'screen',
  params: { id: 'phase', options: ['malaise', 'fever', 'delirium', 'last_hours'], default: 1 },
  budget: { particles: 10 },
  loop: 0,
  view: { eye: [2, 1.7, 7], target: [0, 1.2, -1] },
  setup: [
    cue('zombie_visible', { index: -1, visible: false }),
    ...GHOSTS.map(([x, z], index) => cue('ghost_place', { index, x, z, turn: rnd(-0.4, 0.4) })),
  ],
  timeline: [set('nextCough', 2)],
  tick: [
    when(eq(PARAM, MALAISE), [post({ desat: 0.25, tunnel: add(0.15, mul(0.12, sin(mul(TIME, 1.2)))), blur: mul(0.3, max(0, sin(mul(TIME, 0.7)))) })]),
    when(eq(PARAM, FEVER), [
      post({ cold: add(0.8, mul(0.15, sin(mul(TIME, 2)))), blur: add(0.6, mul(0.6, sin(mul(TIME, 1.6)))), desat: 0.3 }),
      when(gt(TIME, variable('nextCough')), [
        set('nextCough', add(TIME, rnd(3, 5))),
        screen({ add: { shake: 0.25 } }),
        burst('normal', 10, { p: vadd(CAMERA_POSITION, cameraForward([0, -0.15, -0.6])), dir: cameraForward([0, 0, -1]), cone: 0.4, sp: [0.6, 1.2], drag: 1.5, life: 1.2, size: [0.05, 0.1], grow: 5, c0: 0xdfe6ee, a: 0.2 }),
      ]),
    ]),
    when(eq(PARAM, DELIRIUM), [
      post({ chroma: add(2, mul(3, add(0.5, mul(0.5, sin(mul(TIME, 1.7)))))), hue: mul(22, sin(mul(TIME, 0.6))), tunnel: 0.3, desat: 0.15 }),
      repeat(GHOSTS.length, cue('ghost_visible', { index: INDEX, visible: gt(sin(add(mul(TIME, add(1.3, mul(INDEX, 0.7))), mul(INDEX, 2))), 0.6) })),
      when(lt(rand(), mul(DELTA, 0.3)), [screen({ set: { white: 0.12 } })]),
    ]),
    when(eq(PARAM, LAST_HOURS), [
      post({ desat: 0.85, tintAlpha: 0.22, tintColor: '70,110,40', tunnel: 0.55, blur: 1.2 }),
      when(lt(mod(mul(TIME, 2.2), 1), mul(DELTA, 2.2)), [screen({ set: { beat: 1 }, add: { shake: 0.05 } })]),
    ]),
  ],
}
