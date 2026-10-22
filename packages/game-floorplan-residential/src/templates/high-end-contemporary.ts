import type { FloorDef, TemplateDef } from '@adatechnology/game-floorplan'
import { clamp, r2 } from '../util'
import { floorCount, LARGE_SUITE } from './shared'

const HIGH_FLOORS: FloorDef[] = [
  {
    label: 'ground_floor', ceiling: 3.2, openPairs: [['living', 'dining']],
    rooms: (w, d, _op) => { const wa = r2(w - 11.2); return [
      { id: 'living', type: 'living', label: 'living_double_height', rect: [0, 0, wa, 7.0], ceiling: 5.8 },
      { id: 'hall', type: 'hall', label: 'hall', rect: [wa, 0, wa + 3.2, 4.0] },
      { id: 'office', type: 'office', label: 'home_office', rect: [wa, 4.0, wa + 3.2, 7.0] },
      { id: 'garage', type: 'garage', library: 'garage_3car', label: 'garage_3car', rect: [wa + 3.2, 0, w, 7.0] },
      { id: 'dining', type: 'dining', label: 'dining', rect: [0, 7.0, wa, 11.0] },
      { id: 'kitchen', type: 'kitchen', library: 'kitchen_integrated', label: 'kitchen', rect: [wa, 7.0, wa + 5.6, 11.0] },
      { id: 'laundry', type: 'laundry', label: 'laundry', rect: [wa + 5.6, 7.0, w, 9.2] },
      { id: 'powder_room', type: 'bathroom', label: 'powder_room', library: 'bathroom_wc', rect: [wa + 5.6, 9.2, w, 11.0], without: ['shower'] },
      { id: 'lounge', type: 'living', label: 'family_room', rect: [0, 11.0, wa, d], overrides: { tv_unit_back: null, tv_back: null, sofa_back: null, table_back: null, rug_back: null } },
      { id: 'stairs', type: 'stairs', label: 'stairs', rect: [wa, 11.0, wa + 2.4, 16.0], link: [0, 1] },
      { id: 'spa', type: 'spa', label: 'spa', rect: [wa + 2.4, 11.0, wa + 6.6, 16.0] },
      { id: 'gourmet_indoor', type: 'gourmet', library: 'gourmet_covered', label: 'gourmet_space', rect: [wa + 6.6, 11.0, w, 16.0] },
      { id: 'circulation', type: 'corridor', label: 'circulation', rect: [wa, 16.0, w, d] },
    ]; },
    doors: (w, _d) => { const wa = r2(w - 11.2); return [
      { a: 'hall', b: 'outside', side: 'front', at: wa + 1.6, width: 1.6 }, { a: 'garage', b: 'outside', side: 'front', at: w - 4.0, width: 5.4, steel: true },
      { a: 'hall', b: 'living', at: 2.0, width: 1.6, opensTo: 'living' }, { a: 'hall', b: 'office', at: wa + 1.6, width: 0.9, opensTo: 'office' }, { a: 'hall', b: 'garage', at: 0.9, width: 1.0, opensTo: 'garage' },
      { a: 'dining', b: 'kitchen', at: 8.0, width: 1.4, opensTo: 'kitchen' }, { a: 'kitchen', b: 'laundry', at: 8.1, width: 0.9, opensTo: 'laundry' }, { a: 'kitchen', b: 'powder_room', at: 10.1, width: 0.8, opensTo: 'powder_room' },
      { a: 'dining', b: 'lounge', at: wa / 2, width: 1.6, opensTo: 'lounge' }, { a: 'kitchen', b: 'stairs', at: wa + 1.83, width: 0.9, opensTo: 'stairs' }, { a: 'lounge', b: 'stairs', at: 11.8, width: 0.8, opensTo: 'stairs' },
      { a: 'stairs', b: 'spa', at: 11.8, width: 0.8, opensTo: 'spa' }, { a: 'spa', b: 'gourmet_indoor', at: 13.0, width: 0.9, opensTo: 'gourmet_indoor' },
      { a: 'circulation', b: 'gourmet_indoor', at: wa + 10.0, width: 1.2, opensTo: 'gourmet_indoor' }, { a: 'circulation', b: 'lounge', at: 17.4, width: 1.0, opensTo: 'lounge' },
      { a: 'circulation', b: 'outside', side: 'back', at: wa + 5.6, width: 2.4 }, { a: 'laundry', b: 'outside', side: 'right', at: 8.1, width: 0.9 },
    ]; },
    windows: (w, d) => { const wa = r2(w - 11.2); return [
      { room: 'living', side: 'front', at: wa / 2, width: wa - 1.4, y0: 0.1, y1: 4.8 }, { room: 'living', side: 'left', n: 2, width: 1.8, y0: 0.4, y1: 4.2 },
      { room: 'dining', side: 'left', at: 9.0, width: 2.2, y0: 0.2, y1: 2.5 }, { room: 'lounge', side: 'left', at: (11 + d) / 2, width: 2.4, y0: 0.2, y1: 2.5 }, { room: 'lounge', side: 'back', at: wa / 2, width: 3.0, y0: 1.1, y1: 2.5 },
      { room: 'powder_room', side: 'right', at: 10.1, width: 0.5, y0: 1.6, y1: 2.2 }, { room: 'garage', side: 'right', at: 3.5, width: 1.0, y0: 1.5, y1: 2.3 },
    ]; },
  },
  {
    label: 'upper_floor', ceiling: 3.0,
    rooms: (w, d, op) => { const wa = r2(w - 11.2), w3 = floorCount(op, 2) === 3; return [
      { id: 'void_living', type: 'void', label: 'void_living', rect: [0, 0, wa, 7.0] },
      { id: 'gallery', type: 'corridor', label: 'gallery', rect: [wa, 0, wa + 2.4, 11.0] },
      { id: 'suite_1', type: 'bedroom', label: 'suite_1', rect: [wa + 2.4, 0, w - 2.4, 5.5], overrides: LARGE_SUITE(5) },
      { id: 'bath_1', type: 'bathroom', label: 'bathroom_1', library: 'bathroom_wc', rect: [w - 2.4, 0, w, 5.5] },
      { id: 'suite_4', type: 'bedroom', label: 'suite_4', rect: [wa + 2.4, 5.5, w - 2.4, 11.0], overrides: LARGE_SUITE(5) },
      { id: 'bath_4', type: 'bathroom', label: 'bathroom_4', library: 'bathroom_wc', rect: [w - 2.4, 5.5, w, 11.0] },
      { id: 'suite_2', type: 'bedroom', label: 'suite_2', rect: [2.4, 7.0, wa, 11.0], overrides: LARGE_SUITE(wa - 2.4) },
      { id: 'bath_2', type: 'bathroom', label: 'bathroom_2', library: 'bathroom_wc', rect: [0, 7.0, 2.4, 11.0] },
      { id: 'suite_3', type: 'bedroom', label: 'suite_3', rect: [2.4, 11.0, wa, d], overrides: LARGE_SUITE(wa - 2.4) },
      { id: 'bath_3', type: 'bathroom', label: 'bathroom_3', library: 'bathroom_wc', rect: [0, 11.0, 2.4, d] },
      { id: 'stairs_upper', type: 'stairs', label: 'stairs', rect: [wa, 11.0, wa + 2.4, 16.0], link: [w3 ? 1 : 0, w3 ? 2 : 1] },
      { id: 'closet', type: 'closet', label: 'closet', rect: [wa + 2.4, 11.0, wa + 6.6, 16.0] },
      { id: 'balcony_upper', type: 'balcony', label: 'veranda', library: 'veranda', rect: [wa + 6.6, 11.0, w, 16.0], parts: [[wa + 2.4, 16.0, w, d]] },
    ]; },
    doors: (w, d) => { const wa = r2(w - 11.2); return [
      { a: 'gallery', b: 'suite_1', at: 2.7, width: 0.9, opensTo: 'suite_1' }, { a: 'gallery', b: 'suite_4', at: 8.2, width: 0.9, opensTo: 'suite_4' }, { a: 'gallery', b: 'suite_2', at: 9.0, width: 0.9, opensTo: 'suite_2' },
      { a: 'gallery', b: 'stairs_upper', at: wa + 1.2, width: 0.9, opensTo: 'gallery' }, { a: 'suite_1', b: 'bath_1', at: 2.7, width: 0.8, opensTo: 'bath_1' }, { a: 'suite_4', b: 'bath_4', at: 8.2, width: 0.8, opensTo: 'bath_4' },
      { a: 'suite_2', b: 'bath_2', at: 9.0, width: 0.8, opensTo: 'bath_2' }, { a: 'suite_3', b: 'bath_3', at: (11 + d) / 2, width: 0.8, opensTo: 'bath_3' },
      { a: 'suite_3', b: 'stairs_upper', at: 11.8, width: 0.8, opensTo: 'stairs_upper' }, { a: 'closet', b: 'stairs_upper', at: 11.8, width: 0.8, opensTo: 'closet' }, { a: 'closet', b: 'balcony_upper', at: wa + 4.5, width: 1.2, opensTo: 'balcony_upper' },
      { a: 'suite_3', b: 'outside', side: 'back', at: (2.4 + wa) / 2, width: 1.8 },
    ]; },
    windows: (w, d) => { const wa = r2(w - 11.2); return [
      { room: 'suite_1', side: 'front', at: (wa + 2.4 + w - 2.4) / 2, width: 3.0, y0: 0.2, y1: 2.5 }, { room: 'bath_1', side: 'right', at: 2.7, width: 0.6, y0: 1.5, y1: 2.2 }, { room: 'bath_4', side: 'right', at: 8.2, width: 0.6, y0: 1.5, y1: 2.2 },
      { room: 'bath_2', side: 'left', at: 9.0, width: 0.6, y0: 1.5, y1: 2.2 }, { room: 'bath_3', side: 'left', at: (11 + d) / 2, width: 0.6, y0: 1.5, y1: 2.2 },
      { room: 'suite_3', side: 'back', at: (2.4 + wa) / 2 + 2.5, width: 2.2, y0: 0.2, y1: 2.5 },
    ]; },
  },
  {
    label: 'penthouse_floor', ceiling: 3.0,
    rooms: (w, d) => { const wa = r2(w - 11.2); return [
      { id: 'gallery_top', type: 'corridor', label: 'gallery', rect: [wa, 0, wa + 2.4, 11.0] },
      { id: 'master', type: 'bedroom', label: 'suite_master', rect: [wa + 2.4, 0, w - 2.4, 5.5], overrides: LARGE_SUITE(5) },
      { id: 'bath_master', type: 'bathroom', label: 'bathroom_master', library: 'bathroom_wc', rect: [w - 2.4, 0, w, 5.5] },
      { id: 'closet_master', type: 'closet', label: 'closet_master', rect: [wa + 2.4, 5.5, w - 2.4, 11.0] },
      { id: 'cinema', type: 'cinema', label: 'cinema', rect: [0, 7.0, wa, 11.0] },
      { id: 'stairs_top', type: 'stairs', label: 'stairs', rect: [wa, 11.0, wa + 2.4, 16.0], link: [1, 2] },
      { id: 'terrace', type: 'terrace', label: 'terrace_deck', rect: [wa + 2.4, 11.0, w, d] },
    ]; },
    doors: (w, _d) => { const wa = r2(w - 11.2); return [
      { a: 'gallery_top', b: 'master', at: 2.7, width: 0.9, opensTo: 'master' }, { a: 'gallery_top', b: 'closet_master', at: 8.2, width: 0.9, opensTo: 'closet_master' }, { a: 'gallery_top', b: 'cinema', at: 9.0, width: 1.0, opensTo: 'cinema' },
      { a: 'gallery_top', b: 'stairs_top', at: wa + 1.2, width: 0.9, opensTo: 'gallery_top' }, { a: 'master', b: 'bath_master', at: 2.7, width: 0.8, opensTo: 'bath_master' }, { a: 'master', b: 'closet_master', at: wa + 4.5, width: 0.9, opensTo: 'closet_master' },
      { a: 'stairs_top', b: 'terrace', at: 11.8, width: 0.8, opensTo: 'terrace' },
    ]; },
    windows: (w, _d) => { const wa = r2(w - 11.2); return [
      { room: 'master', side: 'front', at: (wa + 2.4 + w - 2.4) / 2, width: 3.2, y0: 0.2, y1: 2.5 }, { room: 'bath_master', side: 'right', at: 2.7, width: 0.6, y0: 1.5, y1: 2.2 }, { room: 'cinema', side: 'left', at: 9.0, width: 0.8, y0: 1.8, y1: 2.4 },
    ]; },
  },
]

export const highEndContemporary: TemplateDef = {
  id: 'high_end_contemporary', use: 'residential_single', floorRange: [1, 3], style: 'high', limits: { w: [20, 24], d: [18.5, 21] }, defaults: { w: 21, d: 19.5 },
  options: { floors: [2, 3] },
  floorsFn: op => { const n = floorCount(op, 2); return [HIGH_FLOORS[0], HIGH_FLOORS[1]].concat(n === 3 ? [HIGH_FLOORS[2]] : []).slice(0, Math.max(n, 1)); },
  lot: (w, d) => { const wa = w - 11.2, backDepth = clamp(40 - 8 - d, 13, 22); return {
    frontSetback: 8, marginLeft: 2.5, marginRight: 2.5, backyardDepth: backDepth, parking: { width: 5.6 }, garage: { u: w - 4.0, width: 5.4, to: 'inner_garage' }, pedestrian: { u: wa + 1.6 }, pool: true,
    doorTarget: { a: 'hall', side: 'front' }, libraries: { garden: 'garden_high', parking: 'access' },
    yardZones: [{ id: 'gourmet', type: 'gourmet', label: 'gourmet', v0: 0, v1: 5.5, library: 'gourmet_high' }, { id: 'backyard', type: 'backyard', label: 'pool_garden', v0: 5.5, v1: backDepth, library: 'backyard_high' }],
  }; },
  facadeExtra: f => { f.glass = true; f.modern = true; f.blackFrames = true; f.doubleHeight = true; },
}
