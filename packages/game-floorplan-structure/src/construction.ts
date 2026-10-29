import { CONSTRUCTIONS } from './registry'
import type { ConstructionBuild } from './registry'
import { constructionOfSystem, masonryConstruction } from './presets'
import type { PlanContext, StructureSource, Tent } from './types'

/** The construction of a plan: the one it already carries, else the masonry default of the engine's templates. */
export function resolveConstruction(source: StructureSource): ConstructionBuild {
  const extras = source.structureExtras ?? {}
  return { construction: source.construction ?? masonryConstruction(source), extras }
}

const TENT_LABEL = /^tent_(dome|tunnel)(?:_|$)/

/**
 * Tents of a plan whose template names the `canvas` construction and registers none of its own: one per room of type `tent`, standing on the room's footprint
 * (a label `tent_<kind>_<people>` names the kind, any other is a long tunnel) as high as the room's ceiling.
 */
export function tentsOf(source: StructureSource): Tent[] {
  const tents: Tent[] = []
  for (const room of source.rooms) {
    if (room.type !== 'tent' || room.floor !== 0 || !room.parts[0]) continue
    const { label } = room as { label?: unknown }
    tents.push({ id: room.id, kind: TENT_LABEL.exec(typeof label === 'string' ? label : '')?.[1] ?? 'tunnel', height: room.ceiling ?? source.floors[0]?.ceiling ?? 2.4, aabb: room.parts[0] })
  }
  return tents
}

/**
 * Picks the construction for a plan being generated: `options.construction` (a registered construction or a system name) wins over the template's
 * own (`TemplateDef.construction`), which wins over the masonry default.
 */
export function constructionFor(context: PlanContext): ConstructionBuild {
  const forced = context.options?.construction
  const named = typeof forced === 'string' ? forced : (context.template?.construction as string | undefined)
  if (named === undefined) return { construction: masonryConstruction(context.result) }
  const registered = CONSTRUCTIONS.get(named)
  if (registered) return registered(context)
  const preset = constructionOfSystem(named, context.result)
  if (preset) return { construction: preset, ...(named === 'canvas' ? { extras: { tents: tentsOf(context.result) } } : {}) }
  throw new Error(`Unknown construction "${named}": register it with registerConstruction`)
}
