import type { TemplateDef } from '@adatechnology/game-floorplan'

export const singleStoreyA: TemplateDef = {
  id: 'single_storey_a', use: 'residential_single', style: 'budget', limits: { w: [8, 14], d: [10, 14] }, defaults: { w: 11, d: 11 },
  lot: (w, _d) => ({ frontSetback: 6, marginLeft: 1.2, marginRight: 1.2, backyardDepth: 5.5, parking: { width: 3.4 }, garage: { u: -1.2 + 1.7, width: 3.0, to: 'parking' }, pedestrian: { u: w - 0.9 }, doorTarget: { a: 'living', side: 'front' } }),
  floors: [{
    label: 'ground_floor', ceiling: 2.8,
    rooms: (w, d) => { const uc = 3.4, ub = w - 1.9, vb = 7.2; return [
      { id: 'living', type: 'living', label: 'living', rect: [0, 0, w, 5] },
      { id: 'kitchen', type: 'kitchen', label: 'kitchen', rect: [0, 5, uc, d] },
      { id: 'bedroom', type: 'bedroom', label: 'bedroom', rect: [uc, vb, w, d], parts: [[uc, 5, ub, vb]] },
      { id: 'bathroom', type: 'bathroom', label: 'bathroom', rect: [ub, 5, w, vb], overrides: { washbasin: { side: 'back', pos: 0 } } },
    ]; },
    doors: (w, _d) => [
      { a: 'living', b: 'outside', side: 'front', at: w / 2, width: 1.0 },
      { a: 'kitchen', b: 'outside', side: 'back', at: 0.95, width: 0.9 },
      { a: 'living', b: 'kitchen', at: Math.min(w * 0.3, 2.3), width: 0.9, opensTo: 'kitchen' },
      { a: 'kitchen', b: 'bedroom', at: 5.9, width: 0.85, opensTo: 'bedroom' },
      { a: 'living', b: 'bathroom', at: w - 1.45, width: 0.7, opensTo: 'bathroom', clearance: 0.12 },
    ],
    windows: (w, _d) => [
      { room: 'living', side: 'front', at: 1.35, width: 1.2 }, { room: 'living', side: 'front', at: w - 1.35, width: 1.2 },
      { room: 'kitchen', side: 'back', at: 2.4, width: 1.0, y0: 1.1, y1: 2.1 }, { room: 'bedroom', side: 'back', at: 3.4 + (w - 3.4) / 2, width: 1.4, y0: 1.2, y1: 2.2 },
      { room: 'living', side: 'left', at: 2.5, width: 1.2 }, { room: 'kitchen', side: 'left', at: 7.6, width: 1.0, y0: 1.1, y1: 2.1 },
      { room: 'bathroom', side: 'right', at: 6.1, width: 0.6, y0: 1.6, y1: 2.15 },
    ],
  }],
}
