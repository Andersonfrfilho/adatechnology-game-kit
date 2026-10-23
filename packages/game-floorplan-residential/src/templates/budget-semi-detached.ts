import type { TemplateDef } from '@adatechnology/game-floorplan'
import { clamp, r2 } from '../util'
import { SMALL_LIVING, SINGLE_BED_ONLY } from './shared'

const SMALL_WARDROBE = { wardrobe: { size: [1.1, 0.6], cats: { wardrobe_small: 1 }, clearance: 0.25, required: false, chance: 0.92 } }
const DOUBLE_BED_ONLY = { bed: { cats: { '=double_bed': 1 }, pos: 0, clearance: 0.05 } }

export const budgetSemiDetached: TemplateDef = {
  id: 'budget_semi_detached', use: 'residential_single', partyWalls: ['left'], style: 'budget', limits: { w: [5, 6], d: [11.5, 13] }, defaults: { w: 5.6, d: 12.2 },
  lot: (w, d) => ({ frontSetback: 5.2, marginLeft: 0, marginRight: 1.2, backyardDepth: clamp(25 - 5.2 - d, 5, 14), parking: { width: 3.4 }, garage: { u: 1.7, width: 3.0, to: 'parking' }, pedestrian: { u: w - 1.0 }, doorTarget: { a: 'living', side: 'front' }, libraries: { backyard: 'backyard_slab' } }),
  facadeExtra: (f, _rng) => { f.semiDetached = 'left'; f.partyWall = 'left'; },
  floors: [{
    label: 'ground_floor', ceiling: 2.7, openPairs: [['living', 'kitchen']],
    rooms: (w, d) => { const hw = r2(w / 2); return [
      { id: 'living', type: 'living', label: 'living', rect: [0, 0, w, 4.4], overrides: SMALL_LIVING },
      { id: 'kitchen', type: 'kitchen', library: 'kitchen_integrated', label: 'kitchen', rect: [0, 4.4, w - 1.6, 7.0] },
      { id: 'bathroom', type: 'bathroom', label: 'bathroom', library: 'bathroom_wc', rect: [w - 1.6, 4.4, w, 7.0] },
      { id: 'corridor', type: 'corridor', label: 'corridor', rect: [0, 7.0, w, 8.2] },
      { id: 'bedroom_1', type: 'bedroom', label: 'bedroom_1', rect: [0, 8.2, hw, d], overrides: Object.assign({}, SMALL_WARDROBE, DOUBLE_BED_ONLY) },
      { id: 'bedroom_2', type: 'bedroom', label: 'bedroom_2', rect: [hw, 8.2, w, d], overrides: Object.assign({}, SINGLE_BED_ONLY, SMALL_WARDROBE) },
    ]; },
    doors: (w, _d) => { const hw = r2(w / 2); return [
      { a: 'living', b: 'outside', side: 'front', at: w - 1.0, width: 0.9 }, { a: 'corridor', b: 'outside', side: 'right', at: 7.6, width: 0.8 },
      { a: 'kitchen', b: 'corridor', at: 2.8, width: 0.8, opensTo: 'corridor' }, { a: 'bathroom', b: 'corridor', at: w - 0.8, width: 0.7, opensTo: 'bathroom' },
      { a: 'corridor', b: 'bedroom_1', at: hw / 2, width: 0.75, opensTo: 'bedroom_1' }, { a: 'corridor', b: 'bedroom_2', at: hw + hw / 2, width: 0.75, opensTo: 'bedroom_2' },
    ]; },
    windows: (w, d) => { const hw = r2(w / 2); return [
      { room: 'living', side: 'front', at: 1.5, width: 1.2 }, { room: 'bathroom', side: 'right', at: 4.9, width: 0.5, y0: 1.7, y1: 2.15 },
      { room: 'bedroom_1', side: 'back', at: hw / 2, width: 1.0 }, { room: 'bedroom_2', side: 'back', at: hw + hw / 2, width: 1.0 }, { room: 'bedroom_2', side: 'right', at: (8.2 + d) / 2, width: 1.0 },
    ]; },
  }],
}
