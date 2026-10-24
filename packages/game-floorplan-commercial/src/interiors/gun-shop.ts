import type { SlotKit, TemplateDef } from '@adatechnology/game-floorplan'

import { buildingLot } from './lot'
import { spot } from './spot'
import type { FindsHint, InteriorModule } from './types'

const RANGE_LANES = 4
const RANGE_WIDTH = 8

const template: TemplateDef = {
  id: 'gun_shop', use: 'commercial', place: 'gun_shop', construction: 'masonry', partyWalls: ['left', 'right'], style: 'commercial',
  limits: { w: [20, 24], d: [9, 12] }, defaults: { w: 20, d: 9 },
  lot: (w) => buildingLot({ backyard: 4.0, cargoU: w - 4, doorTarget: { a: 'sales_floor', side: 'front' } }),
  facade: { steelDoor: true },
  floors: [{
    label: 'ground_floor', ceiling: 3.2,
    rooms: (w, d) => [
      { id: 'sales_floor', type: 'shop', label: 'sales_floor', library: 'sales_floor_guns', rect: [0, 0, w - RANGE_WIDTH, d - 2], parts: [[0, d - 2, w - RANGE_WIDTH - 2.4, d]] },
      { id: 'vault', type: 'stockroom', label: 'vault', library: 'vault', rect: [w - RANGE_WIDTH - 2.4, d - 2, w - RANGE_WIDTH, d] },
      { id: 'shooting_range', type: 'hall', label: 'shooting_range', library: 'shooting_range', rect: [w - RANGE_WIDTH, 0, w, d] },
    ],
    doors: (w, d) => [
      { a: 'sales_floor', b: 'outside', side: 'front', at: 6, width: 1.6, steel: true },
      { a: 'sales_floor', b: 'shooting_range', at: 0.9, width: 1.0, opensTo: 'shooting_range' },
      { a: 'sales_floor', b: 'vault', at: d - 1.2, width: 0.9, model: 'vault', steel: true, opensTo: 'vault' },
    ],
    windows: (_w, _d) => [
      { room: 'sales_floor', side: 'front', at: 2.5, width: 1.4, y0: 1.2, y1: 2.4 }, { room: 'sales_floor', side: 'front', at: 9.5, width: 1.4, y0: 1.2, y1: 2.4 },
    ],
  }],
}

const items = [
  { type: 'long_gun_rack', category: 'gun_rack', w: 9, d: 0.3, h: 2.2, exactOnly: true },
  { type: 'gun_counter', category: 'gun_counter', w: 7, d: 0.7, h: 1, window: true, exactOnly: true },
  { type: 'reload_bench', category: 'reload_bench', w: 2.2, d: 0.8, h: 1, window: true, exactOnly: true },
  { type: 'trophy_head', category: 'trophy', w: 0.6, d: 0.2, h: 0.6, low: true, window: true },
  { type: 'camo_rack', category: 'camo_rack', w: 1.6, d: 0.5, h: 1.6 },
  { type: 'vault_shelf', category: 'vault_shelf', w: 1.8, d: 0.5, h: 2, exactOnly: true },
  { type: 'shooting_bench', category: 'shooting_bench', w: 0.5, d: 0.8, h: 1, window: true },
  { type: 'target_frame', category: 'target_frame', w: 0.7, d: 0.15, h: 1.1, low: true, window: true },
]

const libraries = (kit: SlotKit) => {
  const { wall, center, corner } = kit
  return {
    sales_floor_guns: (room: { w: number; d: number }) => [
      wall('gun_rack', 'back', 0.1, [9, 0.3], { '=long_gun_rack': 1 }, { part: 1, required: true, clearance: 0.5, slide: 0 }),
      center('counter', 0, 0, [7, 0.7], { '=gun_counter': 1 }, { required: true, facing: 'v+', clearance: 0.5, slide: 0, ...spot(room, 6, room.d - 3.2) }),
      center('reload_bench', 0, 0, [2.2, 0.8], { '=reload_bench': 1 }, { required: true, facing: 'v+', clearance: 0.4, slide: 0, ...spot(room, 10.4, room.d - 4.2) }),
      ...[0.29, 0.68, 1].map((pos, index) => wall('trophy_' + index, 'left', pos, [0.6, 0.2], { trophy: 1 }, { required: true, clearance: 0, slide: 0 })),
      corner('camo_rack', 'front-left', [1.6, 0.5], { camo_rack: 1 }, { required: true, facing: 'v+', clearance: 0.5 }),
    ],
    vault: () => [wall('shelf', 'back', 0.5, [1.8, 0.5], { '=vault_shelf': 1 }, { required: true, clearance: 0.3, slide: 0 })],
    shooting_range: (room: { w: number; d: number }) => [
      ...Array.from({ length: RANGE_LANES }, (_, lane) => center('booth_' + lane, 0, 0, [0.5, 0.8], { shooting_bench: 1 }, { required: true, facing: 'u+', clearance: 0, slide: 0, ...spot(room, 1, 2.5 + lane * 2) })),
      ...Array.from({ length: RANGE_LANES }, (_, lane) => center('target_' + lane, 0, 0, [0.7, 0.15], { target_frame: 1 }, { required: true, facing: 'u-', clearance: 0, slide: 0, ...spot(room, room.w - 0.6, 2.5 + lane * 2) })),
    ],
  }
}

const hints: FindsHint[] = [
  { id: 'gun_shop.long_guns', kind: 'loot', room: 'sales_floor', container: 'gun_rack', tags: ['shotgun_12ga', 'rifle_22', 'hunting_carbine', 'ammo_by_caliber'] },
  { id: 'gun_shop.showcase', kind: 'loot', room: 'sales_floor', container: 'gun_counter', tags: ['revolver_38', 'pistol_9mm', 'pistol_40', 'holsters', 'sights'] },
  { id: 'gun_shop.camo', kind: 'loot', room: 'sales_floor', container: 'camo_rack', tags: ['camouflage_clothing'] },
  { id: 'gun_shop.reload_bench', kind: 'loot', room: 'sales_floor', container: 'reload_bench', tags: ['powder', 'primers', 'bullets'] },
  { id: 'gun_shop.range', kind: 'loot', room: 'shooting_range', container: 'shooting_bench', tags: ['ammo_22', 'ear_protection', 'targets'] },
  { id: 'gun_shop.vault', kind: 'loot', room: 'vault', container: 'vault_shelf', tags: ['class_d', 'owner_key_or_torch'] },
]

export const gunShop: InteriorModule = { template, items, libraries, hints }
