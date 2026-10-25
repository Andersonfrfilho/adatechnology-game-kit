import type { DestructibleSpec, JointSpec, PartSpec, PileSpec, SoilProfile, StructureRole } from '@adatechnology/game-contracts'
import { GRAVITY, MATERIALS, SOILS, assemblyPart, partMass, pileLength, profileOf, sizeRebar } from '@adatechnology/game-destruction'
import type { SoilDef } from '@adatechnology/game-destruction'
import { sizeCapacities } from './loads'
import { GROUND } from './types'
import { resolveSlabPanels } from './slab-panels'
import type { SlabPanelOptions } from './slab-panels'
import { applySlabPanels, beamDepthFor, deepenBondBeams } from './slab-panels'
import { applyPanels, applyUnits } from './wall-detail'
import type { FoundationType, PartRole, Structure, StructurePart, WallDetail } from './types'

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
  /**
   * Cuts the concrete slabs into panels with a beam under each edge, and adds the pillars those beams and the bond beams need (design T10 §10): `true` for
   * `SLAB_PANEL_DEFAULTS`, options to change them, `false` for the slab as one piece, as the Visor de casas 3D describes it. Default `true`.
   */
  slabPanels?: boolean | Partial<SlabPanelOptions>
  /** Name of the spec (default `house`). */
  name?: string
  /** Leaves parts out (and what rests on them is dropped from the joints). */
  filter?: (part: StructurePart) => boolean
  /** `false` keeps the capacity of the material instead of sizing it from the load. */
  sized?: boolean
  /** Metres the anchored terrain slab reaches beyond the parts (default 6). */
  terrainMargin?: number
  /**
   * Declares the tension steel of the concrete beams, slabs, roofs and stairs of a construction with rebar (`structure.rebar.ratio`), so the destruction
   * world bends them (`structure.flexure` of game-destruction): `true` for the default ratios (`REBAR_RATIOS`), or ratios per role. When the spec is
   * sized the steel is sized too (`sizeRebar`: at rest at `safetyOthers`, after the loss of any pillar or bearing wall under `redundancy`). Off by
   * default: the spec stays the one the Visor de casas 3D describes.
   */
  rebar?: boolean | Partial<Record<'beam' | 'slab' | 'roof' | 'stair', number>>
  /**
   * The ground the house stands on (`DestructibleSpec.soil` of game-contracts: a soil class id such as `clay_stiff`, or a profile of layers). With it
   * the foundations bear on the soil (game-destruction `soil`): the house settles, and tips over where the soil cannot carry it. A raft foundation
   * (`raft`, `basement`, `building`) becomes a concrete raft under the footprint (`RAFT_THICKNESS`) instead of the anchored terrain; any other
   * foundation keeps the terrain and every wall and pillar on it bears on a footing at least `footingWidth` wide. Off by default.
   */
  soil?: string | SoilProfile
  /** Foundation used with `soil` (default the construction's `foundation.type`). */
  foundation?: FoundationType
  /**
   * Deep concrete piles under the raft (a piled raft; with `soil` only). `length` omitted: each pile goes down to where it carries its share of the
   * house with the NBR 6122 safety (`pileLength`). Defaults: diameter 0.4 m, one pile per `PILE_AREA` m² of raft, at least 4, bored.
   */
  piles?: true | Partial<PileSpec>
  /** Soil classes beyond `SOILS` that `soil` names (the same ones given to the destruction world in `soil.soils`). */
  soils?: readonly SoilDef[]
}

/** Thickness of the raft of a house on the soil, metres (usual 0.20 to 0.30 m). */
export const RAFT_THICKNESS = 0.25
/** Raft area per pile when the count is not given, m² (a 3 x 3 m grid). */
export const PILE_AREA = 9
/** Metres the raft reaches beyond the walls. */
const RAFT_MARGIN = 0.15
const RAFT_FOUNDATIONS: ReadonlySet<FoundationType> = new Set(['raft', 'basement', 'building'])

/**
 * Tension steel ratio a concrete member starts with before sizing, `As / (b d)`: beams 0.8%, slabs and roof slabs 0.25%, stairs 0.4% (inside the
 * usual ranges of NBR 6118; the minimum for C25 is 0.15%).
 */
export const REBAR_RATIOS: Readonly<Record<'beam' | 'slab' | 'roof' | 'stair', number>> = { beam: 0.008, slab: 0.0025, roof: 0.0025, stair: 0.004 }

const CONTRACT_ROLE: Record<PartRole, StructureRole> = { column: 'column', beam: 'beam', slab: 'slab', wall: 'wall', partition: 'partition', roof: 'roof', stair: 'stair', none: 'none' }

const TERRAIN_MARGIN = 6
const TERRAIN_THICKNESS = 0.5

const boxSpec = (part: StructurePart, capacity: number | undefined): PartSpec => {
  const [u0, v0, u1, v1] = part.aabb
  return {
    id: part.id, material: part.material, shape: { kind: 'box', size: [Math.max(0.01, u1 - u0), Math.max(0.01, part.y1 - part.y0), Math.max(0.01, v1 - v0)] },
    position: [(u0 + u1) / 2, (part.y0 + part.y1) / 2, (v0 + v1) / 2], mass: Math.max(0.1, part.mass || 1),
    structure: capacity === undefined ? { role: CONTRACT_ROLE[part.role] } : { role: CONTRACT_ROLE[part.role], capacity },
  }
}

/** A wall piece as its assembly builds it (layers, rebar, units, breach), with the mass the structure gave it. A brick or log is the unit itself, so it keeps no units or breach. */
const assemblySpec = (part: StructurePart, capacity: number | undefined): PartSpec => {
  const [u0, v0, u1, v1] = part.aabb
  const alongU = u1 - u0 >= v1 - v0
  const spec = assemblyPart(part.assembly!, {
    id: part.id, width: alongU ? u1 - u0 : v1 - v0, height: part.y1 - part.y0, position: [(u0 + u1) / 2, (part.y0 + part.y1) / 2, (v0 + v1) / 2], ...(alongU ? {} : { rotation: [0, Math.PI / 2, 0] }),
    structure: capacity === undefined ? { role: CONTRACT_ROLE[part.role] } : { role: CONTRACT_ROLE[part.role], capacity }, extra: { mass: Math.max(0.1, part.mass || 1) },
  })
  if (part.unit) {
    delete spec.units
    delete spec.breach
  }
  return spec
}

const partSpecOf = (part: StructurePart, capacity: number | undefined, detailed: boolean): PartSpec => (detailed && part.assembly ? assemblySpec(part, capacity) : boxSpec(part, capacity))

/**
 * The structure as a `DestructibleSpec` in the space of the house (x = u, y = height, z = v; the ground is y = 0), one box per part and a terrain slab
 * that anchors it. Capacities are sized from the loads at rest, as a designer would: a house stands whole, holds the loss of one pillar or bearing wall
 * and falls with two.
 */
export function toDestructibleSpec(structure: Structure, options: DestructibleSpecOptions = {}): DestructibleSpec {
  const { safety = 0.65, redundancy = 0.97, safetyOthers = 0.45 } = options
  const kept = structure.parts.filter((part) => !options.filter || options.filter(part))
  const portico = options.portico ?? (options.wallDetail !== 'coarse' && structure.framed)
  const roled = portico ? kept.map((part): StructurePart => (part.role === 'wall' ? { ...part, role: 'partition' } : part)) : kept
  const ids = new Set(roled.map((part) => part.id))
  const filtered = structure.supports.filter((support) => !options.filter || (ids.has(support.part) && (support.on === GROUND || ids.has(support.on))))
  const detail = options.wallDetail ?? 'panels'
  const slabOptions = resolveSlabPanels(options.slabPanels ?? true)
  const slabbed = slabOptions ? applySlabPanels({ parts: roled, supports: filtered }, structure, slabOptions) : { parts: roled, supports: filtered }
  const walled = applyPanels(slabbed, structure, detail, slabOptions && structure.construction.frame.rebar ? (span) => beamDepthFor(span, slabOptions) : undefined)
  const panels = slabOptions && detail !== 'coarse' ? deepenBondBeams(walled, structure, slabOptions) : walled
  const sizing = { safety, redundancy, safetyOthers }
  const sized = { ...panels, capacities: options.sized === false ? new Map<string, number>() : sizeCapacities(panels.parts, panels.supports, sizing) }
  const { parts, supports, capacities } = detail === 'units' ? applyUnits(sized, structure) : sized
  const specs = parts.map((part) => partSpecOf(part, capacities.get(part.id), detail !== 'coarse'))
  const margin = options.terrainMargin ?? TERRAIN_MARGIN
  const x0 = Math.min(...parts.map((part) => part.aabb[0]))
  const z0 = Math.min(...parts.map((part) => part.aabb[1]))
  const x1 = Math.max(...parts.map((part) => part.aabb[2]))
  const z1 = Math.max(...parts.map((part) => part.aabb[3]))
  if (parts.length) specs.push({ id: GROUND, material: 'concrete', shape: { kind: 'box', size: [x1 - x0 + margin, TERRAIN_THICKNESS, z1 - z0 + margin] }, position: [(x0 + x1) / 2, -TERRAIN_THICKNESS / 2, (z0 + z1) / 2], hp: 1e12, structure: { role: 'foundation' }, anchored: true, tags: ['terrain'] })
  const present = new Set([...parts.map((part) => part.id), GROUND])
  const joints: JointSpec[] = supports.filter((s) => present.has(s.part) && present.has(s.on)).map((s) => ({ id: `${s.part}~${s.on}`, a: s.part, b: s.on, kind: s.joint, bears: s.bears === false ? false : 'a_on_b' }))
  const spec: DestructibleSpec = { name: options.name ?? 'house', parts: specs, joints, tags: ['structure', 'house'] }
  return onSoil(withRebar(spec, structure, options, portico), structure, options)
}

function withRebar(spec: DestructibleSpec, structure: Structure, options: DestructibleSpecOptions, portico: boolean): DestructibleSpec {
  const { redundancy = 0.97, safetyOthers = 0.45 } = options
  if (!options.rebar || !structure.construction.frame.rebar) return spec
  const ratios = { ...REBAR_RATIOS, ...(options.rebar === true ? {} : options.rebar) }
  for (const part of spec.parts) {
    const role = part.structure?.role
    if (!role || !(role in ratios) || part.structure!.rebar || !MATERIALS.find((m) => m.id === part.material)?.strength?.tensileMPa) continue
    part.structure = { ...part.structure!, rebar: { ratio: ratios[role as keyof typeof ratios] } }
  }
  if (options.sized === false) return spec
  return sizeRebar(spec, { safety: safetyOthers, redundancy, redundancyRoles: portico ? ['column'] : ['column', 'wall'] })
}

/** Puts the house on its soil: the raft (with its piles) in place of the terrain, or the terrain with a footing under each part on it. */
function onSoil(spec: DestructibleSpec, structure: Structure, options: DestructibleSpecOptions): DestructibleSpec {
  if (options.soil === undefined) return spec
  const out: DestructibleSpec = { ...spec, soil: options.soil }
  const type = options.foundation ?? structure.construction.foundation.type
  const ground = out.parts.findIndex((p) => p.id === GROUND)
  if (ground < 0 || (!RAFT_FOUNDATIONS.has(type) && !options.piles)) return out
  const house = out.parts.filter((p) => p.id !== GROUND)
  // the raft is under what stands on the ground (walls, pillars, the ground floor), not under the eaves
  const onGround = new Set((out.joints ?? []).filter((j) => j.b === GROUND).map((j) => j.a))
  const footprint = house.filter((p) => onGround.has(p.id))
  const half = (p: PartSpec, k: number) => (p.shape.kind === 'box' ? p.shape.size[k] / 2 : p.shape.kind === 'cylinder' ? (k === 1 ? p.shape.height / 2 : p.shape.radius) : p.shape.radius)
  const under = footprint.length ? footprint : house
  const x0 = Math.min(...under.map((p) => p.position[0] - half(p, 0))) - RAFT_MARGIN, x1 = Math.max(...under.map((p) => p.position[0] + half(p, 0))) + RAFT_MARGIN
  const z0 = Math.min(...under.map((p) => p.position[2] - half(p, 2))) - RAFT_MARGIN, z1 = Math.max(...under.map((p) => p.position[2] + half(p, 2))) + RAFT_MARGIN
  const raft: PartSpec = {
    id: GROUND, material: 'concrete', shape: { kind: 'box', size: [x1 - x0, RAFT_THICKNESS, z1 - z0] }, position: [(x0 + x1) / 2, -RAFT_THICKNESS / 2, (z0 + z1) / 2],
    structure: { role: 'foundation' }, tags: ['raft'],
  }
  if (options.piles) {
    const given = options.piles === true ? {} : options.piles
    const count = given.count ?? Math.max(4, Math.ceil(((x1 - x0) * (z1 - z0)) / PILE_AREA))
    const diameter = given.diameter ?? 0.4
    const method = given.method ?? 'bored'
    const materials = new Map(MATERIALS.map((m) => [m.id, m]))
    const mass = [...house, raft].reduce((sum, p) => sum + (p.mass ?? partMass(p, materials.get(p.material)!)), 0)
    const soils = new Map(SOILS.map((d) => [d.id, d]))
    for (const d of options.soils ?? []) soils.set(d.id, d)
    const length = given.length ?? pileLength(profileOf(options.soil), { load: (mass * GRAVITY) / count, diameter, top: RAFT_THICKNESS, method, soils })
    raft.structure = { role: 'foundation', pile: { length, diameter, count, method } }
  }
  out.parts = out.parts.map((p, i) => (i === ground ? raft : p))
  return out
}
