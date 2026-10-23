import type { TemplateDef } from '@adatechnology/game-floorplan'
import { r2 } from '../util'

export const apartmentBasic: TemplateDef = {
  id: 'apartment_basic', use: 'residential_multi', style: 'budget', lot: null, limits: { w: [8, 11], d: [11.5, 14] }, defaults: { w: 9, d: 12 }, singleFloor: true,
  floors: [{
    label: 'floor', ceiling: 2.8,
    rooms: (w, d) => { const vs = 4.6, ac = r2(w * 0.4), qd = r2((d - vs) / 2); return [
      { id: 'living', type: 'living', label: 'living', rect: [0, 0, w, vs], overrides: { tv_unit_back: null, tv_back: null, sofa_back: null, table_back: null, rug_back: null } },
      { id: 'kitchen', type: 'kitchen', label: 'kitchen', rect: [0, vs, ac, vs + 2.9] },
      { id: 'laundry', type: 'laundry', label: 'laundry', rect: [0, vs + 2.9, ac, vs + 4.7] },
      { id: 'bathroom', type: 'bathroom', label: 'bathroom', library: 'bathroom_wc', rect: [0, vs + 4.7, ac, d] },
      { id: 'corridor', type: 'corridor', label: 'corridor', rect: [ac, vs, ac + 1.2, d] },
      { id: 'bedroom_1', type: 'bedroom', label: 'bedroom_1', rect: [ac + 1.2, vs, w, vs + qd] },
      { id: 'bedroom_2', type: 'bedroom', label: 'bedroom_2', rect: [ac + 1.2, vs + qd, w, d] },
    ]; },
    doors: (w, _d) => { const ac = r2(w * 0.4); return [
      { a: 'living', b: 'outside', side: 'front', at: w - 1.1, width: 0.95 },
      { a: 'living', b: 'kitchen', at: ac / 2, width: 0.9, opensTo: 'kitchen' }, { a: 'living', b: 'corridor', at: ac + 0.6, width: 0.9, opensTo: 'corridor' },
      { a: 'corridor', b: 'laundry', width: 0.8, opensTo: 'laundry' }, { a: 'corridor', b: 'bathroom', width: 0.75, opensTo: 'bathroom' },
      { a: 'corridor', b: 'bedroom_1', width: 0.85, opensTo: 'bedroom_1' }, { a: 'corridor', b: 'bedroom_2', width: 0.85, opensTo: 'bedroom_2' },
    ]; },
    windows: (w, d) => [
      { room: 'living', side: 'left', at: 2.3, width: 1.6 }, { room: 'living', side: 'right', at: 2.3, width: 1.6 },
      { room: 'kitchen', side: 'left', at: 6.0, width: 1.0, y0: 1.1, y1: 2.1 }, { room: 'laundry', side: 'left', at: 8.0, width: 0.6, y0: 1.3, y1: 2.1 },
      { room: 'bathroom', side: 'left', at: d - 1.3, width: 0.6, y0: 1.5, y1: 2.1 },
      { room: 'bedroom_1', side: 'right', at: 7.0, width: 1.4 }, { room: 'bedroom_2', side: 'right', at: d - 1.6, width: 1.2 }, { room: 'bedroom_2', side: 'back', at: w - 2.3, width: 1.2 },
    ],
  }],
}
