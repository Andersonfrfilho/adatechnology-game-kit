import type { Aabb } from '../house/solids.js';
import type { HouseItem } from '../kernel-types.js';

/** Plan item types drawn as a potted plant (by `potPlant` or by a species of the vegetation package) whose crown or leaves spread past the pot. */
export const POTTED_PLANT_TYPES: ReadonlySet<string> = new Set(['floor_plant', 'floor_plant_tall', 'floor_plant_low', 'plant_tall', 'plant_short', 'outdoor_pot', 'table_plant']);

/** Metres a plant's crown keeps from a wall or a piece of furniture beside it. */
export const PLANT_CLEAR = 0.04;

/** The least reach (m) from the stem a potted plant needs to be drawn at all: under it there is no room for it and it is left out. */
export const PLANT_MIN_REACH = 0.14;

/** How far above its base a plant's crown is looked at against what stands round it (m): its foot stands on the floor's finish, its top under the ceiling. */
const PLANT_SPAN: readonly [number, number] = [0.03, 2.4];

export interface FreeReachParams {
  /** The plant's stem, in the house's frame (m). */
  readonly x: number
  readonly z: number
  /** The plane its pot stands on (m). */
  readonly y: number
  /** Boxes the plant keeps out of: the walls and the furniture already drawn round it. */
  readonly boxes: readonly Aabb[]
  /** The plan's other items: their footprints (turned by their ry) up to their height. */
  readonly items: readonly HouseItem[]
  /** The plan item of the plant itself, left out of `items`. */
  readonly self: HouseItem
  /** Base of the storey the items stand on (m). */
  readonly base: number
}

/** The footprint of a plan item turned by its ry, as [x0, z0, x1, z1]. */
export function footprintOf(m: HouseItem): readonly [number, number, number, number] {
  const c = Math.abs(Math.cos(m.ry || 0)), s = Math.abs(Math.sin(m.ry || 0)), hx = ((m.w || 0) * c + (m.d || 0) * s) / 2, hz = ((m.w || 0) * s + (m.d || 0) * c) / 2;
  return [m.x - hx, m.z - hz, m.x + hx, m.z + hz];
}

const reachTo = (x: number, z: number, x0: number, z0: number, x1: number, z1: number): number => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));

/**
 * How far (m) a plant standing at (x, z) may spread its crown before it touches a wall or a piece of furniture beside it, its clearance taken off:
 * the nearest of the boxes it keeps out of and of the footprints of the plan's other items that stand within its height.
 */
export function freeReachOf(p: FreeReachParams): number {
  const y0 = p.y + PLANT_SPAN[0], y1 = p.y + PLANT_SPAN[1];
  let reach = Number.POSITIVE_INFINITY;
  for (const b of p.boxes) if (b[1] < y1 && b[4] > y0) reach = Math.min(reach, reachTo(p.x, p.z, b[0], b[2], b[3], b[5]));
  for (const m of p.items) {
    if (m === p.self || m.id === p.self.id || m.floor !== p.self.floor || m.flat || m.category === 'ground_cover' || m.w == null || m.d == null) continue;
    const bottom = p.base + (m.y || 0), top = bottom + (m.h || 0);
    if (bottom >= y1 || top <= y0) continue;
    const r = footprintOf(m);
    reach = Math.min(reach, reachTo(p.x, p.z, r[0], r[1], r[2], r[3]));
  }
  return reach - PLANT_CLEAR;
}
