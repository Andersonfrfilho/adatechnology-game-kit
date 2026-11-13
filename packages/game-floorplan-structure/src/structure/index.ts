import { createContext } from './context'
import type { BuildContext } from './context'
import { addBalconies } from './balconies'
import { buildCanvasStructure } from './canvas'
import { addChimney, addWell } from './extras'
import { addFoundation } from './foundation'
import { addGroundBeams } from './ground-beams'
import { addPlatesAndPillars } from './plates'
import { addPorches } from './porch'
import { addPorchRoofs } from './porch-roof'
import { addRoof, strutRoofToSlabs } from './roof'
import { addStairs } from './stairs'
import { addDoorLintels, findOpenings } from './openings'
import { addExteriorSteps } from './steps'
import { addWaterTank } from './tank-parts'
import { addUpperFloor } from './upper-floor'
import { addWalls } from './walls'
import { WALL_PILLAR_SPACING } from './wall-pillars'
import { addBearingCores } from '../beam-bearings'
import { resolveConstruction } from '../construction'
import { densityOf } from '../density'
import { isFooting, sizeFootings } from '../footing'
import { touches } from '../geometry'
import type { LoadFlows } from '../footing'
import { bracedLength, clearOfOpenings, pillarLoad, sizePillars, wallAxisOf } from '../pillar-design'
import { loadFlowsAtRest } from '../loads'
import { applySlabPanels } from '../slab-panels/apply'
import { resolveSlabPanels } from '../slab-panels/options'
import { applyPanels } from '../wall-detail'
import type { PartsAndSupports } from '../wall-detail/apply'
import type { Structure, StructureOptions, StructureSource } from '../types'

function buildFloors(context: BuildContext): void {
  for (let floor = 0; floor < context.floorCount; floor++) {
    addWalls(context, floor)
    addPlatesAndPillars(context, floor)
    addPorches(context, floor)
    addUpperFloor(context, floor)
  }
}

/**
 * The footings again by the loads of the house as it is built and validated: its walls in panels and its slabs framed on beams (`applySlabPanels`), which
 * bring the slabs down onto the pillars otherwise than a whole slab does. A footing only grows.
 */
function sizeFootingsByFrame(structure: Structure): void {
  const panels = resolveSlabPanels(true)
  if (!panels) return
  const flowsOf = (): { framed: PartsAndSupports; flows: LoadFlows } => {
    const framed = applySlabPanels(applyPanels({ parts: structure.parts, supports: structure.supports }, structure, 'panels'), structure, panels)
    return { framed, flows: loadFlowsAtRest(framed.parts, framed.supports).flows }
  }
  // every concrete pillar past its capacity by the loads on it (N_d with the minimum and second-order moments, NBR 6118 15.8): a unit's building base, the
  // ground storey of a tall stack; a pillar made stiffer draws more of the load, so again until none grows
  const pillars = new Set(structure.parts.filter((part) => part.role === 'column' && part.material === 'concrete' && !isFooting(part, structure.supports)).map((part) => part.id))
  let current = flowsOf()
  for (let pass = 0; pillars.size && pass < 6; pass++) {
    const { framed, flows } = current
    const before = structure.parts.filter((part) => pillars.has(part.id)).map((part) => part.aabb.join())
    sizePillars(structure.parts, pillars, { load: (column) => pillarLoad(flows, column), length: (column) => bracedLength(column, framed), density: densityOf('concrete'), alongWall: (column) => wallAxisOf(column, structure.parts), allowed: clearOfOpenings(structure) })
    const grown = structure.parts.filter((part) => pillars.has(part.id)).filter((part, k) => part.aabb.join() !== before[k])
    if (!grown.length) break
    // a pillar grown under a bond beam it did not reach before (thickened at a corner) carries it there as it does its own
    for (const column of grown) {
      for (const beam of structure.parts.filter((p) => p.beamKind === 'bond_beam' && p.floor === column.floor && Math.abs(p.y0 - column.y1) <= 0.05 && touches(p.aabb, column.aabb, -0.01))) {
        if (!structure.supports.some((x) => x.part === beam.id && x.on === column.id)) structure.supports.push({ part: beam.id, on: column.id, joint: 'rebar' })
      }
    }
    current = flowsOf()
  }
  if (structure.parts.some((part) => isFooting(part, structure.supports))) sizeFootings(structure, { flows: current.flows, ...(structure.soilPressure === undefined ? {} : { soilPressure: structure.soilPressure }) })
}

const wallPillarSpacingOf = (options: StructureOptions): number => {
  const pillars = options.wallPillars ?? true
  if (pillars === false) return 0
  return pillars === true ? WALL_PILLAR_SPACING : (pillars.spacing ?? WALL_PILLAR_SPACING)
}

/**
 * The structure of a generated plan: every part that carries load (foundation, floors, walls, plates and bond beams, pillars, porch posts, trusses,
 * roof, stairs, tank) with what each rests on. The plan itself is not modified.
 */
export function buildStructure(source: StructureSource, options: StructureOptions = {}): Structure {
  const refined = options.wallDetail !== 'coarse'
  const built = options.construction ? { construction: options.construction, extras: options.extras ?? {} } : resolveConstruction(source)
  const construction = built.construction
  const extras = options.extras ?? built.extras ?? {}
  if (construction.system === 'canvas') return buildCanvasStructure(construction, extras)
  const tank = options.tank !== undefined ? options.tank : (source.waterTank ?? null)
  const context = createContext(source, construction, extras, tank, { porchRoofOnPostsOnly: options.porchRoofOnPostsOnly ?? refined, rafterRoof: options.rafterRoof ?? refined, roofBays: options.roofBays ?? refined, wallPillarSpacing: wallPillarSpacingOf(options), visorSections: options.visorSections === true })
  addFoundation(context)
  if (options.groundBeams !== false) addGroundBeams(context)
  buildFloors(context)
  addBalconies(context)
  addPorchRoofs(context)
  addExteriorSteps(context)
  addStairs(context)
  if (options.roof !== false) addRoof(context)
  if (refined) addDoorLintels(context)
  addWaterTank(context)
  addChimney(context)
  addWell(context)
  // (the Visor de casas 3D, reproduced for the team's golden, has no footings of its own)
  if (!context.visorSections) {
    strutRoofToSlabs(context)
    sizeFootings(context.builder, options.soilPressure === undefined ? {} : { soilPressure: options.soilPressure })
  }
  const levels = source.floors.map((_, floor) => context.level(floor))
  const framed = construction.system === 'masonry' && (context.isUnit || source.style === 'commercial' || context.floorCount >= 3)
  const structure: Structure = { parts: context.builder.parts, supports: context.builder.supports, levels, elevation: context.elevation, roof: context.roof, construction, framed, openings: findOpenings(context) }
  if (options.soilPressure !== undefined) structure.soilPressure = options.soilPressure
  if (!context.visorSections) sizeFootingsByFrame(structure)
  if (context.structural) addBearingCores(structure)
  return structure
}
