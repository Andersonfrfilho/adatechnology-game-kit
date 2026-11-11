import type * as THREE_NS from 'three'
import { applyPanels, applySlabPanels, beamDepthFor, deepenBondBeams, resolveSlabPanels } from '@adatechnology/game-floorplan-structure'
import type { Outbuilding, PlanStructure, StructurePart } from '@adatechnology/game-floorplan-structure'
import type { Three } from '../kernel-types.js'
import { addStageBox, buildMasonryPanel } from './masonry-stage.js'
import { addRafter, addRidgeBeam } from './roof-framing-stage.js'

export interface StructuralStageGroups {
  readonly foundation: THREE_NS.Group
  readonly frame: THREE_NS.Group
  readonly masonry: THREE_NS.Group
  readonly roofFraming: THREE_NS.Group
}

function addRebarCage(
  THREE: Three,
  parent: THREE_NS.Group,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  yBase: number,
  height: number,
  rebarMat: THREE_NS.Material,
): void {
  const inset = Math.min(0.025, (u1 - u0) * 0.22, (v1 - v0) * 0.22)
  const r = 0.006
  for (const x of [u0 + inset, u1 - inset]) {
    for (const z of [v0 + inset, v1 - inset]) {
      addStageBox(THREE, parent, x - r, yBase, z - r, x + r, yBase + height, z + r, rebarMat)
    }
  }
  for (let y = yBase + 0.10; y < yBase + height - 0.04; y += 0.16) {
    addStageBox(THREE, parent, u0 + inset, y, v0 + inset, u1 - inset, y + 0.006, v1 - inset, rebarMat)
  }
}

function createStageMaterials(THREE: Three): Record<string, THREE_NS.Material> {
  return {
    dirt: new THREE.MeshStandardMaterial({ color: 0x8a7250, roughness: 0.96 }),
    footing: new THREE.MeshStandardMaterial({ color: 0x7a766e, roughness: 0.92 }),
    baldrame: new THREE.MeshStandardMaterial({ color: 0x5c5852, roughness: 0.88 }),
    slab0: new THREE.MeshStandardMaterial({ color: 0xa6a298, roughness: 0.86 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x9c9890, roughness: 0.82 }),
    beam: new THREE.MeshStandardMaterial({ color: 0x8e8a82, roughness: 0.82 }),
    lintel: new THREE.MeshStandardMaterial({ color: 0x848078, roughness: 0.8 }),
    rebar: new THREE.MeshStandardMaterial({ color: 0x523a28, roughness: 0.55, metalness: 0.65 }),
    brick: new THREE.MeshStandardMaterial({ color: 0xb85a3a, roughness: 0.88 }),
    block: new THREE.MeshStandardMaterial({ color: 0x989690, roughness: 0.88 }),
    mortar: new THREE.MeshStandardMaterial({ color: 0xc2bdb2, roughness: 0.92 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xa87e4c, roughness: 0.82 }),
    log: new THREE.MeshStandardMaterial({ color: 0x78502e, roughness: 0.86 }),
    sheet: new THREE.MeshStandardMaterial({ color: 0x8e949a, roughness: 0.45, metalness: 0.6 }),
    drywall: new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.85 }),
  }
}

function processFoundation(
  THREE: Three,
  parent: THREE_NS.Group,
  p: StructurePart,
  mats: Record<string, THREE_NS.Material>,
): void {
  const [u0, v0, u1, v1] = p.aabb
  if (p.id.startsWith('ground_beam_') || p.id.startsWith('base_beam_')) {
    addStageBox(THREE, parent, u0, Math.min(p.y0, -0.25), v0, u1, Math.max(p.y1, 0.08), v1, mats.baldrame!, p.id)
  } else if (p.id.startsWith('footing_pier_')) {
    addStageBox(THREE, parent, u0 - 0.06, Math.min(p.y0, -0.45), v0 - 0.06, u1 + 0.06, Math.max(p.y1, 0.03), v1 + 0.06, mats.footing!, p.id)
  } else {
    addStageBox(THREE, parent, u0, -0.08, v0, u1, 0.02, v1, mats.slab0!, p.id)
  }
}

function processPart(
  THREE: Three,
  groups: StructuralStageGroups,
  p: StructurePart,
  mats: Record<string, THREE_NS.Material>,
  totalFloors = 1,
  allParts: readonly StructurePart[] = [],
): void {
  const [u0, v0, u1, v1] = p.aabb
  const isGroundSlab = p.role === 'slab' && p.floor === 0 && !p.id.includes('top') && p.y0 < 0.3
  const isFoundation = p.role === 'foundation' || isGroundSlab || /^(ground_beam_|footing_pier_|base_beam_|joist_|foundation_raft)/.test(p.id)

  if (isFoundation) {
    processFoundation(THREE, groups.foundation, p, mats)
    return
  }
  if (p.role === 'column') {
    // Synthetic slab support pillars placed in room centers by slab subdivision must not be drawn
    if (p.id.startsWith('pillar_')) return
    // Water tank support columns inside the attic are drawn in frame stage without rebar extensions
    if (p.id.startsWith('tank_')) {
      addStageBox(THREE, groups.frame, u0, p.y0, v0, u1, p.y1, v1, mats.concrete!, p.id)
      return
    }
    const colMat = p.material === 'wood_soft' || p.material === 'wood_hard' ? mats.wood! : p.material === 'steel' ? mats.sheet! : mats.concrete!
    addStageBox(THREE, groups.frame, u0 - 0.008, p.y0, v0 - 0.008, u1 + 0.008, p.y1, v1 + 0.008, colMat, p.id)
    // Starter rebar in foundation (Level 1) only for ground columns (y0 <= 0.1), not roof/tank columns
    if (p.floor === 0 && p.material === 'concrete' && p.y0 <= 0.1) {
      addRebarCage(THREE, groups.foundation, u0, v0, u1, v1, 0, 0.70, mats.rebar!)
    }
    // Top rebar extensions in frame (Level 2) only for ground-supported columns if there is an upper floor
    const hasUpperFloor = totalFloors > (p.floor ?? 0) + 1
    if (hasUpperFloor && p.material === 'concrete' && p.y0 <= 0.1) {
      addRebarCage(THREE, groups.frame, u0, v0, u1, v1, p.y1, 0.26, mats.rebar!)
    }
    return
  }
  if (p.id.startsWith('rafter_')) {
    addRafter(THREE, groups.roofFraming, p, mats.wood!)
    return
  }
  if (p.id.startsWith('ridge')) {
    addRidgeBeam(THREE, groups.roofFraming, p, mats.wood!)
    return
  }
  if (p.role === 'beam') {
    // Synthetic slab panel beams placed across room spans by slab subdivision float in mid-air
    // when interior columns are not present; skip them so only real structural bond beams and lintels remain
    if (p.id.startsWith('slab_') || p.id.includes('_b')) {
      return
    }
    const isLintel = /lintel|sillbeam|sill_beam/.test(p.id)
    if (isLintel) {
      // If a perimeter tie beam / bond beam already spans this opening at or above lintel height,
      // skip duplicate lintel to avoid coplanar z-fighting and shadow acne
      const overlapsBondBeam = allParts.some(
        (b) =>
          b.role === 'beam' &&
          !/lintel|sillbeam|sill_beam/.test(b.id) &&
          (b.floor ?? 0) === (p.floor ?? 0) &&
          Math.max(u0, b.aabb[0]) < Math.min(u1, b.aabb[2]) - 0.05 &&
          Math.max(v0, b.aabb[1]) < Math.min(v1, b.aabb[3]) - 0.05 &&
          p.y0 >= b.y0 - 0.05,
      )
      if (overlapsBondBeam) return
    }
    const bMat = p.material === 'wood_soft' || p.material === 'wood_hard' ? mats.wood! : isLintel ? mats.lintel! : mats.beam!
    const y0 = p.y0
    const y1 = p.y1
    addStageBox(THREE, groups.frame, u0 - 0.005, y0, v0 - 0.005, u1 + 0.005, y1, v1 + 0.005, bMat, p.id)
    return
  }
  if (p.role === 'slab') {
    // If it's a roof/ceiling slab, expand slightly by 0.08m to cover the perimeter bond beam tops
    if (p.id.includes('ceiling') || p.id.includes('top')) {
      addStageBox(THREE, groups.frame, u0 - 0.08, p.y0, v0 - 0.08, u1 + 0.08, p.y1, v1 + 0.08, mats.concrete!, p.id)
    } else {
      addStageBox(THREE, groups.frame, u0, p.y0, v0, u1, p.y1, v1, mats.concrete!, p.id)
    }
    return
  }
  if (p.role === 'wall' || p.role === 'partition') {
    buildMasonryPanel(THREE, groups.masonry, p, mats)
    return
  }
  if (p.role === 'roof') {
    // The abstract bounding volume for roof pitch must not be drawn as a solid box;
    // real rafters and ridge beams are already drawn by addRafter and addRidgeBeam above,
    // and the roof tiles and gutters are drawn by the roof stage.
    return
  }
}

function processOutbuilding(
  THREE: Three,
  groups: StructuralStageGroups,
  e: Outbuilding,
  mats: Record<string, THREE_NS.Material>,
): void {
  const [a0, b0, a1, b1] = e.aabb
  const ceiling = e.ceiling || 2.6
  const th = e.thickness || 0.15

  // 0. Compacted dirt excavation bed under outbuilding
  addStageBox(THREE, groups.foundation, a0 - 0.05, -0.06, b0 - 0.05, a1 + 0.05, 0.004, b1 + 0.05, mats.dirt!, `${e.id}_dirt_bed`)

  // 1. Foundation: baldrame grade beams under walls + compacted dirt interior (matches main house)
  addStageBox(THREE, groups.foundation, a0 + th, -0.06, b0 + th, a1 - th, 0.004, b1 - th, mats.dirt!, `${e.id}_interior_dirt`)
  for (let i = 0; i < e.walls.length; i++) {
    const w = e.walls[i]!
    const alongU = w.axis === 'u'
    if (alongU) {
      addStageBox(THREE, groups.foundation, w.u0, -0.25, w.v0 - th / 2, w.u1, 0.08, w.v0 + th / 2, mats.baldrame!, `${e.id}_baldrame_${i}`)
    } else {
      addStageBox(THREE, groups.foundation, w.u0 - th / 2, -0.25, w.v0, w.u0 + th / 2, 0.08, w.v1, mats.baldrame!, `${e.id}_baldrame_${i}`)
    }
  }

  // 2. Frame: columns at corners + door lintels + continuous top bond beams
  const corners: Array<[number, number]> = [
    [a0, b0],
    [a1, b0],
    [a0, b1],
    [a1, b1],
  ]
  const colHalf = th / 2
  for (let k = 0; k < corners.length; k++) {
    const [cx, cz] = corners[k]!
    addRebarCage(THREE, groups.foundation, cx - colHalf, cz - colHalf, cx + colHalf, cz + colHalf, 0, 0.70, mats.rebar!)
    addStageBox(THREE, groups.frame, cx - colHalf, 0, cz - colHalf, cx + colHalf, ceiling, cz + colHalf, mats.concrete!, `${e.id}_col_${k}`)
  }

  // Continuous perimeter top tie beams (viga cinta de respaldo superior) - runs unbroken along all 4 walls
  const beamY0 = ceiling - 0.20
  addStageBox(THREE, groups.frame, a0 - th / 2, beamY0, b0 - th / 2, a1 + th / 2, ceiling, b0 + th / 2, mats.beam!, `${e.id}_topbeam_north`)
  addStageBox(THREE, groups.frame, a0 - th / 2, beamY0, b1 - th / 2, a1 + th / 2, ceiling, b1 + th / 2, mats.beam!, `${e.id}_topbeam_south`)
  addStageBox(THREE, groups.frame, a0 - th / 2, beamY0, b0 - th / 2, a0 + th / 2, ceiling, b1 + th / 2, mats.beam!, `${e.id}_topbeam_west`)
  addStageBox(THREE, groups.frame, a1 - th / 2, beamY0, b0 - th / 2, a1 + th / 2, ceiling, b1 + th / 2, mats.beam!, `${e.id}_topbeam_east`)

  // Concrete ceiling slab over the edicula
  addStageBox(THREE, groups.frame, a0 - th / 2, ceiling - 0.12, b0 - th / 2, a1 + th / 2, ceiling, b1 + th / 2, mats.concrete!, `${e.id}_slab`)

  // Door lintel (verga de concreto armado): sits directly over the door opening and ties into the top tie beam
  for (const d of e.doors || []) {
    const alongU = d.axis === 'u'
    const hw = (d.width || 0.85) / 2
    const dAt = d.at != null ? d.at : alongU ? d.u : d.v
    const dPos = d.pos != null ? d.pos : alongU ? d.v : d.u
    const lintelTop = Math.max(2.35, beamY0)
    if (alongU) {
      addStageBox(THREE, groups.frame, dAt - hw - 0.20, 2.1, dPos - th / 2, dAt + hw + 0.20, lintelTop, dPos + th / 2, mats.lintel!, `${d.id}_lintel`)
    } else {
      addStageBox(THREE, groups.frame, dPos - th / 2, 2.1, dAt - hw - 0.20, dPos + th / 2, lintelTop, dAt + hw + 0.20, mats.lintel!, `${d.id}_lintel`)
    }
  }

  // 3. Masonry: brick wall panels (door gap is already cut in e.walls)
  for (let i = 0; i < e.walls.length; i++) {
    const w = e.walls[i]!
    const mockPart: StructurePart = {
      id: `${e.id}_wall_${i}`,
      role: 'wall',
      material: 'brick',
      aabb: w.axis === 'u'
        ? [w.u0, w.v0 - th / 2, w.u1, w.v0 + th / 2]
        : [w.u0 - th / 2, w.v0, w.u0 + th / 2, w.v1],
      y0: 0,
      y1: ceiling - 0.18,
      floor: 0,
      mass: 500,
    }
    buildMasonryPanel(THREE, groups.masonry, mockPart, mats)
  }

  // Roof framing for outbuilding
  addStageBox(THREE, groups.roofFraming, a0 - 0.15, ceiling, b0 - 0.15, a1 + 0.15, ceiling + 0.12, b1 + 0.15, mats.wood!, `${e.id}_roof`)
}

export interface InteriorColumnLocation {
  readonly u: number
  readonly v: number
  readonly floor: number
}

export function findInteriorColumnLocations(rawStructure: PlanStructure): readonly InteriorColumnLocation[] {
  const parts = rawStructure.parts || []
  const TOL = 0.12
  const MERGE_DIST = 0.55
  const SPACING = 4.0

  // Existing column center points (corners and exterior wall columns)
  const existing = parts
    .filter((p) => p.role === 'column' && !p.id.startsWith('tank_') && !p.id.startsWith('pillar_'))
    .map((p) => [(p.aabb[0] + p.aabb[2]) / 2, (p.aabb[1] + p.aabb[3]) / 2] as const)

  const isTaken = (u: number, v: number): boolean => existing.some(([eu, ev]) => Math.hypot(eu - u, ev - v) < MERGE_DIST)

  // Walls and partitions
  const wallParts = parts.filter((p) => p.role === 'wall' || p.role === 'partition')
  const wallLines = wallParts.map((p) => {
    const alongU = p.aabb[2] - p.aabb[0] >= p.aabb[3] - p.aabb[1]
    return {
      part: p,
      alongU,
      line: alongU ? (p.aabb[1] + p.aabb[3]) / 2 : (p.aabb[0] + p.aabb[2]) / 2,
      from: alongU ? p.aabb[0] : p.aabb[1],
      to: alongU ? p.aabb[2] : p.aabb[3],
      floor: p.floor ?? 0,
      isPartition: p.role === 'partition',
    }
  })

  const candidates: Array<{ u: number; v: number; floor: number }> = []

  for (let i = 0; i < wallLines.length; i++) {
    const w1 = wallLines[i]!
    for (let j = i + 1; j < wallLines.length; j++) {
      const w2 = wallLines[j]!
      if (w1.floor !== w2.floor || w1.alongU === w2.alongU) continue
      const wu = w1.alongU ? w1 : w2
      const wv = w1.alongU ? w2 : w1

      const u = wv.line
      const v = wu.line

      if (u >= wu.from - TOL && u <= wu.to + TOL && v >= wv.from - TOL && v <= wv.to + TOL) {
        if (wu.isPartition || wv.isPartition) {
          candidates.push({ u, v, floor: wu.floor })
        }
      }
    }
  }

  const columns: Array<{ u: number; v: number; floor: number }> = []
  for (const c of candidates) {
    if (!isTaken(c.u, c.v) && !columns.some((col) => col.floor === c.floor && Math.hypot(col.u - c.u, col.v - c.v) < MERGE_DIST)) {
      columns.push(c)
    }
  }

  // Check long spans on partitions
  for (const w of wallLines.filter((w) => w.isPartition)) {
    const len = w.to - w.from
    if (len > SPACING) {
      const alongPoints = [...existing.map(([u, v]) => ({ u, v, floor: w.floor })), ...columns]
        .filter((c) => c.floor === w.floor && Math.abs((w.alongU ? c.v : c.u) - w.line) < 0.25)
        .map((c) => (w.alongU ? c.u : c.v))
        .filter((a) => a >= w.from - 0.25 && a <= w.to + 0.25)
        .sort((a, b) => a - b)

      for (let k = 1; k < alongPoints.length; k++) {
        const gap = alongPoints[k]! - alongPoints[k - 1]!
        if (gap > SPACING) {
          const divs = Math.ceil(gap / SPACING)
          for (let d = 1; d < divs; d++) {
            const pt = alongPoints[k - 1]! + (gap * d) / divs
            const u = w.alongU ? pt : w.line
            const v = w.alongU ? w.line : pt
            if (!isTaken(u, v) && !columns.some((col) => col.floor === w.floor && Math.hypot(col.u - u, col.v - v) < MERGE_DIST)) {
              columns.push({ u, v, floor: w.floor })
            }
          }
        }
      }
    }
  }

  return columns
}

export function buildStructuralStageGroups(
  THREE: Three,
  rawStructure: PlanStructure | undefined,
  outbuildings?: readonly Outbuilding[],
): StructuralStageGroups {
  const foundation = new THREE.Group()
  foundation.name = 'stage:1:foundation'
  const frame = new THREE.Group()
  frame.name = 'stage:2:frame'
  const masonry = new THREE.Group()
  masonry.name = 'stage:3:masonry'
  const roofFraming = new THREE.Group()
  roofFraming.name = 'stage:7:roof_framing'

  if (!rawStructure) return { foundation, frame, masonry, roofFraming }

  const mats = createStageMaterials(THREE)
  const resolved = resolveSlabPanels(true)
  const slabOptions = resolved && rawStructure.levels.length <= resolved.maxStoreys ? resolved : undefined
  const slabbed = slabOptions
    ? applySlabPanels({ parts: rawStructure.parts, supports: rawStructure.supports }, rawStructure, slabOptions)
    : { parts: rawStructure.parts, supports: rawStructure.supports }
  const walled = applyPanels(
    slabbed,
    rawStructure,
    'panels',
    slabOptions && rawStructure.construction.frame.rebar ? (span) => beamDepthFor(span, slabOptions) : undefined,
  )
  const detailed = slabOptions ? deepenBondBeams(walled, rawStructure, slabOptions) : walled
  const groups: StructuralStageGroups = { foundation, frame, masonry, roofFraming }

  // 1. Excavated dirt ground bed under the house footprint
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity
  for (const p of rawStructure.parts) {
    if (p.floor === 0 || p.y0 <= 0.1) {
      minU = Math.min(minU, p.aabb[0])
      minV = Math.min(minV, p.aabb[1])
      maxU = Math.max(maxU, p.aabb[2])
      maxV = Math.max(maxV, p.aabb[3])
    }
  }
  if (Number.isFinite(minU) && Number.isFinite(maxU)) {
    addStageBox(THREE, groups.foundation, minU - 0.05, -0.06, minV - 0.05, maxU + 0.05, 0.004, maxV + 0.05, mats.dirt!, 'foundation_dirt_bed')
  }

  const totalFloors = rawStructure?.floors ?? (rawStructure?.levels ? Math.max(1, rawStructure.levels.length - 1) : 1)

  for (const p of detailed.parts) {
    processPart(THREE, groups, p, mats, totalFloors, detailed.parts)
  }

  // 2. Interior columns at interior wall junctions and spans
  const interiorCols = findInteriorColumnLocations(rawStructure)
  const colHalf = 0.09
  for (let k = 0; k < interiorCols.length; k++) {
    const c = interiorCols[k]!
    const u0 = c.u - colHalf
    const v0 = c.v - colHalf
    const u1 = c.u + colHalf
    const v1 = c.v + colHalf
    const y0 = rawStructure.levels[c.floor] ?? c.floor * 2.8
    const y1 = (rawStructure.levels[c.floor + 1] ?? y0 + 2.8) - 0.2

    // Starter rebar in foundation (Level 1)
    if (c.floor === 0) {
      addRebarCage(THREE, groups.foundation, u0, v0, u1, v1, 0, 0.70, mats.rebar!)
    }
    // Concrete column and top rebar extension in frame (Level 2) only if there is an upper floor
    addStageBox(THREE, groups.frame, u0 - 0.008, y0, v0 - 0.008, u1 + 0.008, y1, v1 + 0.008, mats.concrete!, `interior_column_${c.floor}_${k}`)
    if (totalFloors > c.floor + 1) {
      addRebarCage(THREE, groups.frame, u0, v0, u1, v1, y1, 0.26, mats.rebar!)
    }
  }

  if (outbuildings) {
    for (const ob of outbuildings) {
      processOutbuilding(THREE, groups, ob, mats)
    }
  }

  return groups
}
