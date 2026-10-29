import { add, CAMERA_POSITION, clamp, DELTA, div, eq, INDEX, ite, lt, min, mod, mul, query, rnd, sub, TIME, variable, vdist } from '../dsl'
import { behavior, cue, post, repeat, screen, set, when } from '../steps'
import type { EffectDef } from '../types'

const WALKERS = 6
const NEAR = 9
const RANGE = 7
const RESTING_BPM = 70
const BPM_RISE = 80
const walkerPoint = [query('walkers', 'x', INDEX), 0, query('walkers', 'z', INDEX)]

/** W1206-1217 (`panico`): the aim trembles, the tunnel closes as the nearest zombie arrives and the heartbeat quickens from 70 to 150 bpm. */
export const PANIC: EffectDef = {
  id: 'panic',
  pageId: 'panico',
  team: 'screen',
  budget: {},
  loop: 8,
  view: { eye: [0, 1.65, 6], target: [0, 1.3, -2] },
  setup: [
    cue('zombie_visible', { index: -1, visible: false }),
    repeat(
      WALKERS,
      set('startX', rnd(-4, 4)),
      set('startZ', sub(rnd(-4, -2), mul(INDEX, 0.6))),
      behavior('walkers', 'place', { index: INDEX, x: variable('startX'), z: variable('startZ'), facing: 0 }),
      behavior('walkers', 'walk', { index: INDEX, to: [rnd(-1.2, 1.2), 0, 5], speed: ite(eq(mod(INDEX, 3), 1), 1.6, 0.7) }),
    ),
  ],
  timeline: [],
  tick: [
    set('nearest', 99),
    repeat(WALKERS, set('nearest', min(variable('nearest'), vdist(walkerPoint, CAMERA_POSITION)))),
    set('fear', clamp(div(sub(NEAR, variable('nearest')), RANGE), 0, 1)),
    set('bpm', add(RESTING_BPM, mul(BPM_RISE, variable('fear')))),
    when(lt(mod(div(mul(TIME, variable('bpm')), 60), 1), div(mul(DELTA, variable('bpm')), 60)), [screen({ set: { beat: add(0.4, mul(0.6, variable('fear'))) } })]),
    post({ tunnel: add(0.1, mul(0.65, variable('fear'))), desat: mul(0.45, variable('fear')) }),
    set('tremor', add(0.012, mul(0.035, variable('fear')))),
  ],
}
