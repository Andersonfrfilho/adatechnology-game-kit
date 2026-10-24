import type { TemplateDef } from '@adatechnology/game-floorplan'

export const pharmacy: TemplateDef = {
  id: 'pharmacy', use: 'commercial', place: 'pharmacy', construction: 'masonry', partyWalls: ['left', 'right'], style: 'commercial', limits: { w: [9, 14], d: [10, 14] }, defaults: { w: 10, d: 12 },
  lot: (w, _d) => ({ frontSetback: 0, marginLeft: 0, marginRight: 0, backyardDepth: 4.0, cargo: { u: w - 6, width: 3.0 }, doorTarget: { a: 'shop', side: 'front' }, libraries: { backyard: 'backyard_service' } }),
  facade: { steelDoor: true },
  floors: [{
    label: 'ground_floor', ceiling: 3.0, openPairs: [['shop', 'counter']],
    rooms: (w, d) => { const extentV = d - 5.6, y2 = extentV + 2.6; return [
      { id: 'shop', type: 'shop', library: 'shop_pharmacy', label: 'shop', rect: [0, 0, w, extentV] },
      { id: 'counter', type: 'counter', library: 'counter_pharmacy', label: 'counter', rect: [0, extentV, w, y2] },
      { id: 'stockroom', type: 'stockroom', label: 'stockroom', rect: [0, y2, w - 5, d] },
      { id: 'bathroom', type: 'bathroom', label: 'bathroom', library: 'bathroom_wc', rect: [w - 5, y2, w - 2.6, d] },
      { id: 'consulting_room', type: 'office', label: 'consulting_room', rect: [w - 2.6, y2, w, d] },
    ]; },
    doors: (w, _d) => [
      { a: 'shop', b: 'outside', side: 'front', at: w / 2, width: 1.4, steel: true },
      { a: 'counter', b: 'stockroom', width: 1.0, opensTo: 'stockroom' }, { a: 'counter', b: 'bathroom', width: 0.8, opensTo: 'bathroom' }, { a: 'counter', b: 'consulting_room', width: 0.9, opensTo: 'consulting_room' },
      { a: 'stockroom', b: 'outside', side: 'back', at: w - 6, width: 1.4, steel: true },
    ],
    windows: (w, d) => [
      { room: 'shop', side: 'front', at: w * 0.2, width: 2.0, y0: 0.9, y1: 2.4 }, { room: 'shop', side: 'front', at: w * 0.8, width: 2.0, y0: 0.9, y1: 2.4 },
      { room: 'shop', side: 'left', at: 2.5, width: 1.2, y0: 1.5, y1: 2.3 }, { room: 'shop', side: 'right', at: 2.5, width: 1.2, y0: 1.5, y1: 2.3 },
      { room: 'consulting_room', side: 'right', at: d - 1.8, width: 0.9, y0: 1.2, y1: 2.2 },
    ],
  }],
}
