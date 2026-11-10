import type * as THREE_NS from 'three'
import { applyPanels, applySlabPanels, beamDepthFor, deepenBondBeams, resolveSlabPanels } from '@adatechnology/game-floorplan-structure'
import type { PlanStructure, StructurePart } from '@adatechnology/game-floorplan-structure'
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
  for (let y = yBase + 0.08; y < yBase + height - 0.03; y += 0.14) {
    addStageBox(THREE, parent, u0 + inset, y, v0 + inset, u1 - inset, y + 0.006, v1 - inset, rebarMat)
  }
}

function createStageMaterials(THREE: Three): Record<string, THREE_NS.Material> {
  return {
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
): void {
  const [u0, v0, u1, v1] = p.aabb
  const isGroundSlab = p.role === 'slab' && p.floor === 0 && !p.id.includes('top') && p.y0 < 0.3
  const isFoundation = p.role === 'foundation' || isGroundSlab || /^(ground_beam_|footing_pier_|base_beam_|joist_|foundation_raft)/.test(p.id)

  if (isFoundation) {
    processFoundation(THREE, groups.foundation, p, mats)
    return
  }
  if (p.role === 'column') {
    const colMat = p.material === 'wood_soft' || p.material === 'wood_hard' ? mats.wood! : p.material === 'steel' ? mats.sheet! : mats.concrete!
    addStageBox(THREE, groups.frame, u0 - 0.008, p.y0, v0 - 0.008, u1 + 0.008, p.y1, v1 + 0.008, colMat, p.id)
    if (p.floor === 0 && p.material === 'concrete') {
      addRebarCage(THREE, groups.foundation, u0, v0, u1, v1, Math.max(0, p.y0), 0.42, mats.rebar!)
    }
    if (p.material === 'concrete') {
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
    const isLintel = /lintel|sillbeam|sill_beam/.test(p.id)
    const bMat = p.material === 'wood_soft' || p.material === 'wood_hard' ? mats.wood! : isLintel ? mats.lintel! : mats.beam!
    addStageBox(THREE, groups.frame, u0 - 0.005, p.y0, v0 - 0.005, u1 + 0.005, p.y1, v1 + 0.005, bMat, p.id)
    return
  }
  if (p.role === 'slab') {
    addStageBox(THREE, groups.frame, u0, p.y0, v0, u1, p.y1, v1, mats.concrete!, p.id)
    return
  }
  if (p.role === 'wall' || p.role === 'partition') {
    buildMasonryPanel(THREE, groups.masonry, p, mats)
    return
  }
  if (p.role === 'roof') {
    const rMat = p.material === 'steel' ? mats.sheet! : mats.wood!
    addStageBox(THREE, groups.roofFraming, u0, p.y0, v0, u1, p.y1, v1, rMat, p.id)
  }
}

export function buildStructuralStageGroups(
  THREE: Three,
  rawStructure: PlanStructure | undefined,
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

  for (const p of detailed.parts) {
    processPart(THREE, groups, p, mats)
  }

  return groups
}
