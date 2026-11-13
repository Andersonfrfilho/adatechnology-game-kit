import { applySlabPanels, resolveSlabPanels } from '@adatechnology/game-floorplan-structure'
import { outbuildingParts } from './structural-stages.js'
import type { Outbuilding, PlanStructure, StructurePart } from '@adatechnology/game-floorplan-structure'

const slabCache = new WeakMap<PlanStructure, readonly StructurePart[]>()

/** The slabs and the beams under them as the frame stage draws them (panels on beams, thick enough to carry their span): where the underside of a ceiling really is before the render. */
export function stagedSlabsOf(rawStructure: PlanStructure | undefined, outbuildings: readonly Outbuilding[] = []): readonly StructurePart[] {
  const outbuildingSlabs = outbuildings.flatMap((building) => outbuildingParts(building).parts.filter((part) => part.role === 'slab'))
  return rawStructure ? [...houseSlabsOf(rawStructure), ...outbuildingSlabs] : outbuildingSlabs
}

function houseSlabsOf(rawStructure: PlanStructure): readonly StructurePart[] {
  const cached = slabCache.get(rawStructure)
  if (cached) return cached
  const resolved = resolveSlabPanels(true)
  const slabOptions = resolved && rawStructure.levels.length <= resolved.maxStoreys ? resolved : undefined
  const slabbed = slabOptions ? applySlabPanels({ parts: rawStructure.parts, supports: rawStructure.supports }, rawStructure, slabOptions) : rawStructure
  const slabs = slabbed.parts.filter((part) => part.role === 'slab' || (part.role === 'beam' && part.id.startsWith('slab_')))
  slabCache.set(rawStructure, slabs)
  return slabs
}
