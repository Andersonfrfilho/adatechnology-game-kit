import type * as THREE_NS from 'three'
import { getAssembly } from '@adatechnology/game-destruction'
import type { StructurePart } from '@adatechnology/game-floorplan-structure'
import type { Three } from '../kernel-types.js'
import { BoxBatch } from './box-batch.js'
import { subtractRects, wallLineOf } from './wall-plane.js'
import type { WallRect } from './wall-plane.js'

export function addStageBox(
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

/** The batches a masonry stage lays its units into, one per material. */
export type MasonryBatches = Readonly<Record<'brick' | 'block' | 'mortar' | 'wood' | 'log' | 'sheet' | 'drywall', BoxBatch>>

export function createMasonryBatches(): MasonryBatches {
  return { brick: new BoxBatch(), block: new BoxBatch(), mortar: new BoxBatch(), wood: new BoxBatch(), log: new BoxBatch(), sheet: new BoxBatch(), drywall: new BoxBatch() }
}

/** The meshes of the batches, one per material that got any unit, named by the stage and the material. */
export function masonryMeshes(THREE: Three, batches: MasonryBatches, mats: Readonly<Record<string, THREE_NS.Material>>, prefix: string): THREE_NS.Mesh[] {
  const out: THREE_NS.Mesh[] = []
  for (const [key, batch] of Object.entries(batches)) {
    const material = mats[key]
    const mesh = material ? batch.mesh(THREE, material, `${prefix}:${key}`) : null
    if (mesh) out.push(mesh)
  }
  return out
}

/** Running bond: courses counted from `courseBase`, joints at fixed spots along the wall's axis, so the pieces of one wall cut by its pillars and beams line up. */
interface Coursing {
  readonly courseH: number
  readonly unitLen: number
  readonly joint: number
  readonly courseBase: number
}

const MORTAR_INSET = 0.004
const UNIT_CLEARANCE = 0.005

function layUnits(rect: WallRect, coursing: Coursing, put: (a0: number, y0: number, a1: number, y1: number) => void): void {
  const { courseH, unitLen, joint, courseBase } = coursing
  const first = Math.floor((rect.y0 - courseBase) / courseH + 1e-6)
  for (let row = first; courseBase + row * courseH < rect.y1 - 1e-6; row++) {
    const ya = Math.max(rect.y0 + UNIT_CLEARANCE, courseBase + row * courseH + joint / 2)
    // a unit cut by the piece's top keeps a joint's width under it: its face never lies on the mortar's
    const yb = Math.min(rect.y1 - UNIT_CLEARANCE, courseBase + (row + 1) * courseH - joint / 2)
    if (yb - ya < 0.01) continue
    const offset = (((row % 2) + 2) % 2) * ((unitLen + joint) / 2)
    const pitch = unitLen + joint
    for (let k = Math.floor((rect.a0 + offset) / pitch) - 1; k * pitch - offset < rect.a1; k++) {
      const s = k * pitch - offset
      // a unit that would leave a sliver of joint at the piece's end runs to the end: unit faces lie flush with it or a full joint away, never on the mortar's
      const n0 = s + joint / 2, n1 = s + pitch - joint / 2
      const b0 = n0 - rect.a0 < joint ? rect.a0 : n0
      const b1 = rect.a1 - n1 < joint ? rect.a1 : n1
      if (b1 - b0 > 0.02) put(b0, ya, b1, yb)
    }
  }
}

/**
 * The bare wall of a structural part, laid unit by unit into the batches, in the pieces that are left once its pillars, beams, lintels, foundation and the walls
 * laid before it are taken out (`cuts`, in the wall's plane): the masonry fills the frame, it never runs through it.
 */
export function buildMasonryPanel(batches: MasonryBatches, part: StructurePart, cuts: readonly WallRect[], courseBase: number): void {
  const wall = wallLineOf(part.aabb)
  const th = wall.thickness
  const pieces = subtractRects({ a0: wall.a0, a1: wall.a1, y0: part.y0, y1: part.y1 }, cuts)
  const box = (batch: BoxBatch, a0: number, y0: number, a1: number, y1: number, t: number): void =>
    batch.add(wall.alongU ? [a0, y0, wall.line - t / 2, a1, y1, wall.line + t / 2] : [wall.line - t / 2, y0, a0, wall.line + t / 2, y1, a1])

  const asm = part.assembly ? getAssembly(part.assembly) : undefined
  if (part.assembly === 'wood_frame_wall' || part.material === 'wood_soft') {
    const studW = 0.045
    const spacing = (asm as { studs?: { spacing?: number } } | undefined)?.studs?.spacing ?? 0.4
    for (const r of pieces) {
      box(batches.wood, r.a0, r.y0, r.a1, Math.min(r.y1, r.y0 + 0.045), th * 0.9)
      box(batches.wood, r.a0, Math.max(r.y0, r.y1 - 0.045), r.a1, r.y1, th * 0.9)
      const n = Math.max(1, Math.round((r.a1 - r.a0) / spacing))
      for (let i = 0; i <= n; i++) {
        const s = r.a0 + ((r.a1 - r.a0 - studW) * i) / n
        box(batches.wood, s, r.y0 + 0.045, s + studW, r.y1 - 0.045, th * 0.9)
      }
    }
    return
  }
  if (part.assembly === 'log_wall') {
    const logD = 0.16
    for (const r of pieces) for (let y = r.y0; y < r.y1 - 1e-3; y += logD) box(batches.log, r.a0, y + 0.004, r.a1, Math.min(r.y1, y + logD - 0.004), th * 0.96)
    return
  }
  if (part.assembly === 'sheet_metal_shack' || part.material === 'steel') {
    for (const r of pieces) box(batches.sheet, r.a0, r.y0, r.a1, r.y1, Math.min(th, 0.025))
    return
  }
  if (part.assembly === 'drywall' || part.material === 'gypsum') {
    for (const r of pieces) box(batches.drywall, r.a0, r.y0, r.a1, r.y1, th * 0.85)
    return
  }

  const isBlock = part.assembly === 'concrete_block_wall' || part.material === 'concrete'
  const coreTh = Math.max(0.09, th - 0.028)
  const coursing: Coursing = { courseH: isBlock ? 0.2 : 0.14, unitLen: isBlock ? 0.39 : 0.24, joint: 0.012, courseBase }
  const unit = isBlock ? batches.block : batches.brick
  for (const r of pieces) {
    // the mortar behind the units shows in every joint; it is thinner than the units, so no face of it lies on theirs
    // inset from the piece's edges too: the units are cut flush with a jamb or a pillar, the mortar stays a little behind them
    box(batches.mortar, r.a0 + MORTAR_INSET, r.y0, r.a1 - MORTAR_INSET, r.y1, coreTh * 0.86)
    layUnits(r, coursing, (a0, y0, a1, y1) => box(unit, a0, y0, a1, y1, coreTh))
  }
}
