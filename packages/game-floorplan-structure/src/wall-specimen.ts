import type { DestructibleSpec } from '@adatechnology/game-contracts'
import { assemblyDepth, assemblyPart, getAssembly } from '@adatechnology/game-destruction'

import { GROUND } from './types'
import { constructionOfSystem } from './presets'
import { CONSTRUCTION_SYSTEMS } from './registry'
import { toDestructibleSpec } from './to-destructible-spec'
import type { Opening, StructureSource, WallDetail } from './types'

export interface WallSpecimenOptions {
  /** Wall assembly of `game-destruction` (`brick_wall_plastered`, `concrete_block_wall`, `reinforced_concrete`, `drywall`, `wood_frame_wall`, `log_wall`, `sheet_metal_shack`...). */
  assembly: string
  /** Width and height in metres (the test area uses 2.4 x 2.1). */
  w: number
  h: number
  opening?: 'door' | 'window' | null
  /** Default `panels`: piers, lintel with its 0.2 m bearing, sill, plaster and rebar; `units` also lays the bricks, blocks or concrete panels one by one. */
  detail?: WallDetail
}

const SYSTEM_OF_ASSEMBLY: Record<string, string> = { log_wall: 'log', wood_frame_wall: 'wood_frame', sheet_metal_shack: 'improvised' }
const DOOR_WIDTH = 0.9
const WINDOW_WIDTH = 1.0

function openingOf(kind: 'door' | 'window', height: number): Opening {
  return kind === 'door'
    ? { id: 'door', kind, wall: 'wall_specimen', from: -DOOR_WIDTH / 2, to: DOOR_WIDTH / 2, y0: 0, y1: height * 0.8 }
    : { id: 'window', kind, wall: 'wall_specimen', from: -WINDOW_WIDTH / 2, to: WINDOW_WIDTH / 2, y0: height * 0.33, y1: height * 0.8 }
}

/**
 * A test wall as its assembly builds it, standing on a plinth: in `panels` the piers beside the opening, the lintel over it (reinforced concrete bearing 0.2 m on
 * the piers; a header in timber walls), the sill under a window and the wall above; with the plaster coat and the rebar of the assembly. The mass is the
 * assembly's for the whole w x h, whatever the detail.
 */
export function buildWallSpecimen(options: WallSpecimenOptions): DestructibleSpec {
  const { assembly, w, h, opening = null, detail = 'panels' } = options
  const def = getAssembly(assembly)
  if (!def) throw new Error(`unknown assembly "${assembly}"`)
  const system = SYSTEM_OF_ASSEMBLY[assembly] ?? 'masonry'
  const depth = assemblyDepth(def)
  const mass = assemblyPart(assembly, { id: 'wall_specimen', width: w, height: h, position: [0, h / 2, 0] }).mass ?? 1
  const construction = constructionOfSystem(system, { facade: {}, floors: [], rooms: [], walls: [], doors: [], items: [], w, d: depth } as StructureSource)!
  const joint = CONSTRUCTION_SYSTEMS.get(system)!.joints.wall
  const structure = {
    parts: [{ id: 'wall_specimen', role: 'wall' as const, material: def.core.material, aabb: [-w / 2, -depth / 2, w / 2, depth / 2] as [number, number, number, number], y0: 0, y1: h, floor: 0, mass, assembly }],
    supports: [{ part: 'wall_specimen', on: GROUND, joint }],
    openings: opening ? [openingOf(opening, h)] : [],
    levels: [0], elevation: 0, construction, framed: false,
    roof: { shape: 'slab' as const, covering: '', material: '', pitch: 0, bearingFloor: 0, panes: [], trusses: 0 },
  }
  return toDestructibleSpec(structure, { wallDetail: detail, sized: false, terrainMargin: 0.6, name: `wall_${assembly}` })
}
