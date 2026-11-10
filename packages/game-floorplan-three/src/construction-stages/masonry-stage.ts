import type * as THREE_NS from 'three'
import { getAssembly } from '@adatechnology/game-destruction'
import type { StructurePart } from '@adatechnology/game-floorplan-structure'
import type { Three } from '../kernel-types.js'

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

function putWallUnit(
  THREE: Three,
  parent: THREE_NS.Group,
  alongU: boolean,
  c: number,
  s0: number,
  ya: number,
  s1: number,
  yb: number,
  t: number,
  mat: THREE_NS.Material,
  partId?: string,
): void {
  if (alongU) addStageBox(THREE, parent, s0, ya, c - t / 2, s1, yb, c + t / 2, mat, partId)
  else addStageBox(THREE, parent, c - t / 2, ya, s0, c + t / 2, yb, s1, mat, partId)
}

export function buildMasonryPanel(
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
    putWallUnit(THREE, parent, alongU, c, s0, ya, s1, yb, t, mat, part.id)
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
