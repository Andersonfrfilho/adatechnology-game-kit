import type { SlotKit, TemplateDef } from '@adatechnology/game-floorplan'

import { buildingLot } from './lot'
import { spot } from './spot'
import type { FindsHint, InteriorModule } from './types'

const HALL_DEPTH = 4
const SACRISTY_WIDTH = 2.6
const SACRISTY_DEPTH = 3.2
const PEW_ROWS = 7
const PEW_COLUMNS = 2
const PEW_AISLE_OFFSET = 2.6

const template: TemplateDef = {
  id: 'church', use: 'institutional', place: 'church', construction: 'masonry', partyWalls: [], style: 'commercial',
  limits: { w: [12, 14], d: [20, 24] }, defaults: { w: 12, d: 20 },
  lot: () => buildingLot({ frontSetback: 4, marginLeft: 4, marginRight: 1, pedestrian: { u: 6 }, backyard: 3, doorTarget: { a: 'parish_hall', side: 'front' }, libraries: { garden: 'garden' }, extraZones: [{ id: 'bell_tower', type: 'bell_tower', label: 'bell_tower', parts: [[-4, 17, -1, 20]], library: 'bell_tower' }] }),
  facade: {},
  floors: [{
    label: 'ground_floor', ceiling: 7.0, openPairs: [['nave', 'sanctuary']],
    rooms: (w, d) => [
      { id: 'parish_hall', type: 'dining', label: 'parish_hall', library: 'no_fixtures', rect: [0, 0, w, HALL_DEPTH] },
      { id: 'nave', type: 'hall', label: 'nave', library: 'nave', rect: [0, HALL_DEPTH, w, d - SACRISTY_DEPTH] },
      { id: 'sanctuary', type: 'hall', label: 'sanctuary', library: 'sanctuary', rect: [0, d - SACRISTY_DEPTH, w - SACRISTY_WIDTH, d] },
      { id: 'sacristy', type: 'office', label: 'sacristy', library: 'sacristy', rect: [w - SACRISTY_WIDTH, d - SACRISTY_DEPTH, w, d] },
    ],
    doors: (w, d) => [
      { a: 'parish_hall', b: 'outside', side: 'front', at: w / 2, width: 2.4 },
      { a: 'parish_hall', b: 'nave', at: w / 2, width: 1.2, opensTo: 'nave' },
      { a: 'sanctuary', b: 'sacristy', at: d - 2.7, width: 1.0, opensTo: 'sacristy' },
    ],
    windows: (_w, _d) => [{ room: 'nave', side: 'left', n: 4, width: 1.4, y0: 0.7, y1: 3.7 }],
  }],
}

const items = [
  { type: 'pew', category: 'pew', w: 3.6, d: 0.5, h: 0.9 },
  { type: 'altar', category: 'altar', w: 2.4, d: 0.9, h: 1.4, exactOnly: true },
  { type: 'altar_cross', category: 'altar_cross', w: 1.6, d: 0.2, h: 3.6, low: true, exactOnly: true },
  { type: 'donation_cabinet', category: 'donation_cabinet', w: 1.2, d: 0.6, h: 1.8, exactOnly: true },
  { type: 'church_bell', category: 'church_bell', w: 1.4, d: 1.4, h: 1.2, exactOnly: true },
  { type: 'sacristy_table', category: 'sacristy_table', w: 1, d: 0.6, h: 0.8, window: true, exactOnly: true },
]

const libraries = (kit: SlotKit) => {
  const { wall, center, corner } = kit
  return {
    nave: (room: { w: number; d: number }) => [
      ...Array.from({ length: PEW_ROWS * PEW_COLUMNS }, (_, index) => {
        const column = index % PEW_COLUMNS
        const row = Math.floor(index / PEW_COLUMNS)
        return center('pew_' + index, 0, 0, [3.6, 0.5], { pew: 1 }, { required: true, facing: 'v+', clearance: 0, slide: 0, ...spot(room, room.w / 2 + (column === 0 ? -PEW_AISLE_OFFSET : PEW_AISLE_OFFSET), 0.7 + row * 1.8) })
      }),
      wall('donations', 'right', 0.15, [1.2, 0.6], { '=donation_cabinet': 1 }, { required: true, clearance: 0.4, slide: 0 }),
    ],
    sanctuary: (room: { w: number; d: number }) => [
      center('altar', 0, 0, [2.4, 0.9], { '=altar': 1 }, { required: true, facing: 'v-', clearance: 0.3, slide: 0, ...spot(room, room.w * 0.64, 1.8) }),
      wall('cross', 'back', 0.64, [1.6, 0.2], { '=altar_cross': 1 }, { required: true, clearance: 0.2, slide: 0 }),
    ],
    sacristy: () => [
      corner('wardrobe', 'back-right', [1.4, 0.6], { wardrobe_small: 1 }, { required: true, clearance: 0.4 }),
      wall('table', 'left', 0.5, [1, 0.6], { '=sacristy_table': 1 }, { required: true, clearance: 0.3, slide: 0 }),
    ],
    bell_tower: () => [center('bell', 0.5, 0.5, [1.4, 1.4], { '=church_bell': 1 }, { required: true, clearance: 0 })],
  }
}

const hints: FindsHint[] = [
  { id: 'church.altar', kind: 'loot', room: 'sanctuary', container: 'altar', tags: ['candles', 'matches'] },
  { id: 'church.sacristy', kind: 'loot', room: 'sacristy', container: 'wardrobe', tags: ['wine', 'bell_tower_key', 'names_book'] },
  { id: 'church.donations', kind: 'loot', room: 'nave', container: 'donation_cabinet', tags: ['canned_food', 'clothes'] },
]

export const church: InteriorModule = { template, items, libraries, hints }
