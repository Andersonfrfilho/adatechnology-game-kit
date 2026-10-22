import type { FloorDef, RoomDef, TemplateDef } from '@adatechnology/game-floorplan'
import { r2 } from '../util'
import { floorCount, LARGE_SUITE } from './shared'

const MANSION_FLOORS: FloorDef[] = [
  {
    label: 'ground_floor', ceiling: 3.2,
    rooms: (w, d, op) => { const hu0 = r2(w * 0.3), hu1 = r2(w * 0.7), n = floorCount(op, 3), el = !!op.elevator && n > 1; const ex = hu0 + (el ? 4.2 : 2.4); const base: RoomDef[] = [
      { id: 'sitting_room', type: 'living', label: 'sitting_room', rect: [0, 0, hu0, 7.0] },
      { id: 'kitchen', type: 'kitchen', label: 'kitchen', rect: [0, 7.0, hu0, d - 3.2] },
      { id: 'laundry', type: 'laundry', label: 'laundry', rect: [0, d - 3.2, hu0, d] },
      { id: 'hall', type: 'hall', label: 'hall', rect: [hu0, 0, hu1, 4.0] },
      { id: 'dining', type: 'dining', label: 'dining', rect: [hu0, 4.0, hu1, d - 5.0] },
      { id: 'garage', type: 'garage', label: 'garage', rect: [hu1, 0, w, 6.0] },
      { id: 'powder_room', type: 'bathroom', label: 'powder_room', library: 'bathroom_wc', rect: [hu1, 6.0, w, 8.2], without: ['shower'] },
      { id: 'bedroom', type: 'bedroom', label: 'suite', rect: [hu1, 8.2, w, d - 3.3], overrides: { bed: { size: [2.2, 2.35], cats: { bed: 2, bed_king: 3 } }, wardrobe: { cats: { wardrobe: 2, wardrobe_large: 3 }, size: [2.5, 0.75] } } },
      { id: 'bathroom', type: 'bathroom', label: 'bathroom_suite', library: 'bathroom_wc', rect: [hu1, d - 3.3, w, d] },
    ];
    if (n > 1) base.push({ id: 'stairs', type: 'stairs', label: 'stairs', rect: [hu0, d - 5.0, hu0 + 2.4, d], link: [0, 1] });
    if (el) base.push({ id: 'elevator', type: 'elevator', label: 'elevator', rect: [hu0 + 2.4, d - 5.0, hu0 + 4.2, d] });
    base.push({ id: 'office', type: 'office', label: 'office', rect: [n > 1 ? ex : hu0, d - 5.0, hu1, d] });
    return base; },
    doors: (w, d, op) => { const hu0 = r2(w * 0.3), hu1 = r2(w * 0.7), n = floorCount(op, 3), el = !!op.elevator && n > 1; const L = [
      { a: 'hall', b: 'outside', side: 'front', at: w / 2, width: 1.6 }, { a: 'garage', b: 'outside', side: 'front', at: (hu1 + w) / 2, width: 3.0, steel: true },
      { a: 'hall', b: 'sitting_room', at: 2.0, width: 1.4, opensTo: 'sitting_room' }, { a: 'hall', b: 'garage', at: 2.0, width: 1.0, opensTo: 'garage' }, { a: 'hall', b: 'dining', at: w / 2, width: 2.0, opensTo: 'dining' },
      { a: 'sitting_room', b: 'kitchen', width: 1.0, opensTo: 'kitchen' }, { a: 'dining', b: 'kitchen', width: 1.0, opensTo: 'kitchen' }, { a: 'kitchen', b: 'laundry', width: 0.8, opensTo: 'laundry' },
      { a: 'dining', b: 'office', width: 1.2, opensTo: 'office' }, { a: 'dining', b: 'powder_room', width: 0.8, opensTo: 'powder_room' }, { a: 'dining', b: 'bedroom', width: 0.9, opensTo: 'bedroom' },
      { a: 'bedroom', b: 'bathroom', width: 0.8, opensTo: 'bathroom' },
      { a: 'laundry', b: 'outside', side: 'back', at: 1.5, width: 0.9 },
    ];
    if (!el) L.push({ a: 'office', b: 'outside', side: 'back', at: (hu1 + (hu0 + 2.4)) / 2 + 0.3, width: 1.4 }); // with an elevator the office gets narrow
    if (n > 1) L.push({ a: 'dining', b: 'stairs', at: hu0 + 1.2, width: 0.9, opensTo: 'stairs' });
    if (el) L.push({ a: 'dining', b: 'elevator', at: hu0 + 3.3, width: 0.9, opensTo: 'elevator' });
    return L; },
    windows: (w, d) => [
      { room: 'sitting_room', side: 'front', n: 2, width: 1.4 }, { room: 'sitting_room', side: 'left', n: 2, width: 1.4 },
      { room: 'kitchen', side: 'left', at: 11, width: 1.2, y0: 1.1, y1: 2.1 }, { room: 'laundry', side: 'left', at: d - 1.6, width: 0.8, y0: 1.3, y1: 2.1 },
      { room: 'bedroom', side: 'right', n: 2, width: 1.4 }, { room: 'bathroom', side: 'right', at: d - 1.6, width: 0.8, y0: 1.5, y1: 2.2 },
      { room: 'powder_room', side: 'right', at: 7.1, width: 0.6, y0: 1.5, y1: 2.2 }, { room: 'office', side: 'back', at: w * 0.55, width: 1.2 },
    ],
  },
  {
    label: 'upper_floor', ceiling: 3.0,
    rooms: (w, d, op) => { const hu0 = r2(w * 0.3), hu1 = r2(w * 0.7), n = floorCount(op, 3), el = !!op.elevator, h = r2(d / 2), ex = hu0 + (el ? 4.2 : 2.4); const sg = LARGE_SUITE(hu0 - 2.2); const L = [
      { id: 'suite_a', type: 'bedroom', label: 'suite_a', rect: [2.2, 0, hu0, h], overrides: sg }, { id: 'bath_a', type: 'bathroom', label: 'bathroom_a', library: 'bathroom_wc', rect: [0, 0, 2.2, h] },
      { id: 'suite_b', type: 'bedroom', label: 'suite_b', rect: [2.2, h, hu0, d], overrides: sg }, { id: 'bath_b', type: 'bathroom', label: 'bathroom_b', library: 'bathroom_wc', rect: [0, h, 2.2, d] },
      { id: 'suite_c', type: 'bedroom', label: 'suite_c', rect: [hu1, 0, w - 2.2, h], overrides: sg }, { id: 'bath_c', type: 'bathroom', label: 'bathroom_c', library: 'bathroom_wc', rect: [w - 2.2, 0, w, h] },
      { id: 'suite_d', type: 'bedroom', label: 'suite_d', rect: [hu1, h, w - 2.2, d], overrides: sg }, { id: 'bath_d', type: 'bathroom', label: 'bathroom_d', library: 'bathroom_wc', rect: [w - 2.2, h, w, d] },
      { id: 'gallery', type: 'corridor', label: 'gallery', rect: [hu0, 0, hu1, d - 5.0] },
      { id: 'stairs_upper', type: 'stairs', label: 'stairs', rect: [hu0, d - 5.0, hu0 + 2.4, d], link: [n === 3 ? 1 : 0, n === 3 ? 2 : 1] },
      { id: 'closet', type: 'closet', label: 'closet', rect: [ex, d - 5.0, hu1, d] },
    ];
    if (el) L.push({ id: 'elevator_upper', type: 'elevator', label: 'elevator', rect: [hu0 + 2.4, d - 5.0, hu0 + 4.2, d] });
    return L; },
    doors: (w, d, op) => { const hu0 = r2(w * 0.3), hu1 = r2(w * 0.7), h = r2(d / 2), el = !!op.elevator; const L = [
      { a: 'gallery', b: 'suite_a', at: h / 2, width: 0.9, opensTo: 'suite_a' }, { a: 'gallery', b: 'suite_b', at: (h + d - 5) / 2, width: 0.9, opensTo: 'suite_b' },
      { a: 'gallery', b: 'suite_c', at: h / 2, width: 0.9, opensTo: 'suite_c' }, { a: 'gallery', b: 'suite_d', at: (h + d - 5) / 2, width: 0.9, opensTo: 'suite_d' },
      { a: 'suite_a', b: 'bath_a', at: h / 2, width: 0.8, opensTo: 'bath_a' }, { a: 'suite_b', b: 'bath_b', at: (h + d) / 2, width: 0.8, opensTo: 'bath_b' },
      { a: 'suite_c', b: 'bath_c', at: h / 2, width: 0.8, opensTo: 'bath_c' }, { a: 'suite_d', b: 'bath_d', at: (h + d) / 2, width: 0.8, opensTo: 'bath_d' },
      { a: 'gallery', b: 'stairs_upper', at: hu0 + 1.2, width: 0.9, opensTo: 'gallery' }, { a: 'gallery', b: 'closet', at: hu1 - 1.0, width: 0.9, opensTo: 'closet' },
    ];
    if (el) L.push({ a: 'gallery', b: 'elevator_upper', at: hu0 + 3.3, width: 0.9, opensTo: 'gallery' });
    return L; },
    windows: (w, d) => { const hu0 = r2(w * 0.3), hu1 = r2(w * 0.7), h = r2(d / 2); return [
      { room: 'suite_a', side: 'front', at: (2.2 + hu0) / 2, width: 1.8 }, { room: 'suite_c', side: 'front', at: (hu1 + w - 2.2) / 2, width: 1.8 },
      { room: 'suite_b', side: 'back', at: (2.2 + hu0) / 2, width: 1.8 }, { room: 'suite_d', side: 'back', at: (hu1 + w - 2.2) / 2, width: 1.8 },
      { room: 'bath_a', side: 'left', at: h / 2, width: 0.8, y0: 1.5, y1: 2.2 }, { room: 'bath_b', side: 'left', at: (h + d) / 2, width: 0.8, y0: 1.5, y1: 2.2 },
      { room: 'bath_c', side: 'right', at: h / 2, width: 0.8, y0: 1.5, y1: 2.2 }, { room: 'bath_d', side: 'right', at: (h + d) / 2, width: 0.8, y0: 1.5, y1: 2.2 },
      { room: 'gallery', side: 'front', at: w / 2, width: 2.0 },
    ]; },
  },
  {
    label: 'penthouse_floor', ceiling: 3.0,
    rooms: (w, d, op) => { const hu0 = r2(w * 0.3), _hu1 = r2(w * 0.7), h = r2(d / 2), el = !!op.elevator, ex = hu0 + (el ? 4.2 : 2.4); const L = [
      { id: 'bath_master', type: 'bathroom', label: 'bathroom_master', library: 'bathroom_wc', rect: [0, 0, 2.4, h] }, { id: 'master', type: 'bedroom', label: 'suite_master', rect: [2.4, 0, hu0, h], overrides: LARGE_SUITE(hu0 - 2.4) },
      { id: 'closet_master', type: 'closet', label: 'closet_master', rect: [0, h, hu0, d] },
      { id: 'stairs_top', type: 'stairs', label: 'stairs', rect: [hu0, d - 5.0, hu0 + 2.4, d], link: [1, 2] },
      { id: 'cinema', type: 'cinema', label: 'cinema', rect: [ex, d - 5.0, w, d] },
      { id: 'terrace', type: 'terrace', label: 'terrace_deck', rect: [hu0, 0, w, d - 5.0] },
    ];
    if (el) L.push({ id: 'elevator_top', type: 'elevator', label: 'elevator', rect: [hu0 + 2.4, d - 5.0, hu0 + 4.2, d] });
    return L; },
    doors: (w, d, op) => { const hu0 = r2(w * 0.3), h = r2(d / 2), el = !!op.elevator; const L = [
      { a: 'master', b: 'bath_master', at: h / 2, width: 0.8, opensTo: 'bath_master' }, { a: 'master', b: 'closet_master', at: hu0 - 1.5, width: 0.9, opensTo: 'closet_master' }, { a: 'master', b: 'terrace', at: h / 2, width: 1.6 },
      { a: 'terrace', b: 'stairs_top', at: hu0 + 1.2, width: 0.9, opensTo: 'terrace' }, { a: 'terrace', b: 'cinema', at: w - 3.0, width: 1.2, opensTo: 'cinema' },
    ];
    if (el) L.push({ a: 'terrace', b: 'elevator_top', at: hu0 + 3.3, width: 0.9, opensTo: 'terrace' });
    return L; },
    windows: (w, _d) => [{ room: 'master', side: 'front', at: 4.0, width: 1.4 }, { room: 'cinema', side: 'back', at: w * 0.8, width: 1.0, y0: 1.5, y1: 2.3 }],
  },
]

export const mansion: TemplateDef = {
  id: 'mansion', use: 'residential_single', floorRange: [1, 3], style: 'high', limits: { w: [19, 26], d: [15, 20] }, defaults: { w: 20, d: 16 },
  options: { floors: [1, 2, 3], elevator: [false, true] },
  floorsFn: op => { const n = floorCount(op, 3); return MANSION_FLOORS.slice(0, n); },
  lot: (w, _d) => { const hu1 = r2(w * 0.7), garageU = (hu1 + w) / 2; return { frontSetback: 10, marginLeft: 3, marginRight: 3, backyardDepth: 14, parking: { width: 4.2 }, garage: { u: garageU, width: 3.6, to: 'inner_garage' }, pedestrian: { u: w / 2 }, pool: true, libraries: { garden: 'garden_high', backyard: 'backyard_pool', parking: 'access' }, doorTarget: { a: 'hall', side: 'front' } }; },
}
