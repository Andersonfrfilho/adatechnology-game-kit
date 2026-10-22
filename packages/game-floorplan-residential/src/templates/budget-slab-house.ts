import type { TemplateDef } from '@adatechnology/game-floorplan'
import { clamp, r2 } from '../util'
import { SMALL_LIVING } from './shared'

export const budgetSlabHouse: TemplateDef = {
  id: 'budget_slab_house', use: 'residential_single', partyWalls: ['right'], style: 'budget', limits: { w: [5, 7.2], d: [9.2, 10.4] }, defaults: { w: 6, d: 9.6 },
  lot: (w, d) => ({ frontSetback: 2.2, marginLeft: 0.8, marginRight: 0, backyardDepth: clamp(25 - 2.2 - d, 6, 16), pedestrian: { u: 1.0 }, doorTarget: { a: 'living', side: 'front' }, libraries: { backyard: 'backyard_slab' } }),
  facadeExtra: (f, rng, w, d) => {
    f.roof = 'slab'; f.finish = rng() < 0.55 ? 'exposed_block' : 'partial_plaster';
    f.slab = { exposedRebar: true, waterTank: { u: r2(0.5 + rng() * (w - 1.5)), v: r2(1 + rng() * (d - 2)) }, annex: rng() < 0.55 ? { rect: [0, 0, r2(w * (0.5 + rng() * 0.3)), r2(d * 0.4)], state: 'exposed_brick' } : null };
  },
  floors: [{
    label: 'ground_floor', ceiling: 2.6, openPairs: [['living', 'kitchen']],
    rooms: (w, d) => [
      { id: 'living', type: 'living', label: 'living', rect: [0, 0, w, 3.4], overrides: SMALL_LIVING },
      { id: 'kitchen', type: 'kitchen', library: 'kitchen_integrated', label: 'kitchen', rect: [0, 3.4, w, 6.4] },
      { id: 'bedroom', type: 'bedroom', label: 'bedroom', rect: [0, 6.4, w - 1.7, d] },
      { id: 'bathroom', type: 'bathroom', label: 'bathroom', library: 'bathroom_wc', rect: [w - 1.7, 6.4, w, d] },
    ],
    doors: (w, _d) => [
      { a: 'living', b: 'outside', side: 'front', at: 1.0, width: 0.9 }, { a: 'kitchen', b: 'outside', side: 'left', at: 4.9, width: 0.8 },
      { a: 'kitchen', b: 'bedroom', at: w - 2.4, width: 0.8, opensTo: 'bedroom' }, { a: 'kitchen', b: 'bathroom', at: w - 0.85, width: 0.7, opensTo: 'bathroom' },
    ],
    windows: (w, d) => [
      { room: 'living', side: 'front', at: w - 1.6, width: 1.2 },
      { room: 'bedroom', side: 'left', at: (6.4 + d) / 2, width: 1.2 }, { room: 'bedroom', side: 'back', at: (w - 1.7) / 2, width: 1.2 },
      { room: 'bathroom', side: 'back', at: w - 0.85, width: 0.5, y0: 1.7, y1: 2.15 },
    ],
  }],
}
