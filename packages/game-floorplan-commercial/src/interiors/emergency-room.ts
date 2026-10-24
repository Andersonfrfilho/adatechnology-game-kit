import type { SlotKit, TemplateDef } from '@adatechnology/game-floorplan'

import { buildingLot } from './lot'
import { along, spot } from './spot'
import type { FindsHint, InteriorModule } from './types'

const WARD_WIDTH = 8
const ICU_WIDTH = 2
const FRONT_DEPTH = 6.5
const OXYGEN_CYLINDERS = 6

const template: TemplateDef = {
  id: 'emergency_room', use: 'institutional', place: 'emergency_room', construction: 'masonry', partyWalls: ['left', 'right'], style: 'commercial',
  limits: { w: [18, 24], d: [11, 14] }, defaults: { w: 18, d: 11 },
  lot: (w) => buildingLot({ backyard: 5, cargoU: w - 3.5, doorTarget: { a: 'emergency_room', side: 'front' } }),
  facade: {},
  floors: [{
    label: 'ground_floor', ceiling: 3.0,
    rooms: (w, d) => [
      { id: 'emergency_room', type: 'living', label: 'emergency_room', library: 'emergency_floor', rect: [0, 0, w, FRONT_DEPTH] },
      { id: 'ward_a', type: 'bedroom', label: 'ward_a', library: 'ward', rect: [0, FRONT_DEPTH, WARD_WIDTH, d] },
      { id: 'icu', type: 'bedroom', label: 'icu', library: 'icu', rect: [WARD_WIDTH, FRONT_DEPTH, WARD_WIDTH + ICU_WIDTH, d] },
      { id: 'ward_b', type: 'bedroom', label: 'ward_b', library: 'ward', rect: [WARD_WIDTH + ICU_WIDTH, FRONT_DEPTH, w, d] },
    ],
    doors: (w, _d) => [
      { a: 'emergency_room', b: 'outside', side: 'front', at: w / 2, width: 2.0 },
      { a: 'emergency_room', b: 'ward_a', at: 4, width: 1.2, opensTo: 'ward_a' },
      { a: 'emergency_room', b: 'icu', at: WARD_WIDTH + ICU_WIDTH / 2, width: 1.0, model: 'glass', opensTo: 'icu' },
      { a: 'emergency_room', b: 'ward_b', at: WARD_WIDTH + ICU_WIDTH + 4, width: 1.2, opensTo: 'ward_b' },
      { a: 'ward_b', b: 'outside', side: 'back', at: w - 1.5, width: 1.2, steel: true },
    ],
    windows: (_w, _d) => [],
  }],
}

const items = [
  { type: 'stretcher', category: 'stretcher', w: 0.75, d: 2, h: 0.8, window: true },
  { type: 'hospital_bed', category: 'hospital_bed', w: 0.9, d: 2.1, h: 0.9, window: true },
  { type: 'patient_monitor', category: 'patient_monitor', w: 0.5, d: 0.3, h: 0.5, low: true, window: true },
  { type: 'crash_cart', category: 'crash_cart', w: 0.8, d: 0.6, h: 1, window: true },
  { type: 'oxygen_cylinder', category: 'oxygen_cylinder', w: 0.36, d: 0.36, h: 1.4, low: true },
  { type: 'medicine_cabinet', category: 'medicine_cabinet', w: 1, d: 0.45, h: 1.8 },
]

const libraries = (kit: SlotKit) => {
  const { wall, center } = kit
  return {
    emergency_floor: (room: { w: number; d: number }) => [
      ...[2.5, 5, 7.5].map((u, index) => center('stretcher_' + index, 0, 0, [0.75, 2], { stretcher: 1 }, { required: true, facing: 'u+', clearance: 0, slide: 0, ...spot(room, u, 2.4) })),
      center('crash_cart', 0, 0, [0.8, 0.6], { crash_cart: 1 }, { required: true, facing: 'v+', clearance: 0.3, ...spot(room, 10.5, 1.6) }),
      ...Array.from({ length: OXYGEN_CYLINDERS }, (_, index) => center('oxygen_' + index, 0, 0, [0.36, 0.36], { oxygen_cylinder: 1 }, { required: true, clearance: 0, ...spot(room, 15.5 + (index % 3) * 0.5, 1.3 + Math.floor(index / 3) * 0.5) })),
    ],
    ward: (room: { w: number; d: number }) => [
      ...[1.6, 5].map((u, index) => center('bed_' + index, 0, 0, [0.9, 2.1], { hospital_bed: 1 }, { required: true, facing: 'v+', clearance: 0, slide: 0, ...spot(room, u, 2.6) })),
      ...[1.6, 5].map((u, index) => wall('monitor_' + index, 'back', along(room.w, 0.5, u), [0.5, 0.3], { patient_monitor: 1 }, { required: true, clearance: 0, slide: 0 })),
      wall('medicine_cabinet', 'left', 0.2, [1, 0.45], { medicine_cabinet: 1 }, { required: true, clearance: 0.4, slide: 0 }),
    ],
    icu: (room: { w: number; d: number }) => [
      center('bed', 0, 0, [0.9, 2.1], { hospital_bed: 1 }, { required: true, facing: 'v+', clearance: 0, slide: 0, ...spot(room, 1, 2.6) }),
      wall('monitor', 'back', 0.5, [0.5, 0.3], { patient_monitor: 1 }, { required: true, clearance: 0, slide: 0 }),
    ],
  }
}

const hints: FindsHint[] = [
  { id: 'emergency_room.crash_cart', kind: 'loot', room: 'emergency_room', container: 'crash_cart', tags: ['suture_kit', 'saline', 'strong_painkiller'] },
  { id: 'emergency_room.ward_a', kind: 'loot', room: 'ward_a', container: 'medicine_cabinet', tags: ['monitors', 'sheets', 'medicine'] },
  { id: 'emergency_room.ward_b', kind: 'loot', room: 'ward_b', container: 'medicine_cabinet', tags: ['monitors', 'sheets', 'medicine'] },
]

export const emergencyRoom: InteriorModule = { template, items, libraries, hints }
