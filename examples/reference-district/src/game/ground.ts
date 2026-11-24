import type { GroundLayout, GroundZone } from '@adatechnology/game-contracts'
import type { CityPlanInput, PlanLine } from '@adatechnology/game-urban'

import { boundsOf, lineRects } from './geometry'

/** What the ground is made of, by what the plan says is there. The surface ids are `game-terrain` profiles. */
export const SURFACE_OF_DISTRICT: Readonly<Record<string, string>> = { mixed: 'concrete_slab', residential_popular: 'dirt' }
export const SURFACE_OF_LINE: Readonly<Record<string, string>> = { street: 'road', avenue: 'road', river: 'shallow_water' }
export const SIDEWALK_SURFACE = 'concrete_slab'
export const OPEN_GROUND_SURFACE = 'lawn'
/** Width of the sidewalk on each side of a street, metres. */
export const SIDEWALK_WIDTH = 2.5
/** The margin the terrain keeps around the districts, metres. */
export const TERRAIN_MARGIN = 10

const zonesOfLine = (line: PlanLine): GroundZone[] => {
  const surface = SURFACE_OF_LINE[line.kind]
  if (surface === undefined) return []
  const sidewalks = surface === 'road' ? lineRects(line, SIDEWALK_WIDTH).map((rect): GroundZone => ({ rect, surface: SIDEWALK_SURFACE })) : []
  return [...sidewalks, ...lineRects(line).map((rect): GroundZone => ({ rect, surface }))]
}

/**
 * The ground layout of a plan: the districts under the streets, the sidewalks under the roads, the roads and the river last (later zones lie over earlier ones). The
 * zones come from the plan's own lines and rectangles; nothing is drawn by hand.
 */
export function groundLayoutOf(plan: CityPlanInput): GroundLayout {
  const districts = (plan.districts ?? []).flatMap((district): GroundZone[] => {
    const surface = SURFACE_OF_DISTRICT[district.kind]
    return surface === undefined ? [] : [{ rect: district.rect, surface }]
  })
  const lines = plan.lines ?? []
  // the river first (a road crosses it by a bridge), then the sidewalks and the roads
  const ordered = [...lines.filter((line) => line.kind === 'river'), ...lines.filter((line) => line.kind !== 'river')]
  return { surface: OPEN_GROUND_SURFACE, zones: [...districts, ...ordered.flatMap(zonesOfLine)] }
}

/** The terrain bounds of a plan: its districts and lines, plus a margin. */
export function terrainBoundsOf(plan: CityPlanInput): readonly [number, number, number, number] {
  const rects = [...(plan.districts ?? []).map((district) => district.rect), ...(plan.lines ?? []).flatMap((line) => lineRects(line))]
  const [x0, z0, x1, z1] = boundsOf(rects)
  return [x0 - TERRAIN_MARGIN, z0 - TERRAIN_MARGIN, x1 + TERRAIN_MARGIN, z1 + TERRAIN_MARGIN]
}
