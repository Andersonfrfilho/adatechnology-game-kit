import type { RoomDef, TemplateDef } from '@adatechnology/game-floorplan'
import { r2 } from '../util'
import { SINGLE_BED_ONLY } from './shared'

/** Needs the engine's `hashString` to keep the unit-variant draw of the seed. */
export function createApartmentModern(hashString: (s: string) => number): TemplateDef {
  const hashSeed = (op: { seed?: number | string }) => hashString(String(op.seed == null ? 1 : op.seed) + '|apto')
  return {
  id: 'apartment_modern', use: 'residential_multi', style: op => (op.tier === 'high' ? 'high' : 'mid'), lot: null, singleFloor: true,
  limits: { w: [8.5, 14], d: [11, 16.5] }, defaults: { w: 9, d: 11.5 }, options: { tier: ['mid', 'high'] },
  limitsFn: op => (op.tier === 'high' ? { w: [12, 14], d: [15, 16.5] } : { w: [8.5, 10.5], d: [11, 13.5] }),
  defaultsFn: op => (op.tier === 'high' ? { w: 12.5, d: 15.5 } : { w: 9, d: 11.5 }),
  building: (w, d, op) => { const isHigh = op.tier === 'high', n = isHigh ? 2 : 4, side = n / 2, L = r2(side * w);
    const units = []; for (let i = 0; i < n; i++) { const queue = i % 2, k = Math.floor(i / 2); units.push(queue === 0 ? { index: i, u: r2(k * w), v: 0, ry: 0, mirrored: false } : { index: i, u: r2((k + 1) * w), v: -1.6, ry: r2(Math.PI), mirrored: true }); }
    return { floors: { min: 3, max: 20, defaults: 8 }, unitsPerFloor: n, ceilingHeight: 2.8, slab: 0.2, unit: { w, d }, corridor: [0, -1.6, L, 0], hall: [-3.6, -1.6, 0, 0], elevator: { rect: [-3.6, -3.6, -1.8, -1.6], door: '+v' }, stairs: { rect: [-1.8, -3.6, 0, -1.6], door: '+v' }, units,
      note: 'Row 0: local (a,b) maps to (u+a, v+b). Row 1: rotated 180 degrees around (u, v): (u-a, v-b). Each unit door sits at local v = 0, facing the corridor.' }; },
  floors: [{
    label: 'floor', ceiling: 2.8, openPairs: [['corridor', 'living'], ['hall', 'corridor'], ['living', 'dining']],
    rooms: (w, d, op) => {
      if (op.tier === 'high') { const sw = w - 2.4; return [
        { id: 'kitchen', type: 'kitchen', label: 'kitchen', rect: [0, 0, 3.8, 3.6], library: 'kitchen_integrated' }, { id: 'laundry', type: 'laundry', label: 'service_area', rect: [0, 3.6, 3.8, 5.2] },
        { id: 'maid_room', type: 'bedroom', label: 'maid_room', rect: [0, 5.2, 3.8, 7.8], overrides: SINGLE_BED_ONLY }, { id: 'powder_room', type: 'bathroom', label: 'powder_room', library: 'bathroom_wc', rect: [0, 7.8, 3.8, 10.2], without: ['shower'] },
        { id: 'hall', type: 'hall', label: 'hall', rect: [3.8, 0, 5.3, 2.6] }, { id: 'corridor', type: 'corridor', label: 'corridor', rect: [3.8, 2.6, 5.3, 10.2] },
        { id: 'suite_1', type: 'bedroom', label: 'suite_1', rect: [5.3, 0, sw, 3.4] }, { id: 'bath_1', type: 'bathroom', label: 'bathroom_1', library: 'bathroom_wc', rect: [sw, 0, w, 3.4] },
        { id: 'suite_2', type: 'bedroom', label: 'suite_2', rect: [5.3, 3.4, sw, 6.8] }, { id: 'bath_2', type: 'bathroom', label: 'bathroom_2', library: 'bathroom_wc', rect: [sw, 3.4, w, 6.8] },
        { id: 'suite_3', type: 'bedroom', label: 'suite_3', rect: [5.3, 6.8, sw, 10.2] }, { id: 'bath_3', type: 'bathroom', label: 'bathroom_3', library: 'bathroom_wc', rect: [sw, 6.8, w, 10.2] },
        { id: 'living', type: 'living', label: 'sitting_room', rect: [0, 10.2, 6.4, d] }, { id: 'dining', type: 'dining', label: 'dining', rect: [6.4, 10.2, w, d] },
        { id: 'veranda', type: 'balcony', label: 'veranda_gourmet', library: 'balcony_gourmet', rect: [1.2, d, w - 1.2, d + 2.4] },
      ]; }
      const pictureCount = (w >= 8.2 && d >= 13 && hashSeed(op) % 2) ? 3 : 2, fv = pictureCount === 3 ? 9.2 : 6.6; const L: RoomDef[] = [
        { id: 'kitchen', type: 'kitchen', label: 'kitchen', rect: [0, 0, 3.4, 3.0], library: 'kitchen_integrated' }, { id: 'laundry', type: 'laundry', label: 'service_area', rect: [0, 3.0, 3.4, 4.6] },
        { id: 'bathroom', type: 'bathroom', label: 'bathroom', library: 'bathroom_wc', rect: [0, 4.6, 3.4, 6.6] },
        { id: 'corridor', type: 'corridor', label: 'corridor', rect: [3.4, 0, 4.7, fv] },
        { id: 'bedroom_1', type: 'bedroom', label: 'bedroom_1', rect: [4.7, 0, w, 3.3] }, { id: 'bedroom_2', type: 'bedroom', label: 'bedroom_2', rect: [4.7, 3.3, w, 6.6] },
        { id: 'living', type: 'living', label: 'living', rect: [0, fv, w, d] }, { id: 'veranda', type: 'balcony', label: 'veranda', library: 'veranda', rect: [0.8, d, w - 0.8, d + 1.6] },
      ];
      if (pictureCount === 3) L.push({ id: 'bedroom_3', type: 'bedroom', label: 'bedroom_3', rect: [0, 6.6, 3.4, 9.2], overrides: SINGLE_BED_ONLY }, { id: 'office', type: 'office', label: 'office', rect: [4.7, 6.6, w, 9.2] });
      return L; },
    doors: (w, d, op) => {
      if (op.tier === 'high') { const _sw = w - 2.4; return [
        { a: 'hall', b: 'outside', side: 'front', at: 4.55, width: 1.0 }, { a: 'kitchen', b: 'hall', at: 1.3, width: 0.9, opensTo: 'kitchen' }, { a: 'laundry', b: 'corridor', at: 4.4, width: 0.8, opensTo: 'laundry' },
        { a: 'maid_room', b: 'corridor', at: 6.5, width: 0.8, opensTo: 'maid_room' }, { a: 'powder_room', b: 'corridor', at: 9.0, width: 0.75, opensTo: 'powder_room' },
        { a: 'suite_1', b: 'hall', at: 0.7, width: 0.85, opensTo: 'suite_1' }, { a: 'suite_2', b: 'corridor', at: 4.1, width: 0.85, opensTo: 'suite_2' }, { a: 'suite_3', b: 'corridor', at: 7.5, width: 0.85, opensTo: 'suite_3' },
        { a: 'suite_1', b: 'bath_1', width: 0.75, opensTo: 'bath_1' }, { a: 'suite_2', b: 'bath_2', width: 0.75, opensTo: 'bath_2' }, { a: 'suite_3', b: 'bath_3', width: 0.75, opensTo: 'bath_3' },
        { a: 'living', b: 'veranda', at: 3.8, width: 1.6 }, { a: 'dining', b: 'veranda', at: (6.4 + w - 1.2) / 2 + 0.3, width: 1.6 },
      ]; }
      const pictureCount = (w >= 8.2 && d >= 13 && hashSeed(op) % 2) ? 3 : 2; const L = [
        { a: 'corridor', b: 'outside', side: 'front', at: 4.05, width: 0.9 }, { a: 'corridor', b: 'kitchen', at: 1.5, width: 0.8, opensTo: 'kitchen' }, { a: 'kitchen', b: 'laundry', at: 2.9, width: 0.8, opensTo: 'laundry' },
        { a: 'corridor', b: 'bathroom', at: 5.6, width: 0.75, opensTo: 'bathroom' }, { a: 'corridor', b: 'bedroom_1', at: 1.6, width: 0.8, opensTo: 'bedroom_1' }, { a: 'corridor', b: 'bedroom_2', at: 4.9, width: 0.8, opensTo: 'bedroom_2' },
        { a: 'living', b: 'veranda', at: w / 2, width: 1.6 },
      ];
      if (pictureCount === 3) L.push({ a: 'corridor', b: 'bedroom_3', at: 7.9, width: 0.8, opensTo: 'bedroom_3' }, { a: 'corridor', b: 'office', at: 7.9, width: 0.8, opensTo: 'office' });
      return L; },
    windows: (w, d, op) => {
      if (op.tier === 'high') { return [
        { room: 'kitchen', side: 'left', at: 2.0, width: 1.0, y0: 1.1, y1: 2.1 }, { room: 'laundry', side: 'left', at: 4.4, width: 0.6, y0: 1.3, y1: 2.1 }, { room: 'maid_room', side: 'left', at: 6.5, width: 0.9 },
        { room: 'powder_room', side: 'left', at: 9.0, width: 0.5, y0: 1.6, y1: 2.2 }, { room: 'bath_1', side: 'right', at: 1.7, width: 0.6, y0: 1.5, y1: 2.1 }, { room: 'bath_2', side: 'right', at: 5.1, width: 0.6, y0: 1.5, y1: 2.1 },
        { room: 'bath_3', side: 'right', at: 8.5, width: 0.6, y0: 1.5, y1: 2.1 }, { room: 'living', side: 'left', at: (10.2 + d) / 2, width: 1.8 }, { room: 'dining', side: 'right', at: (10.2 + d) / 2, width: 1.8 },
      ]; }
      const pictureCount = (w >= 8.2 && d >= 13 && hashSeed(op) % 2) ? 3 : 2, fv = pictureCount === 3 ? 9.2 : 6.6; const L = [
        { room: 'bedroom_1', side: 'right', at: 1.6, width: 1.2 }, { room: 'bedroom_2', side: 'right', at: 4.9, width: 1.2 }, { room: 'kitchen', side: 'left', at: 1.5, width: 0.9, y0: 1.1, y1: 2.1 },
        { room: 'laundry', side: 'left', at: 3.8, width: 0.6, y0: 1.3, y1: 2.1 }, { room: 'living', side: 'left', at: (fv + d) / 2, width: 1.6 }, { room: 'living', side: 'right', at: (fv + d) / 2, width: 1.6 },
      ];
      if (pictureCount === 3) L.push({ room: 'bedroom_3', side: 'left', at: 7.9, width: 1.0 }, { room: 'office', side: 'right', at: 7.9, width: 1.0 });
      return L; },
  }],
}
}
