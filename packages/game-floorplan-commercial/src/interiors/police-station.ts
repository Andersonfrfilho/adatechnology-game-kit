import type { SlotKit, TemplateDef } from '@adatechnology/game-floorplan'

import { buildingLot } from './lot'
import { spot } from './spot'
import type { FindsHint, InteriorModule } from './types'

const EVIDENCE_WIDTH = 1.8
const ARSENAL_WIDTH = 2.4
const CELL_WIDTH = 2.5
const CHIEF_WIDTH = 4.6

const template: TemplateDef = {
  id: 'police_station', use: 'institutional', place: 'police_station', construction: 'masonry', partyWalls: ['left', 'right'], style: 'commercial',
  limits: { w: [16, 20], d: [11, 14] }, defaults: { w: 16, d: 11 },
  lot: (w) => buildingLot({ frontSetback: 8, garage: { u: w - 3, width: 3.5 }, cargoU: w - 3.5, doorTarget: { a: 'reception', side: 'front' }, libraries: { garden: 'patrol_yard' } }),
  facade: { steelDoor: true },
  floors: [{
    label: 'ground_floor', ceiling: 3.0, openPairs: [['reception', 'bullpen']],
    rooms: (w, d) => [
      { id: 'evidence_depot', type: 'stockroom', label: 'evidence_depot', library: 'evidence_depot', rect: [0, 0, EVIDENCE_WIDTH, 3.5] },
      { id: 'reception', type: 'hall', label: 'reception', library: 'reception', rect: [EVIDENCE_WIDTH, 0, w - CHIEF_WIDTH, 3.5] },
      { id: 'chief_office', type: 'office', label: 'chief_office', library: 'chief_office', rect: [w - CHIEF_WIDTH, 0, w, 3.5] },
      { id: 'arsenal', type: 'stockroom', label: 'arsenal', library: 'arsenal', rect: [0, 3.5, ARSENAL_WIDTH, 6.5] },
      { id: 'locker_room', type: 'stockroom', label: 'locker_room', library: 'locker_room', rect: [0, 6.5, ARSENAL_WIDTH, d] },
      { id: 'bullpen', type: 'hall', label: 'bullpen', library: 'bullpen', rect: [ARSENAL_WIDTH, 3.5, w - 2 * CELL_WIDTH, d], parts: [[w - 2 * CELL_WIDTH, 3.5, w, 4.5]] },
      { id: 'cell_1', type: 'stockroom', label: 'cell_1', library: 'cell', rect: [w - 2 * CELL_WIDTH, 4.5, w - CELL_WIDTH, d] },
      { id: 'cell_2', type: 'stockroom', label: 'cell_2', library: 'cell', rect: [w - CELL_WIDTH, 4.5, w, d] },
    ],
    doors: (w, _d) => [
      { a: 'reception', b: 'outside', side: 'front', at: 10, width: 1.6, steel: true },
      { a: 'reception', b: 'evidence_depot', at: 1.0, width: 0.8, opensTo: 'evidence_depot' },
      { a: 'reception', b: 'chief_office', at: 1.2, width: 0.9, opensTo: 'chief_office' },
      { a: 'bullpen', b: 'arsenal', at: 5, width: 0.9, model: 'vault', steel: true, opensTo: 'arsenal' },
      { a: 'bullpen', b: 'locker_room', at: 9, width: 0.9, opensTo: 'locker_room' },
      { a: 'bullpen', b: 'cell_1', at: w - 2 * CELL_WIDTH + CELL_WIDTH / 2, width: 0.9, model: 'bars', opensTo: 'cell_1' },
      { a: 'bullpen', b: 'cell_2', at: w - CELL_WIDTH / 2, width: 0.9, model: 'bars', opensTo: 'cell_2' },
      { a: 'bullpen', b: 'outside', side: 'back', at: w - 3.5 - CELL_WIDTH * 2, width: 1.4, steel: true },
    ],
    windows: (w, _d) => [
      { room: 'reception', side: 'front', at: 3, width: 1.6, y0: 1.2, y1: 2.4 },
      { room: 'chief_office', side: 'front', at: w - 1.5, width: 1.2, y0: 1.2, y1: 2.4 },
    ],
  }],
}

const items = [
  { type: 'reception_counter', category: 'reception_counter', w: 4, d: 0.8, h: 1.1, exactOnly: true },
  { type: 'investigation_board', category: 'investigation_board', w: 3.6, d: 0.1, h: 1.6, low: true },
  { type: 'cell_bunk', category: 'cell_bunk', w: 0.9, d: 1.9, h: 1 },
  { type: 'evidence_rack', category: 'evidence_rack', w: 3, d: 0.5, h: 2.2, exactOnly: true },
  { type: 'weapon_locker', category: 'weapon_locker', w: 1.8, d: 0.5, h: 2, exactOnly: true },
  { type: 'locker_bank_6', category: 'locker', w: 2.52, d: 0.45, h: 1.8, exactOnly: true },
]

const libraries = (kit: SlotKit) => {
  const { wall, center, corner } = kit
  return {
    evidence_depot: () => [wall('rack', 'left', 0.5, [3, 0.5], { '=evidence_rack': 1 }, { required: true, clearance: 0.4, slide: 0 })],
    reception: (room: { w: number; d: number }) => [center('counter', 0, 0, [4, 0.8], { '=reception_counter': 1 }, { required: true, facing: 'v-', clearance: 0.4, slide: 0, ...spot(room, 2.2, 2.5) })],
    chief_office: () => [
      wall('desk', 'back', 0.5, [1.4, 0.7], { '=office_desk': 1 }, { required: true, clearance: 0.5, slide: 0 }),
      corner('filing_cabinet', 'back-right', [0.5, 0.6], { filing_cabinet: 1 }, { required: true, clearance: 0.3 }),
    ],
    arsenal: () => [wall('rack', 'back', 0.5, [1.8, 0.5], { '=weapon_locker': 1 }, { required: true, clearance: 0.3, slide: 0 })],
    locker_room: () => [wall('lockers', 'left', 0.5, [2.52, 0.45], { '=locker_bank_6': 1 }, { required: true, clearance: 0.4, slide: 0 })],
    bullpen: (room: { w: number; d: number }) => [
      ...[0, 1, 2].map((index) => center('desk_' + index, 0, 0, [1.4, 0.7], { '=office_desk': 1 }, { required: true, facing: 'v+', clearance: 0.3, slide: 0, ...spot(room, 1.2 + index * 2.6, 4.2) })),
      wall('board', 'back', 0.45, [3.6, 0.1], { investigation_board: 1 }, { required: true, clearance: 0.3, slide: 0 }),
    ],
    cell: () => [wall('bunk', 'back', 0.5, [0.9, 1.9], { cell_bunk: 1 }, { required: true, clearance: 0.2, slide: 0 })],
    patrol_yard: (room: { w: number; d: number }) => [center('patrol_car', 0, 0, [1.85, 4.3], { '=car': 1 }, { required: true, facing: 'u+', clearance: 0.3, ...spot(room, 6, room.d / 2) })],
  }
}

const hints: FindsHint[] = [
  { id: 'police_station.arsenal', kind: 'loot', room: 'arsenal', container: 'weapon_locker', tags: ['class_d', 'carbine', 'ammo_in_quantity', 'needs_chief_card'] },
  { id: 'police_station.chief_office', kind: 'loot', room: 'chief_office', container: 'office_desk', tags: ['arsenal_card'] },
  { id: 'police_station.evidence', kind: 'loot', room: 'evidence_depot', container: 'evidence_rack', tags: ['seized_medicine', 'machetes', 'unregistered_pistol'] },
  { id: 'police_station.patrol_yard', kind: 'loot', room: 'garden', container: 'car', tags: ['patrol_radio', 'shotgun_in_dashboard'] },
  { id: 'police_station.lockers', kind: 'loot', room: 'locker_room', container: 'locker', tags: ['pistol_40', 'baton', 'handcuffs', 'portable_radio'] },
  { id: 'police_station.desks', kind: 'loot', room: 'bullpen', container: 'office_desk', tags: ['city_maps', 'evacuation_routes'] },
]

export const policeStation: InteriorModule = { template, items, libraries, hints }
