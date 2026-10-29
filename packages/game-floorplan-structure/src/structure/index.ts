import { createContext } from './context'
import type { BuildContext } from './context'
import { addBalconies } from './balconies'
import { buildCanvasStructure } from './canvas'
import { addChimney, addWell } from './extras'
import { addFoundation } from './foundation'
import { addPlatesAndPillars } from './plates'
import { addPorches } from './porch'
import { addPorchRoofs } from './porch-roof'
import { addRoof } from './roof'
import { addStairs } from './stairs'
import { addDoorLintels, findOpenings } from './openings'
import { addExteriorSteps } from './steps'
import { addWaterTank } from './tank-parts'
import { addUpperFloor } from './upper-floor'
import { addWalls } from './walls'
import { resolveConstruction } from '../construction'
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
  const context = createContext(source, construction, extras, tank, { porchRoofOnPostsOnly: options.porchRoofOnPostsOnly ?? refined, rafterRoof: options.rafterRoof ?? refined })
  addFoundation(context)
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
  const levels = source.floors.map((_, floor) => context.level(floor))
  const framed = construction.system === 'masonry' && (context.isUnit || source.style === 'commercial' || context.floorCount >= 3)
  return { parts: context.builder.parts, supports: context.builder.supports, levels, elevation: context.elevation, roof: context.roof, construction, framed, openings: findOpenings(context) }
}
