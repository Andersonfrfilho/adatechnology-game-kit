import type { SlotKit, TemplateDef } from '@adatechnology/game-floorplan'

import { buildingLot } from './lot'
import { spot } from './spot'
import type { FindsHint, InteriorModule } from './types'

const HOUSE_WIDTH = 12
const HOUSE_DEPTH = 9
const LIVING_DEPTH = 4
const KITCHEN_WIDTH = 7
const FRONT_YARD_DEPTH = 22
const SIDE_YARD_WIDTH = 32
const BACK_YARD_DEPTH = 16
const HAY_BALES = 10

const template: TemplateDef = {
  id: 'farm', use: 'agricultural', place: 'farm', construction: 'masonry', partyWalls: [], style: 'farm',
  limits: { w: [HOUSE_WIDTH, HOUSE_WIDTH], d: [HOUSE_DEPTH, HOUSE_DEPTH] }, defaults: { w: HOUSE_WIDTH, d: HOUSE_DEPTH },
  lot: () => buildingLot({ frontSetback: FRONT_YARD_DEPTH, marginRight: SIDE_YARD_WIDTH, backyard: BACK_YARD_DEPTH, pedestrian: { u: 6 }, doorTarget: { a: 'living_room', side: 'front' }, libraries: { garden: 'farm_front', sideYard: 'farm_side', backyard: 'farm_back' } }),
  facade: { veranda: true },
  floors: [{
    label: 'ground_floor', ceiling: 3.0,
    rooms: (w, d) => [
      { id: 'living_room', type: 'living', label: 'living_room', library: 'farm_living', rect: [0, 0, w, LIVING_DEPTH] },
      { id: 'kitchen', type: 'kitchen', label: 'farm_kitchen', library: 'farm_kitchen', rect: [0, LIVING_DEPTH, KITCHEN_WIDTH, d] },
      { id: 'bedroom', type: 'bedroom', label: 'bedroom', library: 'farm_bedroom', rect: [KITCHEN_WIDTH, LIVING_DEPTH, w, d] },
    ],
    doors: (w, _d) => [
      { a: 'living_room', b: 'outside', side: 'front', at: w / 2, width: 1.0 },
      { a: 'living_room', b: 'kitchen', at: 3.5, width: 0.9, opensTo: 'kitchen' },
      { a: 'living_room', b: 'bedroom', at: 8, width: 0.8, opensTo: 'bedroom' },
    ],
    windows: (_w, _d) => [
      { room: 'living_room', side: 'front', at: 2, width: 1.4, y0: 1.0, y1: 2.1 },
      { room: 'bedroom', side: 'back', at: HOUSE_WIDTH - 2.5, width: 1.4, y0: 1.0, y1: 2.1 },
    ],
  }],
}

const items = [
  { type: 'wood_stove', category: 'wood_stove', w: 1.6, d: 0.8, h: 3.1, exactOnly: true },
  { type: 'farm_table', category: 'farm_table', w: 2, d: 1, h: 0.75, exactOnly: true },
  { type: 'hammock', category: 'hammock', w: 0.8, d: 2.6, h: 1.2, low: true, window: true, exactOnly: true },
  { type: 'veranda_post', category: 'veranda_post', w: 0.15, d: 0.15, h: 3.2, low: true, exactOnly: true },
  { type: 'chicken_coop', category: 'chicken_coop', w: 4, d: 3, h: 1.6, exactOnly: true },
  { type: 'corral', category: 'corral', w: 22, d: 10, h: 1.3, flat: true, exactOnly: true },
  { type: 'farm_well', category: 'farm_well', w: 2, d: 2, h: 2.3, exactOnly: true },
  { type: 'tractor', category: 'tractor', w: 2, d: 3.2, h: 2.6, exactOnly: true },
  { type: 'barn', category: 'barn', w: 10, d: 14, h: 10, exactOnly: true },
  { type: 'silo', category: 'silo', w: 6, d: 6, h: 12, exactOnly: true },
  { type: 'hay_bale', category: 'hay_bale', w: 1.2, d: 1.2, h: 1.2, exactOnly: true },
  { type: 'machine_shed', category: 'machine_shed', w: 11, d: 9, h: 4, exactOnly: true },
  { type: 'scarecrow', category: 'scarecrow', w: 0.6, d: 0.6, h: 2.6, exactOnly: true },
]

const libraries = (kit: SlotKit) => {
  const { wall, center, corner } = kit
  return {
    farm_living: () => [
      wall('pantry', 'left', 0.9, [1.2, 0.4], { pantry: 1 }, { required: true, clearance: 0.4, slide: 0 }),
    ],
    farm_kitchen: (room: { w: number; d: number }) => [
      corner('wood_stove', 'back-left', [1.6, 0.8], { '=wood_stove': 1 }, { required: true, facing: 'v-', clearance: 0.4 }),
      center('table', 0, 0, [2, 1], { '=farm_table': 1 }, { required: true, facing: 'v+', clearance: 0.4, slide: 0, ...spot(room, 4, 2.2) }),
    ],
    farm_bedroom: () => [
      wall('bed', 'back', 0.3, [1.6, 2.05], { '=double_bed': 1 }, { required: true, clearance: 0.4, slide: 0 }),
      corner('hammock', 'front-right', [0.8, 2.6], { '=hammock': 1 }, { required: true, facing: 'v+', clearance: 0.2 }),
    ],
    farm_front: (room: { w: number; d: number }) => [
      ...[0.5, 11.5].map((u, index) => center('veranda_post_' + index, 0, 0, [0.15, 0.15], { '=veranda_post': 1 }, { required: true, clearance: 0, slide: 0, ...spot(room, u, room.d - 1.2) })),
      center('well', 0, 0, [2, 2], { '=farm_well': 1 }, { required: true, clearance: 0.3, slide: 0, ...spot(room, 4, room.d - 5) }),
      center('chicken_coop', 0, 0, [4, 3], { '=chicken_coop': 1 }, { required: true, facing: 'v+', clearance: 0.3, slide: 0, ...spot(room, 20, room.d - 7.5) }),
      center('corral', 0, 0, [22, 10], { '=corral': 1 }, { required: true, facing: 'v+', clearance: 0, slide: 0, ...spot(room, 30, room.d - 15) }),
    ],
    farm_side: () => [center('tractor', 0.4, 0.5, [2, 3.2], { '=tractor': 1 }, { required: true, facing: 'v+', clearance: 0.4 })],
    farm_back: (room: { w: number; d: number }) => [
      center('barn', 0, 0, [10, 14], { '=barn': 1 }, { required: true, facing: 'v-', clearance: 0.5, slide: 0, ...spot(room, 28, 7.5) }),
      center('silo', 0, 0, [6, 6], { '=silo': 1 }, { required: true, clearance: 0.5, slide: 0, ...spot(room, 40, 5) }),
      center('machine_shed', 0, 0, [11, 9], { '=machine_shed': 1 }, { required: true, facing: 'v-', clearance: 0.5, slide: 0, ...spot(room, 6.5, 5) }),
      center('second_tractor', 0, 0, [2, 3.2], { '=tractor': 1 }, { required: true, facing: 'v+', clearance: 0.4, slide: 0, ...spot(room, 6.5, 12.5) }),
      center('scarecrow', 0, 0, [0.6, 0.6], { '=scarecrow': 1 }, { required: true, clearance: 0, slide: 0, ...spot(room, 13, 12.5) }),
      ...Array.from({ length: HAY_BALES }, (_, index) => center('hay_bale_' + index, 0, 0, [1.2, 1.2], { '=hay_bale': 1 }, { required: true, clearance: 0, slide: 0, ...spot(room, 14.5 + (index % 5) * 1.5, 2.5 + Math.floor(index / 5) * 1.5) })),
    ],
  }
}

const hints: FindsHint[] = [
  { id: 'farm.kitchen', kind: 'loot', room: 'kitchen', container: 'wood_stove', tags: ['food_for_weeks', 'firewood'] },
  { id: 'farm.machine_shed', kind: 'loot', room: 'backyard', container: 'machine_shed', tags: ['second_tractor', 'plough', 'tools', 'diesel'] },
  { id: 'farm.barn', kind: 'loot', room: 'backyard', container: 'barn', tags: ['tools', 'sickle', 'axe', 'tractor_fuel', 'hay_bales_flammable'] },
  { id: 'farm.well', kind: 'loot', room: 'garden', container: 'farm_well', tags: ['endless_water', 'base_site'] },
  { id: 'farm.tractor', kind: 'loot', room: 'side_right', container: 'tractor', tags: ['pulls_cart', 'knocks_down_fences', 'crushes_zombies', 'loud'] },
]

export const farm: InteriorModule = { template, items, libraries, hints }
