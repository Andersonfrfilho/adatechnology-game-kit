import { CONSTRUCTIONS } from './registry'
import type { ConstructionBuild } from './registry'
import { constructionOfSystem, masonryConstruction } from './presets'
import type { PlanContext, StructureSource } from './types'

/** The construction of a plan: the one it already carries, else the masonry default of the engine's templates. */
export function resolveConstruction(source: StructureSource): ConstructionBuild {
  const extras = source.structureExtras ?? {}
  return { construction: source.construction ?? masonryConstruction(source), extras }
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
  if (preset) return { construction: preset }
  throw new Error(`Unknown construction "${named}": register it with registerConstruction`)
}
