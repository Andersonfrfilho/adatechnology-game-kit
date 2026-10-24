import { and, INDEX, ite, lt, not, pick, query, QUALITY, rnd, variable } from '../dsl'
import { behavior, repeat, set, spawn, when } from '../steps'
import type { EffectDef } from '../types'

/** Which of the ten walkers run: the ones with red eyes (W192). */
const RUNNERS = [false, true, false, false, false, true, false, false, false, true]
const RUN_SPEED = 3.8
const WALK_SPEED = 0.7
const SPEED = ite(pick(RUNNERS, INDEX), RUN_SPEED, WALK_SPEED)
const walkTo = behavior('walkers', 'walk', { index: INDEX, to: [-12, 0, query('walkers', 'z', INDEX)], speed: SPEED })

/** W562-571 (the page's `olhos`): ten zombies walk through fog from the east; the runners leave a short red trail behind their eyes. */
export const EYES_IN_FOG: EffectDef = {
  id: 'eyes_in_fog',
  pageId: 'olhos',
  team: 'creatures',
  budget: { particles: 20 },
  loop: 0,
  view: { eye: [-9, 1.7, 2], target: [6, 1.3, 2] },
  setup: [
    repeat(10, set('placeX', rnd(4, 34)), set('placeZ', rnd(-1.5, 5.5)), behavior('walkers', 'place', { index: INDEX, x: variable('placeX'), z: variable('placeZ'), facing: -Math.PI / 2 }), walkTo),
  ],
  timeline: [],
  tick: [
    repeat(
      10,
      when(lt(query('walkers', 'x', INDEX), -8), [behavior('walkers', 'move_x', { index: INDEX, x: rnd(28, 36) }), walkTo], [when(not(query('walkers', 'is_walking', INDEX)), [walkTo])]),
      when(and(pick(RUNNERS, INDEX), lt(QUALITY, 2)), [
        spawn('streak', { p: query('walkers', 'point', INDEX, [0, 1.74, 0.2]), dir: [1, 0, 0], cone: 0, sp: RUN_SPEED, v: [-RUN_SPEED, 0, 0], life: 0.25, len: 0.06, c0: 0xe5392b, c1: 0x400000, a: 0.8 }),
      ]),
    ),
  ],
}
