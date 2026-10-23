import type { TemplateDef } from '@adatechnology/game-floorplan'
import { clamp, r2 } from '../util'

export const midModernSingleStorey: TemplateDef = {
  id: 'mid_modern_single_storey', use: 'residential_single', style: 'mid', limits: { w: [10, 13], d: [12.8, 14.5] }, defaults: { w: 11, d: 13.2 },
  lot: (w, d) => ({ frontSetback: 5.5, marginLeft: 1.0, marginRight: 1.0, backyardDepth: clamp(30 - 5.5 - d, 8, 18), parking: { width: 3.4 }, garage: { u: -1 + 1.7, width: 3.0, to: 'parking' }, pedestrian: { u: w - 0.9 }, doorTarget: { a: 'living', side: 'front' }, libraries: { garden: 'garden_mid', backyard: 'backyard_mid' } }),
  facadeExtra: (f) => { f.veranda = true; f.modern = true; },
  floors: [{
    label: 'ground_floor', ceiling: 2.8, openPairs: [['living', 'kitchen']],
    rooms: (w, d) => { const cw = r2(w * 0.46), c2 = cw + 1.2; return [
      { id: 'living', type: 'living', label: 'living', rect: [0, 0, w, 4.8] },
      { id: 'kitchen', type: 'kitchen', library: 'kitchen_integrated', label: 'kitchen', rect: [0, 4.8, cw, 7.8] },
      { id: 'laundry', type: 'laundry', label: 'laundry', rect: [0, 7.8, cw, 9.8] },
      { id: 'bedroom_1', type: 'bedroom', label: 'bedroom_1', rect: [0, 9.8, cw, d] },
      { id: 'corridor', type: 'corridor', label: 'corridor', rect: [cw, 4.8, c2, d] },
      { id: 'bedroom_2', type: 'bedroom', label: 'bedroom_2', rect: [c2, 4.8, w, 8.0] },
      { id: 'bathroom', type: 'bathroom', label: 'bathroom_guest', library: 'bathroom_wc', rect: [c2, 8.0, c2 + 2.0, 10.0] },
      { id: 'bathroom_suite', type: 'bathroom', label: 'bathroom_suite', library: 'bathroom_wc', rect: [c2 + 2.0, 8.0, w, 10.0] },
      { id: 'suite', type: 'bedroom', label: 'suite', rect: [c2, 10.0, w, d] },
    ]; },
    doors: (w, _d) => { const cw = r2(w * 0.46), _c2 = cw + 1.2; return [
      { a: 'living', b: 'outside', side: 'front', at: w - 0.9, width: 1.0 }, { a: 'living', b: 'corridor', at: cw + 0.6, width: 0.9, opensTo: 'corridor' },
      { a: 'corridor', b: 'kitchen', at: 6.4, width: 0.8, opensTo: 'kitchen' }, { a: 'corridor', b: 'laundry', at: 8.8, width: 0.8, opensTo: 'laundry' },
      { a: 'laundry', b: 'outside', side: 'left', at: 8.8, width: 0.8 }, { a: 'corridor', b: 'bedroom_1', at: 11.4, width: 0.8, opensTo: 'bedroom_1' },
      { a: 'corridor', b: 'bedroom_2', at: 6.4, width: 0.8, opensTo: 'bedroom_2' }, { a: 'corridor', b: 'bathroom', at: 9.0, width: 0.75, opensTo: 'bathroom' },
      { a: 'corridor', b: 'suite', at: 11.6, width: 0.85, opensTo: 'suite' }, { a: 'suite', b: 'bathroom_suite', width: 0.75, opensTo: 'bathroom_suite' },
      { a: 'corridor', b: 'outside', side: 'back', at: cw + 0.6, width: 0.85 },
    ]; },
    windows: (w, d) => { const cw = r2(w * 0.46), c2 = cw + 1.2; return [
      { room: 'living', side: 'front', at: 1.6, width: 1.6 }, { room: 'living', side: 'front', at: w * 0.5, width: 1.6 }, { room: 'living', side: 'left', at: 2.4, width: 1.4 }, { room: 'living', side: 'right', at: 2.4, width: 1.4 },
      { room: 'kitchen', side: 'left', at: 6.2, width: 1.0, y0: 1.1, y1: 2.1 }, { room: 'bedroom_1', side: 'left', at: (9.8 + d) / 2, width: 1.2 }, { room: 'bedroom_1', side: 'back', at: cw / 2, width: 1.2 },
      { room: 'bedroom_2', side: 'right', at: 6.4, width: 1.4 }, { room: 'bathroom_suite', side: 'right', at: 9.0, width: 0.6, y0: 1.5, y1: 2.1 },
      { room: 'suite', side: 'right', at: (10 + d) / 2, width: 1.4 }, { room: 'suite', side: 'back', at: (c2 + w) / 2, width: 1.4 },
    ]; },
  }],
}
