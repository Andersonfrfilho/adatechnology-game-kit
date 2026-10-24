import type { TemplateDef } from '@adatechnology/game-floorplan'

export const market: TemplateDef = {
  id: 'market', use: 'commercial', place: 'market', construction: 'masonry', partyWalls: ['left', 'right'], style: 'commercial', limits: { w: [12, 20], d: [13, 18] }, defaults: { w: 14, d: 15 },
  lot: (w, _d) => ({ frontSetback: 0, marginLeft: 0, marginRight: 0, backyardDepth: 4.5, cargo: { u: (w - 5.4) / 2, width: 3.0 }, doorTarget: { a: 'counter', side: 'front' }, libraries: { backyard: 'backyard_service' } }),
  facade: { steelDoor: true },
  floors: [{
    label: 'ground_floor', ceiling: 3.2, openPairs: [['counter', 'shop']],
    rooms: (w, d) => { const bw = 2.4, ew = 3.0, extentV = d - 3.5; return [
      { id: 'counter', type: 'counter', label: 'checkouts', rect: [0, 0, w, 3.0] },
      { id: 'shop', type: 'shop', label: 'shop', rect: [0, 3.0, w, extentV] },
      { id: 'stockroom', type: 'stockroom', label: 'stockroom', rect: [0, extentV, w - bw - ew, d] },
      { id: 'bathroom', type: 'bathroom', label: 'bathroom', library: 'bathroom_wc', rect: [w - bw - ew, extentV, w - ew, d] },
      { id: 'office', type: 'office', label: 'office', rect: [w - ew, extentV, w, d] },
    ]; },
    doors: (w, _d) => [
      { a: 'counter', b: 'outside', side: 'front', at: w / 2, width: 2.0, steel: true },
      { a: 'shop', b: 'stockroom', width: 1.4, opensTo: 'stockroom' }, { a: 'shop', b: 'bathroom', width: 0.8, opensTo: 'bathroom' }, { a: 'shop', b: 'office', width: 0.9, opensTo: 'office' },
      { a: 'stockroom', b: 'outside', side: 'back', at: (w - 5.4) / 2, width: 1.6, steel: true },
    ],
    windows: (w, _d) => [
      { room: 'counter', side: 'front', at: w * 0.2, width: 3.0, y0: 0.9, y1: 2.5 }, { room: 'counter', side: 'front', at: w * 0.8, width: 3.0, y0: 0.9, y1: 2.5 },
      { room: 'shop', side: 'left', n: 2, width: 1.2, y0: 1.6, y1: 2.4 }, { room: 'shop', side: 'right', n: 2, width: 1.2, y0: 1.6, y1: 2.4 },
      { room: 'office', side: 'back', at: w - 1.5, width: 1.0, y0: 1.2, y1: 2.2 },
    ],
  }],
}
