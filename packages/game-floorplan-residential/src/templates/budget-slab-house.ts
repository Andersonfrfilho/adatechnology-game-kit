import type { DoorDef, FloorDef, FloorplanOptions, RoomDef, TemplateDef, WindowDef } from '@adatechnology/game-floorplan'
import { clamp, r2 } from '../util'
import { SINGLE_BED_ONLY, SMALL_LIVING, floorCount } from './shared'

/** Where the side stair of an upper floor reaches it: one flight of 15 risers of 0.26 m starts 0.4 m from the street. */
const STAIR = { start: 0.4, flight: 3.9, risers: 15, width: 0.7 } as const
/** Depth of the front bedroom of an upper floor; the back bedroom and the bathroom take the rest. */
const FRONT_BEDROOM_DEPTH = 5.0
const BATHROOM_WIDTH = 1.7

const GROUND_FLOOR: FloorDef = {
  label: 'ground_floor', ceiling: 2.6, openPairs: [['living', 'kitchen']],
  rooms: (w, d) => [
    { id: 'living', type: 'living', label: 'living', rect: [0, 0, w, 3.4], overrides: SMALL_LIVING },
    { id: 'kitchen', type: 'kitchen', library: 'kitchen_integrated', label: 'kitchen', rect: [0, 3.4, w, 6.4] },
    { id: 'bedroom', type: 'bedroom', label: 'bedroom', rect: [0, 6.4, w - 1.7, d] },
    { id: 'bathroom', type: 'bathroom', label: 'bathroom', library: 'bathroom_wc', rect: [w - 1.7, 6.4, w, d] },
  ],
  doors: (w, _d) => [
    { a: 'living', b: 'outside', side: 'front', at: 1.0, width: 0.9 }, { a: 'kitchen', b: 'outside', side: 'left', at: 4.9, width: 0.8 },
    { a: 'kitchen', b: 'bedroom', at: w - 2.4, width: 0.8, opensTo: 'bedroom' }, { a: 'kitchen', b: 'bathroom', at: w - 0.85, width: 0.7, opensTo: 'bathroom' },
  ],
  windows: (w, d) => [
    { room: 'living', side: 'front', at: w - 1.6, width: 1.2 },
    { room: 'bedroom', side: 'left', at: (6.4 + d) / 2, width: 1.2 }, { room: 'bedroom', side: 'back', at: (w - 1.7) / 2, width: 1.2 },
    { room: 'bathroom', side: 'back', at: w - 0.85, width: 0.5, y0: 1.7, y1: 2.15 },
  ],
}

/** An upper floor repeats the footprint with two bedrooms and a bathroom; the outside door on the left wall is where the side stair arrives. */
function upperFloor(level: number): FloorDef {
  const ids = { front: `bedroom_${2 * level - 1}`, back: `bedroom_${2 * level}`, bath: `bath_${level}` }
  const stairDoorAt = r2(STAIR.start + STAIR.flight * level)
  return {
    label: level === 1 ? 'upper_floor' : 'upper_floor_2', ceiling: 2.6,
    rooms: (w, d): RoomDef[] => [
      { id: ids.front, type: 'bedroom', label: ids.front, rect: [0, 0, w, FRONT_BEDROOM_DEPTH] },
      { id: ids.back, type: 'bedroom', label: ids.back, rect: [0, FRONT_BEDROOM_DEPTH, w - BATHROOM_WIDTH, d], overrides: level === 2 ? SINGLE_BED_ONLY : {} },
      { id: ids.bath, type: 'bathroom', label: `bathroom_${level}`, library: 'bathroom_wc', rect: [w - BATHROOM_WIDTH, FRONT_BEDROOM_DEPTH, w, d] },
    ],
    doors: (): DoorDef[] => [
      { a: level === 1 ? ids.front : ids.back, b: 'outside', side: 'left', at: stairDoorAt, width: 0.8 },
      { a: ids.front, b: ids.back, width: 0.8, opensTo: ids.back },
      { a: ids.back, b: ids.bath, width: 0.7, opensTo: ids.bath },
    ],
    windows: (w): WindowDef[] => [
      { room: ids.front, side: 'front', at: w / 2, width: 1.2 }, { room: ids.back, side: 'back', at: (w - BATHROOM_WIDTH) / 2, width: 1.2 },
      { room: ids.bath, side: 'back', at: w - BATHROOM_WIDTH / 2, width: 0.5, y0: 1.7, y1: 2.15 },
    ],
  }
}
const UPPER_FLOORS = [upperFloor(1), upperFloor(2)]

/** Budget house with a slab roof; the slab takes 1 to 3 floors. Needs the engine's `hashString` for the `randomFloors` draw. */
export function createBudgetSlabHouse(hashString: (s: string) => number): TemplateDef {
  const floorsOf = (op: FloorplanOptions): number =>
    op.randomFloors ? 1 + (hashString(String(op.seed == null ? 1 : op.seed) + '|slab:floors') % 3) : floorCount(op, 1)
  return {
    id: 'budget_slab_house', use: 'residential_single', floorRange: [1, 3], partyWalls: ['right'], style: 'budget', limits: { w: [5, 7.2], d: [9.2, 10.4] }, defaults: { w: 6, d: 9.6 },
    options: { floors: [1, 2, 3], randomFloors: [false, true] },
    floorsFn: (op) => [GROUND_FLOOR, ...UPPER_FLOORS.slice(0, floorsOf(op) - 1)],
    config: (op) => { const floors = floorsOf(op); const sideStair = floors > 1 ? { side: 'left', rect: [-0.75, STAIR.start, -0.05, r2(STAIR.start + STAIR.flight * (floors - 1))], flights: floors - 1, risers: STAIR.risers, doors: Array.from({ length: floors - 1 }, (_, index) => `d${index + 1}_0`) } : null; return { floors, sideStair } },
    lot: (w, d) => ({ frontSetback: 2.2, marginLeft: 0.8, marginRight: 0, backyardDepth: clamp(25 - 2.2 - d, 6, 16), pedestrian: { u: 1.0 }, doorTarget: { a: 'living', side: 'front' }, libraries: { backyard: 'backyard_slab' } }),
    facadeExtra: (f, rng, w, d, op) => {
      f.roof = 'slab'; f.finish = rng() < 0.55 ? 'exposed_block' : 'partial_plaster'
      f.slab = { exposedRebar: true, waterTank: { u: r2(0.5 + rng() * (w - 1.5)), v: r2(1 + rng() * (d - 2)) }, annex: rng() < 0.55 ? { rect: [0, 0, r2(w * (0.5 + rng() * 0.3)), r2(d * 0.4)], state: 'exposed_brick' } : null }
      if (floorsOf(op) > 1) f.slab.exposedRebar = rng() < 0.6
    },
  }
}
