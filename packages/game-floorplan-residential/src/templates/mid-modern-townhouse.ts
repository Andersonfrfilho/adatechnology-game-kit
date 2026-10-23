import type { FloorDef, TemplateDef } from '@adatechnology/game-floorplan'
import { clamp, r2 } from '../util'

const MID_TOWNHOUSE_FLOORS: FloorDef[] = [
  {
    label: 'ground_floor', ceiling: 2.8, openPairs: [['living', 'dining']],
    rooms: (w, d, _op) => [
      { id: 'living', type: 'living', label: 'sitting_room', rect: [0, 0, w, 4.8] },
      { id: 'dining', type: 'dining', label: 'dining', rect: [0, 4.8, w - 2.4, 8.2], overrides: { dining_table: { size: [2.5, 1.2], cats: { dining_table_large: 1 } } } },
      { id: 'stairs', type: 'stairs', label: 'stairs', rect: [w - 2.4, 4.8, w, 9.2], link: [0, 1] },
      { id: 'kitchen', type: 'kitchen', label: 'kitchen', rect: [0, 8.2, w - 2.4, 11.4] },
      { id: 'powder_room', type: 'bathroom', label: 'powder_room', library: 'bathroom_wc', rect: [w - 2.4, 9.2, w, 11.4], without: ['shower'] },
      { id: 'gourmet', type: 'gourmet', label: 'gourmet_area', library: 'gourmet_covered', rect: [0, 11.4, w, d] },
    ],
    doors: (w, _d) => [
      { a: 'living', b: 'outside', side: 'front', at: w - 1.2, width: 1.0 }, { a: 'living', b: 'stairs', at: w - 1.2, width: 0.8, opensTo: 'stairs' },
      { a: 'dining', b: 'stairs', at: 6.4, width: 0.8, opensTo: 'stairs' }, { a: 'dining', b: 'kitchen', at: 2.0, width: 1.0, opensTo: 'kitchen' },
      { a: 'kitchen', b: 'powder_room', at: 10.3, width: 0.7, opensTo: 'powder_room' }, { a: 'kitchen', b: 'gourmet', at: 2.2, width: 1.0, opensTo: 'gourmet' },
      { a: 'gourmet', b: 'outside', side: 'back', at: w / 2, width: 1.6 },
    ],
    windows: (w, d) => [
      { room: 'living', side: 'front', at: w * 0.25, width: 1.6 }, { room: 'living', side: 'left', at: 2.4, width: 1.4 }, { room: 'dining', side: 'left', at: 6.5, width: 1.4 },
      { room: 'kitchen', side: 'left', at: 9.8, width: 1.0, y0: 1.1, y1: 2.1 }, { room: 'gourmet', side: 'left', at: (11.4 + d) / 2, width: 1.2 }, { room: 'gourmet', side: 'right', at: (11.4 + d) / 2, width: 1.2 },
      { room: 'powder_room', side: 'right', at: 10.3, width: 0.5, y0: 1.6, y1: 2.2 }, { room: 'gourmet', side: 'back', at: 1.5, width: 1.2, y0: 1.2, y1: 2.2 }, { room: 'gourmet', side: 'back', at: w - 1.5, width: 1.2, y0: 1.2, y1: 2.2 },
    ],
  },
  {
    label: 'upper_floor', ceiling: 2.8,
    rooms: (w, d, op) => { const hw = r2(w / 2); return [
      { id: 'suite_1', type: 'bedroom', label: 'suite_1', rect: [0, 0, hw, 3.0], parts: [[2.0, 3.0, hw, 4.8]] },
      { id: 'bath_1', type: 'bathroom', label: 'bathroom_1', library: 'bathroom_wc', rect: [0, 3.0, 2.0, 4.8] },
      { id: 'suite_2', type: 'bedroom', label: 'suite_2', rect: [hw, 0, w, 3.0], parts: [[hw, 3.0, w - 2.0, 4.8]] },
      { id: 'bath_2', type: 'bathroom', label: 'bathroom_2', library: 'bathroom_wc', rect: [w - 2.0, 3.0, w, 4.8] },
      { id: 'veranda', type: 'balcony', label: 'veranda', library: 'veranda', rect: [0.8, -1.5, w - 0.8, 0] },
      { id: 'corridor_upper', type: 'corridor', label: 'corridor', rect: [0, 4.8, w - 2.4, 6.0] },
      { id: 'stairs_upper', type: 'stairs', label: 'stairs', rect: [w - 2.4, 4.8, w, 9.2], link: [op.floors === 3 ? 1 : 0, op.floors === 3 ? 2 : 1] },
      { id: 'suite_3', type: 'bedroom', label: 'suite_3', rect: [0, 6.0, w - 2.4, d], parts: [[w - 2.4, 11.6, w, d]] },
      { id: 'bath_3', type: 'bathroom', label: 'bathroom_3', library: 'bathroom_wc', rect: [w - 2.4, 9.2, w, 11.6] },
    ]; },
    doors: (w, _d) => { const hw = r2(w / 2); return [
      { a: 'suite_1', b: 'bath_1', at: 1.0, width: 0.7, opensTo: 'bath_1' }, { a: 'suite_1', b: 'corridor_upper', at: hw - 0.7, width: 0.8, opensTo: 'suite_1' },
      { a: 'suite_2', b: 'bath_2', at: w - 1.0, width: 0.7, opensTo: 'bath_2' }, { a: 'suite_2', b: 'corridor_upper', at: (hw + w - 2.4) / 2, width: 0.8, opensTo: 'suite_2' },
      { a: 'corridor_upper', b: 'stairs_upper', at: 5.4, width: 0.8, opensTo: 'corridor_upper' }, { a: 'corridor_upper', b: 'suite_3', at: 2.0, width: 0.8, opensTo: 'suite_3' },
      { a: 'suite_3', b: 'bath_3', at: 10.4, width: 0.7, opensTo: 'bath_3' }, { a: 'suite_1', b: 'veranda', at: 2.3, width: 0.8, opensTo: 'veranda' }, { a: 'suite_2', b: 'veranda', at: w - 2.3, width: 0.8, opensTo: 'veranda' },
    ]; },
    windows: (w, d) => [
      { room: 'suite_1', side: 'left', at: 1.5, width: 1.2 }, { room: 'suite_2', side: 'right', at: 1.5, width: 1.2 }, { room: 'suite_3', side: 'left', at: (6 + d) / 2, width: 1.4 }, { room: 'suite_3', side: 'back', at: (w - 2.4) / 2, width: 1.4 },
      { room: 'bath_1', side: 'left', at: 3.9, width: 0.5, y0: 1.5, y1: 2.1 }, { room: 'bath_2', side: 'right', at: 3.9, width: 0.5, y0: 1.5, y1: 2.1 }, { room: 'bath_3', side: 'right', at: 10.4, width: 0.5, y0: 1.5, y1: 2.1 },
    ],
  },
  {
    label: 'terrace', ceiling: 2.8,
    rooms: (w, d) => [
      { id: 'terrace', type: 'terrace', label: 'terrace', library: 'terrace', rect: [0, 0, w, 4.8], parts: [[0, 4.8, w - 2.4, d], [w - 2.4, 9.2, w, d]] },
      { id: 'stairs_top', type: 'stairs', label: 'stairs', rect: [w - 2.4, 4.8, w, 9.2], link: [1, 2] },
    ],
    doors: (w, _d) => [{ a: 'stairs_top', b: 'terrace', at: w - 1.2, width: 0.8, opensTo: 'terrace' }],
    windows: () => [],
  },
]

export const midModernTownhouse: TemplateDef = {
  id: 'mid_modern_townhouse', use: 'residential_single', floorRange: [2, 3], style: 'mid', limits: { w: [7.5, 10], d: [14.4, 16.4] }, defaults: { w: 8.5, d: 14.6 },
  options: { floors: [2, 3] },
  floorsFn: op => (op.floors === 3 ? [0, 1, 2] : [0, 1]).map(i => MID_TOWNHOUSE_FLOORS[i]),
  lot: (w, d) => ({ frontSetback: 5.5, marginLeft: 1.0, marginRight: 1.0, backyardDepth: clamp(30 - 5.5 - d, 5, 12), parking: { width: 3.4 }, garage: { u: -1 + 1.7, width: 3.0, to: 'parking' }, pedestrian: { u: w - 0.8 }, doorTarget: { a: 'living', side: 'front' }, libraries: { garden: 'garden_mid', backyard: 'backyard_townhouse' } }),
  facade: { balcony: true },
  facadeExtra: f => { f.modern = true; },
}
