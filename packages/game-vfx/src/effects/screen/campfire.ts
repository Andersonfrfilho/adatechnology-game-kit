import { TIME } from '../dsl'
import { call, cue, fireLight } from '../steps'
import type { EffectDef } from '../types'

const FIRE = [-1.4, 0.1, 3.0] as const

/** W1227-1233 (`fogueira`): a low flame, embers that spiral up, thin smoke and a warm light that trembles and paints the survivor. */
export const CAMPFIRE: EffectDef = {
  id: 'campfire',
  pageId: 'fogueira',
  team: 'screen',
  budget: { particles: 120, lights: 1 },
  loop: 0,
  view: { eye: [1.4, 1.6, 6.4], target: [-1.4, 0.6, 3] },
  setup: [cue('zombie_visible', { index: -1, visible: false }), cue('survivor_pose', { x: -2.6, z: 3.6, turn: 2.2 })],
  timeline: [],
  tick: [
    call('fire_emit', 'camp', FIRE, 0.25, 0.55, { smoke: 8, smokeColor: 0x4a4642, smokeAlpha: 0.25 }),
    fireLight(0, [FIRE[0], FIRE[1] + 0.8, FIRE[2]], 2.4, TIME),
  ],
}
