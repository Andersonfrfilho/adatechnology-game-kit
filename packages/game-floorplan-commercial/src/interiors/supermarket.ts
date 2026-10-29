import type { SlotKit, TemplateDef } from '@adatechnology/game-floorplan'

import { buildingLot } from './lot'
import type { FindsHint, InteriorModule } from './types'

const template: TemplateDef = {
  id: 'supermarket', use: 'commercial', place: 'supermarket', construction: 'masonry', partyWalls: ['left', 'right'], style: 'commercial',
  limits: { w: [18, 24], d: [13, 18] }, defaults: { w: 18, d: 13 },
  lot: (w) => buildingLot({ cargoU: w - 3.5, doorTarget: { a: 'checkouts', side: 'front' } }),
  facade: { steelDoor: true },
  floors: [{
    label: 'ground_floor', ceiling: 3.4, openPairs: [['checkouts', 'shop'], ['shop', 'bakery']],
    rooms: (w, d) => [
      { id: 'checkouts', type: 'counter', label: 'checkouts', library: 'counter_supermarket', rect: [0, 0, w - 5, 2.9] },
      { id: 'service_corridor', type: 'corridor', label: 'service_corridor', library: 'no_fixtures', rect: [w - 5, 0, w - 3, 1.9] },
      { id: 'office', type: 'office', label: 'manager_office', library: 'office_manager', rect: [w - 3, 0, w, 1.9] },
      { id: 'stockroom', type: 'stockroom', label: 'stockroom', library: 'stockroom_supermarket', rect: [w - 5, 1.9, w, 5.5] },
      { id: 'bakery', type: 'shop', label: 'bakery', library: 'bakery', rect: [w - 5, 5.5, w, 8.5] },
      { id: 'butcher', type: 'stockroom', label: 'butcher', library: 'butcher', rect: [w - 5, 8.5, w, d] },
      { id: 'shop', type: 'shop', label: 'shop', library: 'shop_supermarket', rect: [0, 2.9, w - 5, d] },
    ],
    doors: (w, _d) => [
      { a: 'checkouts', b: 'outside', side: 'front', at: 1.6, width: 1.6, model: 'automatic' },
      { a: 'checkouts', b: 'service_corridor', width: 1.0, opensTo: 'service_corridor' },
      { a: 'service_corridor', b: 'office', width: 0.9, opensTo: 'office' },
      { a: 'stockroom', b: 'bakery', at: w - 1.5, width: 1.4, opensTo: 'bakery' },
      { a: 'bakery', b: 'butcher', at: w - 4, width: 1.2, opensTo: 'butcher' },
      { a: 'butcher', b: 'outside', side: 'back', at: w - 3.5, width: 1.6, steel: true },
    ],
    windows: (_w, _d) => [
      { room: 'checkouts', side: 'front', at: 8, width: 1.6, y0: 1.1, y1: 2.5 }, { room: 'shop', side: 'left', at: 8, width: 1.2, y0: 1.6, y1: 2.4 },
    ],
  }],
}

const items = [
  { type: 'gondola_run', category: 'gondola_shelf', w: 7, d: 0.9, h: 1.8, exactOnly: true },
  { type: 'checkout_lane', category: 'checkout_counter', w: 1.2, d: 2, h: 1, window: true, exactOnly: true },
  { type: 'bakery_counter', category: 'bakery_counter', w: 3.8, d: 0.8, h: 1.1 },
  { type: 'butcher_counter', category: 'butcher_counter', w: 3.6, d: 1, h: 1.1 },
  { type: 'cold_chamber', category: 'cold_chamber', w: 1.2, d: 1.2, h: 2.3, color: { role: 'metal' } },
  { type: 'safe', category: 'safe', w: 0.6, d: 0.6, h: 0.7, color: { role: 'metal' } },
]

const libraries = (kit: SlotKit) => {
  const { wall, center, corner, on } = kit
  return {
    shop_supermarket: () => [
      ...[0.1, 0.3, 0.5, 0.7].map((fz, index) => center('gondola_' + index, 0.5, fz, [7, 0.9], { '=gondola_run': 1 }, { required: true, facing: 'v+', clearance: 0.5 })),
      ...[0, 0.2, 0.4, 0.6, 0.8, 1].map((pos, index) => wall('wall_shelving_' + index, 'back', pos, [1.8, 0.4], { wall_shelving: 1 }, { required: true, clearance: 0.5 })),
      wall('freezer_1', 'left', 0.25, [1.6, 0.8], { freezer: 1 }, { required: true, clearance: 0.9 }),
      wall('freezer_2', 'left', 0.75, [1.6, 0.8], { freezer: 1 }, { required: true, clearance: 0.9 }),
    ],
    counter_supermarket: () => [
      ...[0.3, 0.55, 0.8].flatMap((fx, index) => [
        center('checkout_' + index, fx, 0.37, [1.2, 2.0], { '=checkout_lane': 1 }, { required: true, facing: 'v+', clearance: 0 }),
        on('register_' + index, 'checkout_' + index, { cash_register: 1 }, { required: true }),
      ]),
      corner('baskets', 'front-left', [0.6, 0.5], { baskets: 1 }, { clearance: 0 }),
      corner('carts', 'front-right', [0.7, 1.0], { shopping_cart: 1 }, { chance: 0.7, clearance: 0 }),
    ],
    office_manager: () => [
      wall('desk', 'back', 0.5, [1.4, 0.7], { '=office_desk': 1 }, { required: true, clearance: 0.4 }),
      corner('safe', 'front-right', [0.6, 0.6], { safe: 1 }, { required: true, clearance: 0.3 }),
    ],
    stockroom_supermarket: () => [
      wall('rack', 'front', 0.5, [4.4, 0.5], { metal_shelf: 1 }, { required: true, clearance: 0.8 }),
      center('crates', 0.5, 0.45, [1.3, 1.1], { pallet: 1, boxes: 2 }, { chance: 0.9, clearance: 0 }),
    ],
    bakery: () => [
      center('bakery_counter', 0.5, 0.5, [3.8, 0.8], { bakery_counter: 1 }, { required: true, facing: 'v+', clearance: 0.5 }),
    ],
    butcher: () => [
      center('butcher_counter', 0.5, 0.45, [4.8, 1], { butcher_counter: 1 }, { required: true, facing: 'v-', clearance: 0.5 }),
      corner('cold_chamber', 'back-right', [1.2, 1.2], { cold_chamber: 1 }, { required: true, clearance: 0.5 }),
    ],
  }
}

const hints: FindsHint[] = [
  { id: 'supermarket.gondola', kind: 'loot', room: 'shop', container: 'gondola_shelf', tags: ['spices', 'batteries', 'cleaning'] },
  { id: 'supermarket.bakery', kind: 'loot', room: 'bakery', container: 'bakery_counter', tags: ['flour', 'yeast', 'sugar'] },
  { id: 'supermarket.office', kind: 'loot', room: 'office', container: 'safe', tags: ['dock_key', 'safe', 'supplier_list'] },
  { id: 'supermarket.butcher', kind: 'loot', room: 'butcher', container: 'butcher_counter', tags: ['cleaver', 'boning_knife', 'trash_bags'] },
  { id: 'supermarket.stockroom', kind: 'loot', room: 'stockroom', container: 'metal_shelf', tags: ['water_cases', 'canned_food'] },
]

export const supermarket: InteriorModule = { template, items, libraries, hints }
