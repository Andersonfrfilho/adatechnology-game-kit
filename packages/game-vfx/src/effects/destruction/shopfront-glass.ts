import { rnd, scaled } from '../dsl'
import { after, behavior, burst, call, cue, debris, repeat, screen } from '../steps'
import type { EffectDef } from '../types'

const FACING = [0, 0, 1] as const

/** W846-855 (`vidro`): two cracks open in the shop window, then the whole pane comes down as 60 to 80 shards that stay on the pavement. */
export const SHOPFRONT_GLASS: EffectDef = {
  id: 'shopfront_glass',
  pageId: 'vidro',
  team: 'destruction',
  budget: { debris: 80, decals: 1 },
  loop: 5,
  view: { eye: [-2.4, 1.8, 1.2], target: [-5, 1.4, -4] },
  timeline: [
    after(0.3, call('impact', 'glass', [-5.4, 2.2, -4.45], FACING), behavior('cracks', 'crack', { x: 97, y: 59, big: false })),
    after(1, call('impact', 'glass', [-4.5, 1.6, -4.45], FACING), behavior('cracks', 'crack', { x: 177, y: 108, big: true })),
    after(
      1.8,
      cue('glass_pane_gone'),
      screen({ add: { shake: 0.08 } }),
      repeat(
        scaled(75),
        debris({ p: [-5, 1.9, -4.42], box: [1.25, 0.85, 0.02], v: [rnd(-0.4, 0.4), rnd(-0.5, 0.8), rnd(0.6, 2)], sp: 0, size: [rnd(0.05, 0.18), 0.006, rnd(0.05, 0.18)], c: 0xa8c8d8, spin: 14, life: 30, bounce: 0.15 }),
      ),
      burst('add', 30, { p: [-5, 1.9, -4.3], box: [1.2, 0.8, 0.05], size: [0.02, 0.05], life: [0.2, 0.6], c0: 0xffffff, a: 0.9, fi: 0.3 }),
      burst('normal', 20, { p: [-5, 1.3, -4.2], box: [1.2, 0.5, 0.1], sp: [0.2, 0.6], drag: 2, life: [0.8, 1.4], size: [0.12, 0.2], grow: 3, c0: 0xbfd6e2, a: 0.2 }),
    ),
  ],
}
