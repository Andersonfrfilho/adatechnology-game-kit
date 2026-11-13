import type * as THREE_NS from 'three'
import type { Structure, StructurePart } from '@adatechnology/game-floorplan-structure'
import type { HouseRecord, Rect, Three } from '../kernel-types.js'
import { renderBlueprintDataUrl } from './blueprint-canvas.js'

export { renderBlueprintDataUrl }

/** The levelled dirt of the site: 3 mm under the compacted bed of the foundation (6 mm), shown with it at level 1, and 3 mm over the ground. */
const BLUEPRINT_DIRT_TOP = 0.003
/** How deep the levelled dirt goes: its bottom 1 cm over the foundation bed's (6 cm), never on its plane. */
const DIRT_DEPTH = 0.05
/** Where each kind of mark starts over the dirt, metres: kinds of another paint never start on one plane (their bottoms overlap where they cross). */
/** A pillar's mark stands this far round the pillar (clear of the ground beam's faces under it, 2 cm round), and a threshold this far inside the wall line's sides. */
const PILLAR_MARGIN = 0.025
const MARK_INSET = 0.003
const MARK_BASE = { room: 0.004, door: 0.006, chalk: 0.008, pillar: 0.011 } as const

function addBoxMesh(
  THREE: Three,
  parent: THREE_NS.Group,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  mat: THREE_NS.Material,
): void {
  const sx = x1 - x0
  const sy = y1 - y0
  const sz = z1 - z0
  if (sx < 1e-4 || sy < 1e-4 || sz < 1e-4) return
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat)
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  mesh.castShadow = false
  mesh.receiveShadow = true
  parent.add(mesh)
}

function addBatterBoards(
  THREE: Three,
  parent: THREE_NS.Group,
  bx0: number,
  bz0: number,
  bx1: number,
  bz1: number,
  woodMat: THREE_NS.Material,
  wireMat: THREE_NS.Material,
): void {
  const d = 0.8
  const y = 0.22
  const x0 = bx0 - d
  const z0 = bz0 - d
  const x1 = bx1 + d
  const z1 = bz1 + d
  for (const [px, pz] of [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ]) {
    addBoxMesh(THREE, parent, px - 0.04, 0, pz - 0.04, px + 0.04, 0.45, pz + 0.04, woodMat)
  }
  addBoxMesh(THREE, parent, x0, y, z0 - 0.015, x1, y + 0.08, z0 + 0.015, woodMat)
  addBoxMesh(THREE, parent, x0, y, z1 - 0.015, x1, y + 0.08, z1 + 0.015, woodMat)
  addBoxMesh(THREE, parent, x0 - 0.015, y, z0, x0 + 0.015, y + 0.08, z1, woodMat)
  addBoxMesh(THREE, parent, x1 - 0.015, y, z0, x1 + 0.015, y + 0.08, z1, woodMat)
  addBoxMesh(THREE, parent, bx0, 0.28, z0, bx0 + 0.005, 0.284, z1, wireMat)
  addBoxMesh(THREE, parent, bx1, 0.28, z0, bx1 + 0.005, 0.284, z1, wireMat)
  addBoxMesh(THREE, parent, x0, 0.28, bz0, x1, 0.284, bz0 + 0.005, wireMat)
  addBoxMesh(THREE, parent, x0, 0.28, bz1, x1, 0.284, bz1 + 0.005, wireMat)
}

function makeRoomSign(
  THREE: Three,
  doc: Document | null,
  text: string,
  dims: string,
  x: number,
  z: number,
): THREE_NS.Mesh | null {
  if (!doc) return null
  const c = doc.createElement('canvas')
  c.width = 256
  c.height = 96
  const g = c.getContext('2d')
  if (!g) return null
  g.fillStyle = 'rgba(12, 31, 56, 0.82)'
  g.fillRect(0, 0, 256, 96)
  g.strokeStyle = '#38bdf8'
  g.lineWidth = 4
  g.strokeRect(2, 2, 252, 92)
  g.fillStyle = '#ffffff'
  g.font = 'bold 26px sans-serif'
  g.textAlign = 'center'
  g.fillText(text.slice(0, 18), 128, 44)
  g.fillStyle = '#9ad8ff'
  g.font = '20px monospace'
  g.fillText(dims, 128, 74)
  const tex = new THREE.CanvasTexture(c)
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.48), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(x, 0.045, z)
  return mesh
}

function cutSegments(
  a: number,
  b: number,
  holes: ReadonlyArray<readonly [number, number]>,
): Array<[number, number]> {
  let segs: Array<[number, number]> = [[a, b]]
  for (const [h0, h1] of holes) {
    const next: Array<[number, number]> = []
    for (const [s0, s1] of segs) {
      if (h1 <= s0 || h0 >= s1) {
        next.push([s0, s1])
      } else {
        if (h0 > s0 + 0.03) next.push([s0, h0])
        if (h1 < s1 - 0.03) next.push([h1, s1])
      }
    }
    segs = next
  }
  return segs
}

export function buildBlueprintStage(
  THREE: Three,
  doc: Document | null,
  plan: HouseRecord,
  rectsOf: (room: HouseRecord['rooms'][number]) => readonly Rect[],
): THREE_NS.Group {
  const group = new THREE.Group()
  group.name = 'stage:0:blueprint'
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x8a7250, roughness: 0.96 })
  const chalkMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.9 })
  const cyanMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.6 })
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 })
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xb0824e, roughness: 0.85 })
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.7 })

  let bx0 = Infinity
  let bz0 = Infinity
  let bx1 = -Infinity
  let bz1 = -Infinity

  for (const room of plan.rooms) {
    if (room.floor !== 0 || room.type === 'void') continue
    const rs = rectsOf(room)
    for (const [u0, v0, u1, v1] of rs) {
      if (!room.outbuilding) {
        bx0 = Math.min(bx0, u0)
        bz0 = Math.min(bz0, v0)
        bx1 = Math.max(bx1, u1)
        bz1 = Math.max(bz1, v1)
      }
      addBoxMesh(THREE, group, u0, MARK_BASE.room, v0, u1, 0.012, v1, cyanMat)
    }
    const r0 = rs[0]
    if (r0) {
      const sign = makeRoomSign(
        THREE,
        doc,
        String(room.name || room.type),
        `${(r0[2] - r0[0]).toFixed(1)}×${(r0[3] - r0[1]).toFixed(1)}m`,
        (r0[0] + r0[2]) / 2,
        (r0[1] + r0[3]) / 2,
      )
      if (sign) group.add(sign)
    }
  }

  // Draw chalk wall lines leaving doorway openings open
  for (const w of plan.walls) {
    if (w.floor !== 0) continue
    const alongU = w.axis === 'u'
    const th = w.thickness || 0.15
    const a = Math.min(alongU ? w.u0 : w.v0, alongU ? w.u1 : w.v1)
    const b = Math.max(alongU ? w.u0 : w.v0, alongU ? w.u1 : w.v1)
    const L = alongU ? w.v0 : w.u0

    const doorsOnWall = (plan.doors || []).filter((d) => {
      if (d.floor !== 0 || d.axis !== w.axis) return false
      const dPos = d.pos != null ? d.pos : alongU ? d.v : d.u
      const dAt = d.at != null ? d.at : alongU ? d.u : d.v
      return Math.abs(dPos - L) < 0.25 && dAt >= a - 0.1 && dAt <= b + 0.1
    })
    const holes = doorsOnWall.map((d) => {
      const dAt = d.at != null ? d.at : alongU ? d.u : d.v
      const hw = (d.width || 0.8) / 2
      return [dAt - hw, dAt + hw] as const
    })
    // the line runs on to just short of the outer faces of the walls it meets at either end: a corner is closed by chalk, and no end of a line lies on a room's
    // mark or on the end of the ground beam under it
    const wallSegs = cutSegments(a, b, holes).map(([s0, s1]): [number, number] => [s0 === a ? s0 - th / 2 + MARK_INSET : s0, s1 === b ? s1 + th / 2 - MARK_INSET : s1])
    for (const [s0, s1] of wallSegs) {
      if (alongU) addBoxMesh(THREE, group, s0, MARK_BASE.chalk, L - th / 2, s1, 0.026, L + th / 2, chalkMat)
      else addBoxMesh(THREE, group, L - th / 2, MARK_BASE.chalk, s0, L + th / 2, 0.026, s1, chalkMat)
    }
  }

  // Draw open door indicator: flat threshold line + open door leaf swung against the wall
  for (const d of plan.doors) {
    if (d.floor !== 0) continue
    const alongU = d.axis === 'u'
    const at = d.at != null ? d.at : alongU ? d.u : d.v
    const pos = d.pos != null ? d.pos : alongU ? d.v : d.u
    const w = d.width || 0.8
    const hw = w / 2
    const th = plan.walls.find((w) => w.floor === d.floor && w.axis === d.axis && Math.abs((alongU ? w.v0 : w.u0) - pos) < 0.05)?.thickness || 0.15
    // Threshold line covering the full thickness of the wall
    if (alongU) addBoxMesh(THREE, group, at - hw, MARK_BASE.door, pos - th / 2 + MARK_INSET, at + hw, 0.015, pos + th / 2 - MARK_INSET, doorMat)
    else addBoxMesh(THREE, group, pos - th / 2 + MARK_INSET, MARK_BASE.door, at - hw, pos + th / 2 - MARK_INSET, 0.015, at + hw, doorMat)
    // Open door leaf at 90° resting against the perpendicular wall (leaves the doorway completely open)
    if (alongU) addBoxMesh(THREE, group, at - hw, MARK_BASE.door, pos + MARK_INSET, at - hw + 0.035, 0.032, pos + w, doorMat)
    else addBoxMesh(THREE, group, pos + MARK_INSET, MARK_BASE.door, at - hw, pos + w, 0.032, at - hw + 0.035, doorMat)
  }

  const parts: readonly StructurePart[] = (plan.structure as Structure | undefined)?.parts ?? []
  for (const p of parts) {
    if (p.floor !== 0) continue
    if (!/^(column_|wall_column_|jamb_column_|footing_pier_)/.test(p.id)) continue
    const [u0, v0, u1, v1] = p.aabb
    addBoxMesh(THREE, group, u0 - PILLAR_MARGIN, MARK_BASE.pillar, v0 - PILLAR_MARGIN, u1 + PILLAR_MARGIN, 0.042, v1 + PILLAR_MARGIN, pillarMat)
  }

  if (Number.isFinite(bx0) && Number.isFinite(bx1)) {
    addBoxMesh(THREE, group, bx0 - 0.25, -DIRT_DEPTH, bz0 - 0.25, bx1 + 0.25, BLUEPRINT_DIRT_TOP, bz1 + 0.25, dirtMat)
    addBatterBoards(THREE, group, bx0, bz0, bx1, bz1, woodMat, cyanMat)
  }
  for (const ob of (plan.outbuildings || []).filter(Boolean)) {
    const [ou0, ov0, ou1, ov1] = ob.aabb
    const th = ob.thickness || 0.15
    const hw = th / 2
    addBoxMesh(THREE, group, ou0 - 0.25, -DIRT_DEPTH, ov0 - 0.25, ou1 + 0.25, BLUEPRINT_DIRT_TOP, ov1 + 0.25, dirtMat)
    addBatterBoards(THREE, group, ou0, ov0, ou1, ov1, woodMat, cyanMat)

    // Structural concrete column / beam markers (pillarMat - red boxes) at the 4 corners
    const corners: Array<[number, number]> = [
      [ou0 + hw, ov0 + hw],
      [ou1 - hw, ov0 + hw],
      [ou0 + hw, ov1 - hw],
      [ou1 - hw, ov1 - hw],
    ]
    for (const [cx, cz] of corners) {
      addBoxMesh(THREE, group, cx - hw - 0.02, MARK_BASE.pillar, cz - hw - 0.02, cx + hw + 0.02, 0.045, cz + hw + 0.02, pillarMat)
    }

    // Concrete grade beam line markers (baldrame / vigas de concreto) under outbuilding walls
    for (const w of ob.walls || []) {
      const alongU = w.axis === 'u'
      const a = Math.min(alongU ? w.u0 : w.v0, alongU ? w.u1 : w.v1)
      const b = Math.max(alongU ? w.u0 : w.v0, alongU ? w.u1 : w.v1)
      const L = alongU ? w.v0 : w.u0
      if (alongU) {
        addBoxMesh(THREE, group, a, MARK_BASE.chalk, L - hw, b, 0.024, L + hw, chalkMat)
      } else {
        addBoxMesh(THREE, group, L - hw, MARK_BASE.chalk, a, L + hw, 0.024, b, chalkMat)
      }
    }

    // Structural concrete markers at door jambs
    for (const d of ob.doors || []) {
      const alongU = d.axis === 'u'
      const dhw = (d.width || 0.85) / 2
      const dAt = d.at != null ? d.at : alongU ? d.u : d.v
      const dPos = d.pos != null ? d.pos : alongU ? d.v : d.u
      for (const offset of [-dhw, dhw]) {
        const jx = alongU ? dAt + offset : dPos
        const jz = alongU ? dPos : dAt + offset
        addBoxMesh(THREE, group, jx - hw - 0.01, MARK_BASE.pillar, jz - hw - 0.01, jx + hw + 0.01, 0.045, jz + hw + 0.01, pillarMat)
      }
    }

    // Intermediate wall tie columns if span > 3.2m
    if (ou1 - ou0 > 3.2) {
      const midU = (ou0 + ou1) / 2
      addBoxMesh(THREE, group, midU - hw - 0.02, MARK_BASE.pillar, ov0 - 0.02, midU + hw + 0.02, 0.045, ov0 + th + 0.02, pillarMat)
      addBoxMesh(THREE, group, midU - hw - 0.02, MARK_BASE.pillar, ov1 - th - 0.02, midU + hw + 0.02, 0.045, ov1 + 0.02, pillarMat)
    }
    if (ov1 - ov0 > 3.2) {
      const midV = (ov0 + ov1) / 2
      addBoxMesh(THREE, group, ou0 - 0.02, MARK_BASE.pillar, midV - hw - 0.02, ou0 + th + 0.02, 0.045, midV + hw + 0.02, pillarMat)
      addBoxMesh(THREE, group, ou1 - th - 0.02, MARK_BASE.pillar, midV - hw - 0.02, ou1 + 0.02, 0.045, midV + hw + 0.02, pillarMat)
    }
  }
  return group
}
