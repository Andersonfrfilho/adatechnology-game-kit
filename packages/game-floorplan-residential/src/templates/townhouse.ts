import type { TemplateDef } from '@adatechnology/game-floorplan'
import { r2 } from '../util'

export const townhouse: TemplateDef = {
  id: 'townhouse', use: 'residential_single', style: 'budget', limits: { w: [7.5, 11], d: [12, 15] }, defaults: { w: 8, d: 12 },
  lot: (w, _d) => ({ frontSetback: 6, marginLeft: 1.0, marginRight: 1.0, backyardDepth: 5, parking: { width: 3.4 }, garage: { u: -1 + 1.7, width: 3.0, to: 'parking' }, pedestrian: { u: w - 0.8 }, doorTarget: { a: 'living', side: 'front' } }),
  facade: { balcony: true },
  floors: [
    {
      label: 'ground_floor', ceiling: 2.8,
      rooms: (w, d) => { const ac = r2(w * 0.4), ex = w - 2.6; return [
        { id: 'living', type: 'living', label: 'living', rect: [0, 0, w, 5] },
        { id: 'kitchen', type: 'kitchen', label: 'kitchen', rect: [0, 5, ac, d] },
        { id: 'powder_room', type: 'bathroom', label: 'powder_room', library: 'bathroom_wc', rect: [ac, 5, ex, 7.0], without: ['shower'] },
        { id: 'laundry', type: 'laundry', label: 'laundry', rect: [ac, 7.0, ex, d] },
        { id: 'stairs', type: 'stairs', label: 'stairs', rect: [ex, 5, w, 9.4], link: [0, 1] },
        { id: 'circulation', type: 'corridor', label: 'circulation', rect: [ex, 9.4, w, d] },
      ]; },
      doors: (w, _d) => [
        { a: 'living', b: 'outside', side: 'front', at: w / 2, width: 1.0 },
        { a: 'living', b: 'kitchen', at: Math.min(w * 0.3, 2.3), width: 0.9, opensTo: 'kitchen' },
        { a: 'living', b: 'powder_room', at: r2(w * 0.4) + 0.55, width: 0.7, opensTo: 'powder_room' },
        { a: 'living', b: 'stairs', at: w - 0.65, width: 0.8, opensTo: 'stairs' },
        { a: 'kitchen', b: 'laundry', width: 0.8, opensTo: 'laundry' },
        { a: 'laundry', b: 'circulation', width: 0.8, opensTo: 'circulation' },
        { a: 'stairs', b: 'circulation', at: w - 0.65, width: 0.8, opensTo: 'circulation' },
        { a: 'circulation', b: 'outside', side: 'back', width: 0.9 },
      ],
      windows: (w, d) => [
        { room: 'living', side: 'front', at: w * 0.25, width: 1.2 }, { room: 'living', side: 'front', at: w * 0.75, width: 1.2 },
        { room: 'living', side: 'left', at: 2.5, width: 1.2 }, { room: 'kitchen', side: 'left', at: (5 + d) / 2, width: 1.0, y0: 1.1, y1: 2.1 },
        { room: 'kitchen', side: 'back', at: r2(w * 0.4) / 2, width: 1.0, y0: 1.1, y1: 2.1 }, { room: 'laundry', side: 'back', at: (r2(w * 0.4) + w - 2.6) / 2, width: 0.8, y0: 1.3, y1: 2.1 },
      ],
    },
    {
      label: 'upper_floor', ceiling: 2.8,
      rooms: (w, d) => { const q = r2(w / 2), ex = w - 2.6; return [
        { id: 'bedroom_1', type: 'bedroom', label: 'bedroom_1', rect: [0, 0, q, 5] },
        { id: 'bedroom_2', type: 'bedroom', label: 'bedroom_2', rect: [q, 0, w, 5] },
        { id: 'balcony', type: 'balcony', label: 'balcony', rect: [0.8, -1.2, q - 0.8, 0] },
        { id: 'corridor_upper', type: 'corridor', label: 'corridor', rect: [0, 5, ex, 6.3] },
        { id: 'stairs_upper', type: 'stairs', label: 'stairs', rect: [ex, 5, w, 9.4], link: [0, 1] },
        { id: 'bedroom_3', type: 'bedroom', label: 'bedroom_3', rect: [0, 6.3, ex, d] },
        { id: 'bathroom_upper', type: 'bathroom', label: 'bathroom', library: 'bathroom_wc', rect: [ex, 9.4, w, d] },
      ]; },
      doors: (w, _d) => { const q = r2(w / 2); return [
        { a: 'corridor_upper', b: 'bedroom_1', at: 0.7, width: 0.8, opensTo: 'bedroom_1' },
        { a: 'corridor_upper', b: 'bedroom_2', width: 0.8, opensTo: 'bedroom_2' },
        { a: 'corridor_upper', b: 'stairs_upper', width: 0.8, opensTo: 'corridor_upper' },
        { a: 'corridor_upper', b: 'bedroom_3', width: 0.8, opensTo: 'bedroom_3' },
        { a: 'bathroom_upper', b: 'stairs_upper', at: w - 0.65, width: 0.7, opensTo: 'bathroom_upper' },
        { a: 'bedroom_1', b: 'balcony', at: q / 2, width: 0.8, opensTo: 'balcony' },
      ]; },
      windows: (w, d) => [
        { room: 'bedroom_1', side: 'left', at: 2.5, width: 1.2 }, { room: 'bedroom_2', side: 'front', at: (r2(w / 2) + w) / 2, width: 1.4 }, { room: 'bedroom_2', side: 'right', at: 2.5, width: 1.2 },
        { room: 'bedroom_3', side: 'left', at: (6.3 + d) / 2, width: 1.2 }, { room: 'bedroom_3', side: 'back', at: (w - 2.6) / 2, width: 1.4 },
        { room: 'bathroom_upper', side: 'back', at: w - 1.3, width: 0.6, y0: 1.5, y1: 2.1 },
      ],
    },
  ],
}
