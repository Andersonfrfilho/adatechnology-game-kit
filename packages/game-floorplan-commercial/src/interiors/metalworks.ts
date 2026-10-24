import type { SlotKit, TemplateDef } from '@adatechnology/game-floorplan'

import { buildingLot } from './lot'
import { spot } from './spot'
import type { FindsHint, InteriorModule } from './types'

const PRESSES = 4
const PALLET_RACKS = 3
const SHIPPING_DRUMS = 6
const CANTEEN_DEPTH = 4.5
const FRONT_DEPTH = 10
const RECEPTION_WIDTH = 10
const SHIPPING_WIDTH = 10
const LOCKER_STRIP_WIDTH = 3
const OFFICE_WIDTH = 8.5
const OFFICE_DEPTH = 3

const template: TemplateDef = {
  id: 'metalworks', use: 'industrial', place: 'metalworks', construction: 'masonry', partyWalls: [], style: 'commercial',
  limits: { w: [30, 36], d: [20, 24] }, defaults: { w: 30, d: 20 },
  lot: (w) => buildingLot({ backyard: 8, cargoU: w - 6, doorTarget: { a: 'reception', side: 'front' }, libraries: { backyard: 'backyard_service' } }),
  facade: { steelDoor: true },
  floors: [{
    label: 'ground_floor', ceiling: 8.0, openPairs: [['reception', 'storage']],
    rooms: (w, d) => {
      const production = [0, FRONT_DEPTH, w - LOCKER_STRIP_WIDTH, d - OFFICE_DEPTH]
      return [
        { id: 'canteen', type: 'dining', label: 'canteen', library: 'canteen', rect: [0, 0, RECEPTION_WIDTH, CANTEEN_DEPTH] },
        { id: 'reception', type: 'hall', label: 'reception', library: 'no_fixtures', rect: [RECEPTION_WIDTH, 0, w - SHIPPING_WIDTH, CANTEEN_DEPTH] },
        { id: 'shipping_bay', type: 'garage', label: 'shipping_bay', library: 'shipping_bay', rect: [w - SHIPPING_WIDTH, 0, w, FRONT_DEPTH] },
        { id: 'storage', type: 'stockroom', label: 'pallet_storage', library: 'pallet_storage', rect: [0, CANTEEN_DEPTH, w - SHIPPING_WIDTH, FRONT_DEPTH] },
        { id: 'production_floor', type: 'garage', label: 'production_floor', library: 'production_floor', rect: production, parts: [[OFFICE_WIDTH, d - OFFICE_DEPTH, w - LOCKER_STRIP_WIDTH, d]] },
        { id: 'office_mezzanine', type: 'office', label: 'office_mezzanine', library: 'mezzanine_office', rect: [0, d - OFFICE_DEPTH, OFFICE_WIDTH, d] },
        { id: 'locker_room', type: 'stockroom', label: 'locker_room', library: 'locker_room_works', rect: [w - LOCKER_STRIP_WIDTH, FRONT_DEPTH, w, d] },
      ]
    },
    doors: (w, d) => [
      { a: 'reception', b: 'outside', side: 'front', at: 15, width: 2.0, steel: true },
      { a: 'reception', b: 'canteen', at: RECEPTION_WIDTH + 0, width: 1.2, opensTo: 'canteen' },
      { a: 'storage', b: 'production_floor', at: 10, width: 3.0, opensTo: 'production_floor' },
      { a: 'shipping_bay', b: 'production_floor', at: w - 6.5, width: 3.0, opensTo: 'production_floor' },
      { a: 'shipping_bay', b: 'outside', side: 'front', at: w - 5, width: 3.4, model: 'rollup', steel: true },
      { a: 'production_floor', b: 'locker_room', at: 16, width: 1.0, opensTo: 'locker_room' },
      { a: 'production_floor', b: 'office_mezzanine', at: d - 1.5, width: 0.9, opensTo: 'office_mezzanine' },
      { a: 'production_floor', b: 'outside', side: 'back', at: w - 6, width: 5, model: 'rollup', steel: true },
    ],
    windows: (_w, _d) => [{ room: 'canteen', side: 'front', at: 5, width: 1.6, y0: 1.1, y1: 2.4 }],
  }],
}

const items = [
  { type: 'metal_press', category: 'metal_press', w: 2.2, d: 1.8, h: 4, exactOnly: true },
  { type: 'pallet_rack', category: 'pallet_rack', w: 4.5, d: 1.1, h: 4, exactOnly: true },
  { type: 'conveyor_line', category: 'conveyor', w: 16, d: 1.2, h: 1, exactOnly: true },
  { type: 'furnace', category: 'furnace', w: 2, d: 1.4, h: 1.4, exactOnly: true },
  { type: 'forklift', category: 'forklift', w: 1.3, d: 2.6, h: 2.6, exactOnly: true },
  { type: 'oil_drum', category: 'oil_drum', w: 0.76, d: 0.76, h: 0.95 },
  { type: 'locker_bank_6', category: 'locker', w: 2.52, d: 0.45, h: 1.8, exactOnly: true },
  { type: 'canteen_table', category: 'canteen_table', w: 3, d: 1, h: 0.75, exactOnly: true },
]

const libraries = (kit: SlotKit) => {
  const { wall, center, corner } = kit
  return {
    canteen: (room: { w: number; d: number }) => [
      ...[3, 7].map((u, index) => center('table_' + index, 0, 0, [3, 1], { '=canteen_table': 1 }, { required: true, facing: 'v+', clearance: 0, slide: 0, ...spot(room, u, 1.8) })),
      corner('fridge', 'back-left', [0.7, 0.68], { fridge: 1 }, { required: true, clearance: 0.3 }),
    ],
    shipping_bay: (room: { w: number; d: number }) => [
      center('forklift', 0, 0, [1.3, 2.6], { '=forklift': 1 }, { required: true, facing: 'v+', clearance: 0, slide: 0, ...spot(room, 5, 2.6) }),
      ...Array.from({ length: SHIPPING_DRUMS }, (_, index) => center('drum_' + index, 0, 0, [0.76, 0.76], { oil_drum: 1 }, { required: true, clearance: 0, slide: 0, ...spot(room, 5 + (index % 3) * 0.9, 6 + Math.floor(index / 3) * 0.9) })),
    ],
    pallet_storage: (room: { w: number; d: number }) => Array.from({ length: PALLET_RACKS }, (_, index) => center('rack_' + index, 0, 0, [4.5, 1.1], { '=pallet_rack': 1 }, { required: true, facing: 'v+', clearance: 0, slide: 0, ...spot(room, 5 + index * 6, 2.5) })),
    production_floor: (room: { w: number; d: number }) => [
      ...Array.from({ length: PRESSES }, (_, index) => center('press_' + index, 0, 0, [2.2, 1.8], { '=metal_press': 1 }, { required: true, facing: 'v-', clearance: 0, slide: 0, ...spot(room, 4 + index * 5, 6) })),
      center('conveyor', 0, 0, [16, 1.2], { '=conveyor_line': 1 }, { required: true, facing: 'v+', clearance: 0, slide: 0, ...spot(room, 19, 2.5) }),
      center('furnace', 0, 0, [2, 1.4], { '=furnace': 1 }, { required: true, facing: 'v-', clearance: 0, slide: 0, part: 1, fx: 0.55, fz: 0.5 }),
    ],
    mezzanine_office: () => [wall('desk', 'back', 0.3, [1.4, 0.7], { '=office_desk': 1 }, { required: true, clearance: 0.3, slide: 0 })],
    locker_room_works: () => [wall('lockers', 'right', 0.15, [2.52, 0.45], { '=locker_bank_6': 1 }, { required: true, clearance: 0.4, slide: 0 })],
  }
}

const hints: FindsHint[] = [
  { id: 'metalworks.lockers', kind: 'loot', room: 'locker_room', container: 'locker', tags: ['boots', 'helmet', 'gloves', 'work_uniforms'] },
  { id: 'metalworks.pallet_rack', kind: 'loot', room: 'storage', container: 'pallet_rack', tags: ['sheet_metal', 'nails', 'screws', 'ppe', 'base_material'] },
  { id: 'metalworks.office', kind: 'loot', room: 'office_mezzanine', container: 'office_desk', tags: ['generator_key', 'industrial_sewer_map'] },
  { id: 'metalworks.canteen', kind: 'loot', room: 'canteen', container: 'canteen_table', tags: ['lunchboxes'] },
]

export const metalworks: InteriorModule = { template, items, libraries, hints }
