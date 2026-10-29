import { add, concat, eq, INDEX, pick, TIME, vadd } from '../dsl'
import { call, cue, fireLight, repeat, when } from '../steps'
import { normalized } from '../vector-math'
import type { EffectDef } from '../types'

/** The two burning windows of the shop front (W73). */
const WINDOWS = [[4.6, 5, -4.48], [-1.6, 5, -4.48]]

/** W1054-1068 (`incendio`): fire out of the top of each window, licking up the facade, embers and smoke carried by the wind, and a light that paints the street. */
export const BUILDING_FIRE: EffectDef = {
  id: 'building_fire',
  pageId: 'incendio',
  team: 'world',
  budget: { particles: 600, lights: 2 },
  loop: 0,
  view: { eye: [3, 2.4, 6.5], target: [1.5, 4, -4] },
  setup: [cue('zombie_visible', { index: -1, visible: false })],
  timeline: [],
  tick: [
    repeat(
      WINDOWS.length,
      call('fire_emit', concat('w', INDEX), vadd(pick(WINDOWS, INDEX), [0, 0.55, 0.12]), 0.55, 1.1, { dir: normalized([0, 1, 0.35]), wind: [0.9, 0, 0], smoke: 22, smokeAlpha: 0.5 }),
      when(eq(INDEX, 0), [fireLight(0, vadd(pick(WINDOWS, INDEX), [0, 0, 1.4]), 3, add(TIME, INDEX))], [fireLight(1, vadd(pick(WINDOWS, INDEX), [0, 0, 1.4]), 3, add(TIME, INDEX))]),
    ),
  ],
}
