import type { SlotKit, TemplateDef } from '@adatechnology/game-floorplan'

import { buildingLot } from './lot'
import { spot } from './spot'
import type { FindsHint, InteriorModule } from './types'

const template: TemplateDef = {
  id: 'drugstore', use: 'commercial', place: 'pharmacy', construction: 'masonry', partyWalls: ['left', 'right'], style: 'commercial',
  limits: { w: [11, 14], d: [9, 12] }, defaults: { w: 11, d: 9 },
  lot: () => buildingLot({ backyard: 4.0, cargoU: 4, doorTarget: { a: 'shop', side: 'front' } }),
  facade: { steelDoor: true },
  floors: [{
    label: 'ground_floor', ceiling: 3.2, openPairs: [['shop', 'dispensing']],
    rooms: (w, d) => [
      { id: 'shop', type: 'shop', label: 'shop', library: 'shop_drugstore', rect: [0, 0, w - 3, 5.6], parts: [[w - 3, 2.5, w, 5.6]] },
      { id: 'compounding_room', type: 'hall', label: 'compounding_room', library: 'compounding_room', rect: [w - 3, 0, w, 2.5] },
      { id: 'dispensing', type: 'stockroom', label: 'dispensing', library: 'dispensing', rect: [0, 5.6, w - 3, d], parts: [[w - 3, 5.6, w, d - 2.2]] },
      { id: 'controlled_storage', type: 'stockroom', label: 'controlled_storage', library: 'controlled_storage', rect: [w - 3, d - 2.2, w, d] },
    ],
    doors: (w, d) => [
      { a: 'shop', b: 'outside', side: 'front', at: 3.5, width: 2.4, steel: true },
      { a: 'shop', b: 'compounding_room', at: 1.0, width: 0.9, opensTo: 'compounding_room' },
      { a: 'dispensing', b: 'controlled_storage', at: d - 1.1, width: 0.9, model: 'bars', opensTo: 'controlled_storage' },
    ],
    windows: (_w, _d) => [
      { room: 'shop', side: 'front', at: 6.5, width: 1.2, y0: 1.1, y1: 2.4 },
      { room: 'compounding_room', side: 'front', at: 9.5, width: 1.0, y0: 1.2, y1: 2.2 },
    ],
  }],
}

const items = [
  { type: 'vaccine_fridge', category: 'vaccine_fridge', w: 0.6, d: 0.6, h: 1.6, color: { role: 'metal' } },
  { type: 'safe', category: 'safe', w: 0.6, d: 0.6, h: 0.7, color: { role: 'metal' } },
  { type: 'compounding_bench', category: 'compounding_bench', w: 2.6, d: 0.6, h: 1, window: true, exactOnly: true },
  { type: 'dispensing_counter', category: 'pharmacy_counter', w: 2, d: 0.7, h: 1, window: true, exactOnly: true },
]

const libraries = (kit: SlotKit) => {
  const { wall, center, corner } = kit
  return {
    shop_drugstore: () => [0, 0.5, 1].map((pos, index) => wall('shelf_' + index, 'left', pos, [1.8, 0.45], { wall_shelving: 1 }, { required: true, clearance: 0.5, slide: 0 })),
    dispensing: (room: { w: number; d: number }) => [
      ...[2.2, 4.3, 6.4].map((u, index) => center('counter_' + index, 0, 0, [2, 0.7], { '=dispensing_counter': 1 }, { required: true, facing: 'v-', clearance: 0, slide: 0, ...spot(room, u, 0.55) })),
      ...[0, 0.34, 0.66, 1].map((pos, index) => wall('back_shelf_' + index, 'back', pos, [1.8, 0.4], { wall_shelving: 1 }, { required: true, clearance: 0.4, slide: 0 })),
    ],
    compounding_room: () => [
      wall('bench', 'back', 0.5, [2.6, 0.6], { '=compounding_bench': 1 }, { required: true, clearance: 0.4, slide: 0 }),
      corner('scale', 'front-right', [0.4, 0.4], { scale: 1 }, { required: true, clearance: 0 }),
    ],
    controlled_storage: () => [
      wall('rack', 'back', 0.3, [1.8, 0.5], { metal_shelf: 1 }, { required: true, clearance: 0.3, slide: 0 }),
      corner('vaccine_fridge', 'back-right', [0.6, 0.6], { vaccine_fridge: 1 }, { required: true, clearance: 0.2 }),
      corner('safe', 'front-right', [0.6, 0.6], { safe: 1 }, { required: true, clearance: 0.2 }),
    ],
  }
}

const hints: FindsHint[] = [
  { id: 'drugstore.controlled', kind: 'loot', room: 'controlled_storage', container: 'metal_shelf', tags: ['antibiotic', 'strong_painkiller', 'needs_crowbar'] },
  { id: 'drugstore.vaccines', kind: 'loot', room: 'controlled_storage', container: 'vaccine_fridge', tags: ['insulin', 'vaccine', 'spoils_without_power'] },
  { id: 'drugstore.safe', kind: 'loot', room: 'controlled_storage', container: 'safe', tags: ['controlled_drugs', 'high_value'] },
  { id: 'drugstore.compounding', kind: 'loot', room: 'compounding_room', container: 'compounding_bench', tags: ['alcohol', 'scale', 'bottles', 'crafting_bench'] },
  { id: 'drugstore.shelf', kind: 'loot', room: 'shop', container: 'wall_shelving', tags: ['bandages', 'alcohol', 'antiseptic', 'vitamins'] },
]

export const drugstore: InteriorModule = { template, items, libraries, hints }
