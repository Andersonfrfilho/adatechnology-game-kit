import { rnd } from '../dsl'
import { after, burst, cue, lens, repeat, screen } from '../steps'
import type { EffectDef } from '../types'

/** W1218-1226 (`cegueira`): a green cloud bursts between the bloater and the camera, the screen goes green and blurred and clears in 5 s; two coughs shake the camera. */
export const BLOATER_BLINDNESS: EffectDef = {
  id: 'bloater_blindness',
  pageId: 'cegueira',
  team: 'screen',
  budget: { particles: 30 },
  loop: 7.5,
  view: { eye: [0, 1.6, 2.6], target: [0, 1.3, 0] },
  setup: [cue('bloater_pose', { eyes: 0x5fe08a, skin: 0x6b7a52, belly: [1.4, 1.25, 1.6] })],
  timeline: [
    after(
      0.7,
      cue('zombie_visible', { index: -1, visible: false }),
      screen({ set: { gas: 1 }, add: { shake: 0.3 } }),
      burst('normal', 30, { p: [0, 1.3, 0.8], r: 0.6, sp: [0.5, 2], drag: 2, life: [3, 5], size: [0.8, 1.6], grow: 1.6, c0: 0x6f8a3c, c1: 0x3b4a26, a: 0.3, fi: 0.05 }),
      repeat(8, lens(rnd(0.15, 0.85), rnd(0.15, 0.7), rnd(0.03, 0.08), '110,150,50', 0.9)),
    ),
    after(2, screen({ add: { shake: 0.2 } })),
    after(3.4, screen({ add: { shake: 0.2 } })),
  ],
}
