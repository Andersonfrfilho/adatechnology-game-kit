import type { DestructibleSpec, JointSpec, PartSpec, StructureRole } from '@adatechnology/game-contracts'
import { sizeCapacities } from './loads'
import { GROUND } from './types'
import type { PartRole, Structure, StructurePart, WallDetail } from './types'

export interface DestructibleSpecOptions {
  /** Fraction of its capacity a pillar or bearing wall uses at rest (default 0.65). */
  safety?: number
  /** After losing any other pillar or bearing wall, the most of its capacity one of them uses (default 0.97: the house holds one loss and falls with two). */
  redundancy?: number
  /** Fraction of capacity beams, slabs, roofs, stairs and partitions use at rest (default 0.45). */
  safetyOthers?: number
  /** Bearing walls close but do not carry: a frame of pillars and beams carries the building. Default: for a framed building unless the detail is `coarse`. */
  portico?: boolean
  /** How finely the walls are split (default `panels`; `coarse` is one part per wall as the Visor de casas 3D builds it). */
  wallDetail?: WallDetail
  /** Name of the spec (default `house`). */
  name?: string
  /** Leaves parts out (and what rests on them is dropped from the joints). */
  filter?: (part: StructurePart) => boolean
  /** `false` keeps the capacity of the material instead of sizing it from the load. */
  sized?: boolean
}

const CONTRACT_ROLE: Record<PartRole, StructureRole> = { column: 'column', beam: 'beam', slab: 'slab', wall: 'wall', partition: 'partition', roof: 'roof', stair: 'stair', none: 'none' }

const TERRAIN_MARGIN = 6
const TERRAIN_THICKNESS = 0.5

const partSpecOf = (part: StructurePart, capacity: number | undefined): PartSpec => {
  const [u0, v0, u1, v1] = part.aabb
  const height = Math.max(0.01, part.y1 - part.y0)
  const spec: PartSpec = {
    id: part.id, material: part.material, shape: { kind: 'box', size: [Math.max(0.01, u1 - u0), height, Math.max(0.01, v1 - v0)] },
    position: [(u0 + u1) / 2, (part.y0 + part.y1) / 2, (v0 + v1) / 2], mass: Math.max(0.1, part.mass || 1),
    structure: capacity === undefined ? { role: CONTRACT_ROLE[part.role] } : { role: CONTRACT_ROLE[part.role], capacity },
  }
  return spec
}

/**
 * The structure as a `DestructibleSpec` in the space of the house (x = u, y = height, z = v; the ground is y = 0), one box per part and a terrain slab
 * that anchors it. Capacities are sized from the loads at rest, as a designer would: a house stands whole, holds the loss of one pillar or bearing wall
 * and falls with two.
 */
export function toDestructibleSpec(structure: Structure, options: DestructibleSpecOptions = {}): DestructibleSpec {
  const { safety = 0.65, redundancy = 0.97, safetyOthers = 0.45 } = options
  const kept = structure.parts.filter((part) => !options.filter || options.filter(part))
  const portico = options.portico ?? (options.wallDetail !== 'coarse' && structure.framed)
  const parts = portico ? kept.map((part): StructurePart => (part.role === 'wall' ? { ...part, role: 'partition' } : part)) : kept
  const ids = new Set(parts.map((part) => part.id))
  const supports = structure.supports.filter((support) => !options.filter || (ids.has(support.part) && (support.on === GROUND || ids.has(support.on))))
  const capacities = options.sized === false ? new Map<string, number>() : sizeCapacities(parts, supports, { safety, redundancy, safetyOthers })
  const specs = parts.map((part) => partSpecOf(part, capacities.get(part.id)))
  const x0 = Math.min(...parts.map((part) => part.aabb[0]))
  const z0 = Math.min(...parts.map((part) => part.aabb[1]))
  const x1 = Math.max(...parts.map((part) => part.aabb[2]))
  const z1 = Math.max(...parts.map((part) => part.aabb[3]))
  if (parts.length) specs.push({ id: GROUND, material: 'concrete', shape: { kind: 'box', size: [x1 - x0 + TERRAIN_MARGIN, TERRAIN_THICKNESS, z1 - z0 + TERRAIN_MARGIN] }, position: [(x0 + x1) / 2, -TERRAIN_THICKNESS / 2, (z0 + z1) / 2], hp: 1e12, structure: { role: 'foundation' }, anchored: true, tags: ['terrain'] })
  const present = new Set([...ids, GROUND])
  const joints: JointSpec[] = structure.supports.filter((s) => present.has(s.part) && present.has(s.on)).map((s) => ({ id: `${s.part}~${s.on}`, a: s.part, b: s.on, kind: s.joint, bears: s.bears === false ? false : 'a_on_b' }))
  return { name: options.name ?? 'house', parts: specs, joints, tags: ['structure', 'house'] }
}
