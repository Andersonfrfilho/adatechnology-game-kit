import type { BuilderContext, BuilderMap, FloorKind } from '../types'

const FLOOR_ITEMS: Array<FloorKind & keyof BuilderMap> = ['lawn', 'tile_floor', 'concrete', 'deck_floor', 'dirt']

/** Ground cover items: one builder each, tiling the item's rectangle (or `M.poly`) with the floor atlas. */
export function floorBuilders({ cover }: BuilderContext): Partial<BuilderMap> {
  const B: Partial<BuilderMap> = {}
  for (const kind of FLOOR_ITEMS) B[kind] = (M, api) => cover(api, M, kind, { color: M.color })
  return B
}
