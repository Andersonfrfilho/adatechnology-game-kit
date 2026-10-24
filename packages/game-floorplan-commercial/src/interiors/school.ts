import type { SlotKit, TemplateDef } from '@adatechnology/game-floorplan'

import { buildingLot } from './lot'
import { along, spot } from './spot'
import type { FindsHint, InteriorModule } from './types'

const BUILDING_WIDTH = 10
const LIBRARY_WIDTH = 5.5
const FRONT_DEPTH = 5.9
const CORRIDOR_DEPTH = 2.6
const CAFETERIA_DEPTH = 3.6
const STUDENT_DESK_COLUMNS = 4
const STUDENT_DESK_ROWS = 4
const LOCKER_UNITS = 9
const LOCKER_UNIT_WIDTH = 0.42

const template: TemplateDef = {
  id: 'school', use: 'institutional', place: 'school', construction: 'masonry', partyWalls: [], style: 'commercial',
  limits: { w: [18, 24], d: [15, 18] }, defaults: { w: 18, d: 15 },
  lot: (w) => buildingLot({ frontSetback: 6, pedestrian: { u: 14 }, cargoU: w - 3.5, doorTarget: { a: 'sports_court', side: 'front' }, libraries: { garden: 'schoolyard' } }),
  facade: {},
  floors: [{
    label: 'ground_floor', ceiling: 3.0,
    rooms: (w, d) => [
      { id: 'library', type: 'living', label: 'library', library: 'library', rect: [0, 0, LIBRARY_WIDTH, FRONT_DEPTH] },
      { id: 'cafeteria', type: 'dining', label: 'cafeteria', library: 'cafeteria', rect: [LIBRARY_WIDTH, 0, BUILDING_WIDTH, CAFETERIA_DEPTH] },
      { id: 'kitchen', type: 'kitchen', label: 'school_kitchen', library: 'school_kitchen', rect: [LIBRARY_WIDTH, CAFETERIA_DEPTH, BUILDING_WIDTH, FRONT_DEPTH] },
      { id: 'corridor', type: 'corridor', label: 'corridor', library: 'school_corridor', rect: [0, FRONT_DEPTH, BUILDING_WIDTH, FRONT_DEPTH + CORRIDOR_DEPTH] },
      { id: 'classroom', type: 'office', label: 'classroom', library: 'classroom', rect: [0, FRONT_DEPTH + CORRIDOR_DEPTH, BUILDING_WIDTH, d] },
      { id: 'sports_court', type: 'hall', label: 'sports_court', library: 'sports_court', rect: [BUILDING_WIDTH, 0, w, d] },
    ],
    doors: (w, _d) => [
      { a: 'sports_court', b: 'outside', side: 'front', at: BUILDING_WIDTH + (w - BUILDING_WIDTH) / 2, width: 2.4 },
      { a: 'corridor', b: 'library', at: 4.8, width: 1.0, opensTo: 'library' },
      { a: 'corridor', b: 'kitchen', at: 9, width: 1.0, opensTo: 'kitchen' },
      { a: 'corridor', b: 'classroom', at: 9.2, width: 1.0, opensTo: 'classroom' },
      { a: 'corridor', b: 'sports_court', at: FRONT_DEPTH + CORRIDOR_DEPTH / 2, width: 2.0, opensTo: 'sports_court' },
    ],
    windows: (_w, _d) => [
      { room: 'library', side: 'front', at: 2.75, width: 1.4, y0: 1.0, y1: 2.3 },
      { room: 'cafeteria', side: 'front', at: 7.5, width: 1.2, y0: 1.0, y1: 2.3 },
      { room: 'classroom', side: 'left', at: 12, width: 1.4, y0: 1.0, y1: 2.3 },
    ],
    openPairs: [['cafeteria', 'kitchen']],
  }],
}

const items = [
  { type: 'school_desk', category: 'school_desk', w: 0.7, d: 0.9, h: 0.75, exactOnly: true },
  { type: 'blackboard', category: 'blackboard', w: 5, d: 0.1, h: 1.4, low: true, exactOnly: true },
  { type: 'locker_bank_9', category: 'locker', w: 3.78, d: 0.45, h: 1.8, exactOnly: true },
  { type: 'library_stack', category: 'library_stack', w: 3, d: 0.8, h: 1.6, exactOnly: true },
  { type: 'reading_table', category: 'reading_table', w: 2, d: 0.8, h: 0.75, exactOnly: true },
  { type: 'canteen_table', category: 'canteen_table', w: 3, d: 1, h: 0.75, exactOnly: true },
  { type: 'industrial_counter', category: 'industrial_counter', w: 4, d: 0.7, h: 0.9, exactOnly: true },
  { type: 'basketball_hoop', category: 'basketball_hoop', w: 1.8, d: 0.2, h: 3, low: true, exactOnly: true },
]

const libraries = (kit: SlotKit) => {
  const { wall, center } = kit
  return {
    library: (room: { w: number; d: number }) => [
      ...[0, 0.34, 0.66, 1].map((pos, index) => wall('shelf_' + index, 'left', pos, [1.2, 0.35], { bookcase: 1 }, { required: true, clearance: 0.5, slide: 0 })),
      ...[2.4, 3.6].map((v, index) => center('stack_' + index, 0, 0, [3, 0.8], { '=library_stack': 1 }, { required: true, facing: 'v+', clearance: 0.2, slide: 0, ...spot(room, 2.9, v) })),
      center('reading_table', 0, 0, [2, 0.8], { '=reading_table': 1 }, { required: true, facing: 'v+', clearance: 0.2, slide: 0, ...spot(room, 2.8, 4.8) }),
    ],
    cafeteria: (room: { w: number; d: number }) => [
      center('table_0', 0, 0, [3, 1], { '=canteen_table': 1 }, { required: true, facing: 'v+', clearance: 0, slide: 0, ...spot(room, 2.25, 0.9) }),
      center('table_1', 0, 0, [3, 1], { '=canteen_table': 1 }, { required: true, facing: 'v+', clearance: 0, slide: 0, ...spot(room, 2.25, 2.4) }),
    ],
    school_kitchen: (room: { w: number; d: number }) => [center('counter', 0, 0, [4, 0.7], { '=industrial_counter': 1 }, { required: true, facing: 'v-', clearance: 0.3, slide: 0, ...spot(room, 2.25, 0.6) })],
    school_corridor: () => [wall('lockers', 'front', along(BUILDING_WIDTH, LOCKER_UNITS * LOCKER_UNIT_WIDTH, 2.0), [LOCKER_UNITS * LOCKER_UNIT_WIDTH, 0.45], { '=locker_bank_9': 1 }, { required: true, clearance: 0.4, slide: 0 })],
    classroom: (room: { w: number; d: number }) => [
      wall('blackboard', 'back', 0.5, [5, 0.1], { '=blackboard': 1 }, { required: true, clearance: 0.2, slide: 0 }),
      center('teacher_desk', 0, 0, [1.4, 0.7], { '=office_desk': 1 }, { required: true, facing: 'v-', clearance: 0, slide: 0, ...spot(room, 5, room.d - 0.9) }),
      ...Array.from({ length: STUDENT_DESK_COLUMNS * STUDENT_DESK_ROWS }, (_, index) => {
        const column = index % STUDENT_DESK_COLUMNS
        const row = Math.floor(index / STUDENT_DESK_COLUMNS)
        return center('student_desk_' + index, 0, 0, [0.7, 0.9], { '=school_desk': 1 }, { required: true, facing: 'v+', clearance: 0, slide: 0, ...spot(room, 1.6 + column * 2, 0.7 + row * 1.25) })
      }),
    ],
    sports_court: () => [
      wall('hoop_0', 'back', 0.5, [1.8, 0.2], { '=basketball_hoop': 1 }, { required: true, clearance: 0.2, slide: 0 }),
      wall('hoop_1', 'right', 0.5, [1.8, 0.2], { '=basketball_hoop': 1 }, { required: true, clearance: 0.2, slide: 0 }),
    ],
    schoolyard: () => [],
  }
}

const hints: FindsHint[] = [
  { id: 'school.teacher_desk', kind: 'loot', room: 'classroom', container: 'office_desk', tags: ['kitchen_key', 'first_aid_kit'] },
  { id: 'school.library', kind: 'loot', room: 'library', container: 'bookcase', tags: ['skill_books', 'mechanics', 'first_aid', 'agriculture'] },
  { id: 'school.kitchen', kind: 'loot', room: 'kitchen', container: 'industrial_counter', tags: ['rice', 'beans', 'oil', 'industrial_pots'] },
  { id: 'school.lockers', kind: 'loot', room: 'corridor', container: 'locker', tags: ['backpacks', 'snacks', 'flashlights', 'notebooks'] },
]

export const school: InteriorModule = { template, items, libraries, hints }
