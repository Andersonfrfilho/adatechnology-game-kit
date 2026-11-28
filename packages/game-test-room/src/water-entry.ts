/** Where a round goes down into standing water: the path read every `WATER_TRACE_STEP` metres, then halved down to the surface. Pure over the terrain's water. */
import type { Vec3 } from '@adatechnology/game-destruction'

/** Metres between the points of a round's path read for water. */
const WATER_TRACE_STEP = 0.25

export type WaterEntry = { readonly point: Vec3; readonly distance: number }
type WaterLevels = { waterAt(x: number, z: number): { readonly level: number } | null }

/** Where a round from `origin` along `direction` goes down through standing water within `reach` metres, or null (it starts under water, or never meets any). */
export const waterEntryAlong = (terrain: WaterLevels, ray: { readonly origin: Vec3; readonly direction: Vec3; readonly reach: number }): WaterEntry | null => {
  const { origin, direction, reach } = ray
  if (direction[1] >= 0) return null
  const under = (distance: number): boolean => {
    const y = origin[1] + direction[1] * distance
    const here = terrain.waterAt(origin[0] + direction[0] * distance, origin[2] + direction[2] * distance)
    return here !== null && y < here.level
  }
  if (under(0)) return null
  for (let distance = WATER_TRACE_STEP; distance <= reach; distance += WATER_TRACE_STEP) {
    if (!under(distance)) continue
    let dry = distance - WATER_TRACE_STEP
    let wet = distance
    for (let halving = 0; halving < 8; halving++) {
      const middle = (dry + wet) / 2
      if (under(middle)) wet = middle
      else dry = middle
    }
    const x = origin[0] + direction[0] * wet
    const z = origin[2] + direction[2] * wet
    return { point: [x, terrain.waterAt(x, z)?.level ?? origin[1] + direction[1] * wet, z], distance: wet }
  }
  return null
}
