import type * as THREE_NS from 'three'
import { getAssembly } from '@adatechnology/game-destruction'
import { applyPanels, applySlabPanels, beamDepthFor, deepenBondBeams, resolveSlabPanels } from '@adatechnology/game-floorplan-structure'
import type { PlanStructure, StructurePart } from '@adatechnology/game-floorplan-structure'
import type { Three } from '../kernel-types.js'

export interface StructuralStageGroups {
  readonly foundation: THREE_NS.Group
  readonly frame: THREE_NS.Group
  readonly masonry: THREE_NS.Group
  readonly roofFraming: THREE_NS.Group
}

function addBox(
  THREE: Three,
  parent: THREE_NS.Group,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  mat: THREE_NS.Material,
  partId?: string,
): void {
  const sx = x1 - x0
  const sy = y1 - y0
  const sz = z1 - z0
  if (sx < 1e-4 || sy < 1e-4 || sz < 1e-4) return
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat)
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (partId) mesh.userData.structurePartId = partId
  parent.add(mesh)
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
      addBox(THREE, parent, x - r, yBase, z - r, x + r, yBase + height, z + r, rebarMat)
    }
  }
  for (let y = yBase + 0.08; y < yBase + height - 0.03; y += 0.14) {
    addBox(THREE, parent, u0 + inset, y, v0 + inset, u1 - inset, y + 0.006, v1 - inset, rebarMat)
  }
}

function buildMasonryPanel(
  THREE: Three,
  parent: THREE_NS.Group,
  part: StructurePart,
  mats: Readonly<Record<string, THREE_NS.Material>>,
): void {
  const [u0, v0, u1, v1] = part.aabb
  const alongU = u1 - u0 >= v1 - v0
  const a0 = alongU ? u0 : v0
  const a1 = alongU ? u1 : v1
  const th = alongU ? v1 - v0 : u1 - u0
  const c = alongU ? (v0 + v1) / 2 : (u0 + u1) / 2
  const put = (s0: number, ya: number, s1: number, yb: number, t: number, mat: THREE_NS.Material): void => {
    if (alongU) addBox(THREE, parent, s0, ya, c - t / 2, s1, yb, c + t / 2, mat, part.id)
    else addBox(THREE, parent, c - t / 2, ya, s0, c + t / 2, yb, s1, mat, part.id)
  }

  const asm = part.assembly ? getAssembly(part.assembly) : undefined
  if (part.assembly === 'wood_frame_wall' || part.material === 'wood_soft') {
    const studW = 0.045
    const spacing = asm?.studs?.spacing ?? 0.4
    put(a0, part.y0, a1, Math.min(part.y1, part.y0 + 0.045), th * 0.9, mats.wood!)
    put(a0, Math.max(part.y0, part.y1 - 0.045), a1, part.y1, th * 0.9, mats.wood!)
    const n = Math.max(1, Math.round((a1 - a0) / spacing))
    for (let i = 0; i <= n; i++) {
      const s = a0 + ((a1 - a0 - studW) * i) / Math.max(1, n)
      put(s, part.y0 + 0.045, s + studW, part.y1 - 0.045, th * 0.9, mats.wood!)
    }
    return
  }
  if (part.assembly === 'log_wall') {
    const logD = 0.16
    for (let y = part.y0; y < part.y1 - 1e-3; y += logD) {
      put(a0, y + 0.004, a1, Math.min(part.y1, y + logD - 0.004), th * 0.96, mats.log!)
    }
    return
  }
  if (part.assembly === 'sheet_metal_shack' || part.material === 'steel') {
    put(a0, part.y0, a1, part.y1, Math.min(th, 0.025), mats.sheet!)
    return
  }
  if (part.assembly === 'drywall' || part.material === 'gypsum') {
    put(a0, part.y0, a1, part.y1, th * 0.85, mats.drywall!)
    return
  }

  const isBlock = part.assembly === 'concrete_block_wall' || part.material === 'concrete'
  const courseH = isBlock ? 0.2 : 0.14
  const joint = 0.012
  const unitMat = isBlock ? mats.block! : mats.brick!
  const coreTh = Math.max(0.09, th - 0.028)
  put(a0, part.y0, a1, part.y1, coreTh * 0.86, mats.mortar!)
  for (let y = part.y0; y < part.y1 - 1e-3; y += courseH) {
    const ya = y + joint / 2
    const yb = Math.min(part.y1 - joint / 2, y + courseH - joint / 2)
    if (yb > ya) put(a0 + 0.004, ya, a1 - 0.004, yb, coreTh, unitMat)
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

  const mats: Record<string, THREE_NS.Material> = {
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

  for (const p of detailed.parts) {
    const [u0, v0, u1, v1] = p.aabb
    if (p.role === 'foundation' || (p.role === 'slab' && p.floor === 0) || /^(ground_beam_|footing_pier_|base_beam_|joist_|foundation_raft)/.test(p.id)) {
      if (p.id.startsWith('ground_beam_') || p.id.startsWith('base_beam_')) {
        addBox(THREE, foundation, u0, Math.min(p.y0, -0.25), v0, u1, Math.max(p.y1, 0.08), v1, mats.baldrame!, p.id)
      } else if (p.id.startsWith('footing_pier_')) {
        addBox(THREE, foundation, u0 - 0.06, Math.min(p.y0, -0.45), v0 - 0.06, u1 + 0.06, Math.max(p.y1, 0.03), v1 + 0.06, mats.footing!, p.id)
      } else {
        addBox(THREE, foundation, u0, Math.min(p.y0, -0.08), v0, u1, Math.max(p.y1, 0.02), v1, mats.slab0!, p.id)
      }
      continue
    }
    if (p.role === 'column') {
      const colMat = p.material === 'wood_soft' || p.material === 'wood_hard' ? mats.wood! : p.material === 'steel' ? mats.sheet! : mats.concrete!
      addBox(THREE, frame, u0 - 0.008, p.y0, v0 - 0.008, u1 + 0.008, p.y1, v1 + 0.008, colMat, p.id)
      if (p.floor === 0 && p.material === 'concrete') {
        addRebarCage(THREE, foundation, u0, v0, u1, v1, Math.max(0, p.y0), 0.42, mats.rebar!)
      }
      if (p.material === 'concrete') {
        addRebarCage(THREE, frame, u0, v0, u1, v1, p.y1, 0.26, mats.rebar!)
      }
      continue
    }
    if (p.role === 'beam') {
      const isLintel = /lintel|sillbeam|sill_beam/.test(p.id)
      const bMat = p.material === 'wood_soft' || p.material === 'wood_hard' ? mats.wood! : isLintel ? mats.lintel! : mats.beam!
      addBox(THREE, frame, u0 - 0.005, p.y0, v0 - 0.005, u1 + 0.005, p.y1, v1 + 0.005, bMat, p.id)
      continue
    }
    if (p.role === 'slab' && p.floor > 0) {
      addBox(THREE, frame, u0, p.y0, v0, u1, p.y1, v1, mats.concrete!, p.id)
      continue
    }
    if (p.role === 'wall' || p.role === 'partition') {
      buildMasonryPanel(THREE, masonry, p, mats)
      continue
    }
    if (p.role === 'roof') {
      const rMat = p.material === 'steel' ? mats.sheet! : mats.wood!
      addBox(THREE, roofFraming, u0, p.y0, v0, u1, p.y1, v1, rMat, p.id)
    }
  }

  return { foundation, frame, masonry, roofFraming }
}
