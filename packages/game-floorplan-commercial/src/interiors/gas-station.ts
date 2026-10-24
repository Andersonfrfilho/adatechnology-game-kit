import type { SlotKit, TemplateDef } from '@adatechnology/game-floorplan'

import { buildingLot } from './lot'
import { along, spot } from './spot'
import type { FindsHint, InteriorModule } from './types'

const STORE_WIDTH = 14
const STORE_AISLES = 3
const COOLER_DOORS = 4
const OIL_BAY_WIDTH = 6
const PUMP_ISLANDS = 3
const OIL_DRUMS = 4

const template: TemplateDef = {
  id: 'gas_station', use: 'commercial', place: 'gas_station', construction: 'masonry', partyWalls: [], style: 'commercial',
  limits: { w: [22, 26], d: [7, 9] }, defaults: { w: 22, d: 7 },
  lot: () => buildingLot({ frontSetback: 12, garage: { u: 4, width: 3.5 }, backyard: 3, cargoU: STORE_WIDTH - 3, doorTarget: { a: 'convenience_store', side: 'front' }, libraries: { garden: 'forecourt', backyard: 'backyard_service' } }),
  facade: {},
  floors: [{
    label: 'ground_floor', ceiling: 3.0,
    rooms: (w, d) => [
      { id: 'convenience_store', type: 'shop', label: 'convenience_store', library: 'convenience_store', rect: [0, 0, STORE_WIDTH, d] },
      { id: 'restroom', type: 'bathroom', label: 'restroom', library: 'restroom_wc', rect: [STORE_WIDTH, 0, STORE_WIDTH + 2, 2] },
      { id: 'utility', type: 'stockroom', label: 'utility', library: 'utility_room', rect: [STORE_WIDTH, 2, STORE_WIDTH + 2, d] },
      { id: 'oil_bay', type: 'garage', label: 'oil_bay', library: 'oil_bay', rect: [STORE_WIDTH + 2, 0, w, d] },
    ],
    doors: (w, d) => [
      { a: 'convenience_store', b: 'outside', side: 'front', at: 4.5, width: 1.6, model: 'glass' },
      { a: 'restroom', b: 'outside', side: 'front', at: STORE_WIDTH + 1, width: 0.8 },
      { a: 'convenience_store', b: 'utility', at: d - 1.5, width: 0.9, opensTo: 'utility' },
      { a: 'oil_bay', b: 'outside', side: 'front', at: STORE_WIDTH + 2 + OIL_BAY_WIDTH / 2, width: 3.4, model: 'rollup', steel: true },
      { a: 'oil_bay', b: 'utility', at: 3.5, width: 0.9, opensTo: 'utility' },
      { a: 'utility', b: 'outside', side: 'back', at: STORE_WIDTH + 1, width: 0.9, steel: true },
    ],
    windows: (_w, _d) => [{ room: 'convenience_store', side: 'front', at: 10, width: 1.6, y0: 1.1, y1: 2.4 }],
  }],
}

const items = [
  { type: 'convenience_aisle', category: 'gondola_shelf', w: 0.5, d: 4, h: 1.6, exactOnly: true },
  { type: 'convenience_counter', category: 'checkout_counter', w: 2.2, d: 0.8, h: 1, window: true, exactOnly: true },
  { type: 'fuel_pump_island', category: 'fuel_pump', w: 1.2, d: 3.4, h: 1.9, exactOnly: true },
  { type: 'canopy_column', category: 'canopy_column', w: 0.5, d: 0.5, h: 5, exactOnly: true },
  { type: 'lift_post', category: 'car_lift', w: 0.25, d: 0.25, h: 2.2, exactOnly: true },
  { type: 'oil_drum', category: 'oil_drum', w: 0.76, d: 0.76, h: 0.95 },
]

const libraries = (kit: SlotKit) => {
  const { wall, center, on } = kit
  return {
    convenience_store: (room: { w: number; d: number }) => [
      ...Array.from({ length: STORE_AISLES }, (_, index) => center('aisle_' + index, 0, 0, [0.5, 4], { '=convenience_aisle': 1 }, { required: true, facing: 'v+', clearance: 0, slide: 0, ...spot(room, 3 + index * 3, 3.5) })),
      center('counter', 0, 0, [2.2, 0.8], { '=convenience_counter': 1 }, { required: true, facing: 'u-', clearance: 0.4, slide: 0, ...spot(room, 11.6, 2.5) }),
      on('register', 'counter', { cash_register: 1 }, { required: true }),
      ...Array.from({ length: COOLER_DOORS }, (_, index) => wall('cooler_' + index, 'back', along(room.w, 0.9, 9.7 + index * 0.9 + 0.45), [0.9, 0.7], { '=display_fridge': 1 }, { required: true, clearance: 0.3, slide: 0 })),
    ],
    restroom_wc: () => [
      wall('toilet', 'back', 0.1, [0.5, 0.75], { '=toilet': 1 }, { required: true, clearance: 0.2, slide: 0 }),
      wall('washbasin', 'back', 0.9, [0.8, 0.5], { '=washbasin': 1 }, { required: true, clearance: 0.2, slide: 0 }),
    ],
    utility_room: () => [wall('tools', 'right', 0, [1.4, 0.45], { tool_shelf: 1 }, { required: true, clearance: 0.3, slide: 0 })],
    oil_bay: (room: { w: number; d: number }) => [
      ...[1.5, 4.5].map((u, index) => center('lift_post_' + index, 0, 0, [0.25, 0.25], { '=lift_post': 1 }, { required: true, clearance: 0, ...spot(room, u, 3.5) })),
      wall('rack', 'right', 0.85, [1.8, 0.5], { metal_shelf: 1 }, { required: true, clearance: 0.3, slide: 0 }),
      ...Array.from({ length: OIL_DRUMS }, (_, index) => center('drum_' + index, 0, 0, [0.76, 0.76], { oil_drum: 1 }, { required: true, clearance: 0, slide: 0, ...spot(room, 0.8 + (index % 2) * 0.85, 5.3 + Math.floor(index / 2) * 0.85) })),
    ],
    forecourt: (room: { w: number; d: number }) => [
      ...Array.from({ length: PUMP_ISLANDS }, (_, index) => center('pump_island_' + index, 0, 0, [1.2, 3.4], { '=fuel_pump_island': 1 }, { required: true, facing: 'v+', clearance: 0, slide: 0, ...spot(room, 1 + index * 6, 5.5) })),
      ...[0, 1].flatMap((side) => [0, 1].map((row) => center('canopy_column_' + side + row, 0, 0, [0.5, 0.5], { '=canopy_column': 1 }, { required: true, clearance: 0, slide: 0, ...spot(room, 1 + side * 12, 2.5 + row * 6) }))),
    ],
  }
}

const hints: FindsHint[] = [
  { id: 'gas_station.convenience', kind: 'loot', room: 'convenience_store', container: 'gondola_shelf', tags: ['snacks', 'lighters', 'cigarettes', 'road_map'] },
  { id: 'gas_station.oil_change', kind: 'loot', room: 'oil_bay', container: 'metal_shelf', tags: ['jerrycans', 'motor_oil', 'hydraulic_jack'] },
]

export const gasStation: InteriorModule = { template, items, libraries, hints }
