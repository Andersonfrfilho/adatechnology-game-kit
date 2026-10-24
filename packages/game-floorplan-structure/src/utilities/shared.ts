import type { Rect } from '../types'

/** Loosely typed plan data: the engine's own plan and its items (`result.items`), which the utilities read and some of them annotate. */
export type Json = any
export type Rng = () => number

export const HALF_WALL = 0.075
export const round2 = (value: number): number => Math.round(value * 100) / 100
export const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value))

export const overlaps = (a: Rect, b: Rect, epsilon = 1e-6): boolean => a[0] < b[2] - epsilon && a[2] > b[0] + epsilon && a[1] < b[3] - epsilon && a[3] > b[1] + epsilon

export const inner = (rect: Rect): Rect => [rect[0] + HALF_WALL, rect[1] + HALF_WALL, rect[2] - HALF_WALL, rect[3] - HALF_WALL]

/** A solid item: not a rug, not resting on something, and not decoration unless it stands on the floor. */
export const isSolid = (item: Json): boolean => !item.flat && !item.on && (!item.decor || item.mount === 'floor')

export const distanceToRect = (u: number, v: number, rect: Rect): number => Math.hypot(Math.max(rect[0] - u, 0, u - rect[2]), Math.max(rect[1] - v, 0, v - rect[3]))

/** Room types without sockets, switches or circuits. */
export const NO_SOCKET_ROOMS: readonly string[] = ['void', 'elevator', 'stairs', 'balcony', 'terrace', 'porch', 'tent']

/** Unit vector pointing out of the house from a wall (`sides[0]` or `sides[1]` is `outside`). */
export const outwardOf = (wall: Json): [number, number] => {
  const sign = wall.sides[0] === 'outside' ? -1 : 1
  return wall.axis === 'u' ? [0, sign] : [sign, 0]
}

export const sideNameOf = (vector: [number, number]): string => (Math.abs(vector[0]) > Math.abs(vector[1]) ? (vector[0] > 0 ? 'right' : 'left') : vector[1] > 0 ? 'back' : 'front')

export const alongRange = (wall: Json): [number, number] => (wall.axis === 'u' ? [Math.min(wall.u0, wall.u1), Math.max(wall.u0, wall.u1)] : [Math.min(wall.v0, wall.v1), Math.max(wall.v0, wall.v1)])

/** Exterior ground-floor wall at least 1 m long, the front one first when there is one (a gas meter and an inverter go on them). */
export function groundExteriorWalls(plan: Json): Json[] {
  return plan.walls.filter((wall: Json) => wall.exterior && wall.floor === 0 && wall.type === 'wall' && Math.hypot(wall.u1 - wall.u0, wall.v1 - wall.v0) >= 1.0)
}
