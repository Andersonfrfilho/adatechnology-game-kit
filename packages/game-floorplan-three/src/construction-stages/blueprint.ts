import type * as THREE_NS from 'three'
import type { Structure, StructurePart } from '@adatechnology/game-floorplan-structure'
import type { HouseRecord, Rect, Three } from '../kernel-types.js'

function addBoxMesh(
  THREE: Three,
  parent: THREE_NS.Group,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  material: THREE_NS.Material,
): void {
  const sx = x1 - x0
  const sy = y1 - y0
  const sz = z1 - z0
  if (sx < 1e-4 || sy < 1e-4 || sz < 1e-4) return
  const geo = new THREE.BoxGeometry(sx, sy, sz)
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  mesh.receiveShadow = true
  parent.add(mesh)
}

function addBatterBoards(
  THREE: Three,
  group: THREE_NS.Group,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  woodMat: THREE_NS.Material,
  lineMat: THREE_NS.Material,
): void {
  const off = 0.65
  const L = 0.9
  const corners: readonly [number, number, number, number][] = [
    [x0 - off, z0 - off, 1, 1],
    [x1 + off, z0 - off, -1, 1],
    [x0 - off, z1 + off, 1, -1],
    [x1 + off, z1 + off, -1, -1],
  ]
  for (const [cx, cz, dx, dz] of corners) {
    addBoxMesh(THREE, group, cx - 0.03, 0, cz - 0.03, cx + 0.03, 0.55, cz + 0.03, woodMat)
    const ex = cx + dx * L
    const ez = cz + dz * L
    addBoxMesh(THREE, group, ex - 0.03, 0, cz - 0.03, ex + 0.03, 0.55, cz + 0.03, woodMat)
    addBoxMesh(THREE, group, cx - 0.03, 0, ez - 0.03, cx + 0.03, 0.55, ez + 0.03, woodMat)
    addBoxMesh(THREE, group, Math.min(cx, ex), 0.38, cz - 0.015, Math.max(cx, ex), 0.48, cz + 0.015, woodMat)
    addBoxMesh(THREE, group, cx - 0.015, 0.38, Math.min(cz, ez), cx + 0.015, 0.48, Math.max(cz, ez), woodMat)
  }
  addBoxMesh(THREE, group, x0 - off, 0.43, z0, x1 + off, 0.436, z0 + 0.006, lineMat)
  addBoxMesh(THREE, group, x0 - off, 0.43, z1, x1 + off, 0.436, z1 + 0.006, lineMat)
  addBoxMesh(THREE, group, x0, 0.43, z0 - off, x0 + 0.006, 0.436, z1 + off, lineMat)
  addBoxMesh(THREE, group, x1, 0.43, z0 - off, x1 + 0.006, 0.436, z1 + off, lineMat)
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
  g.fillStyle = 'rgba(18, 38, 64, 0.88)'
  g.fillRect(4, 4, 248, 88)
  g.strokeStyle = '#68c4ff'
  g.lineWidth = 3
  g.strokeRect(4, 4, 248, 88)
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

export function buildBlueprintStage(
  THREE: Three,
  doc: Document | null,
  plan: HouseRecord,
  rectsOf: (room: HouseRecord['rooms'][number]) => readonly Rect[],
): THREE_NS.Group {
  const group = new THREE.Group()
  group.name = 'stage:0:blueprint'
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
      bx0 = Math.min(bx0, u0)
      bz0 = Math.min(bz0, v0)
      bx1 = Math.max(bx1, u1)
      bz1 = Math.max(bz1, v1)
      addBoxMesh(THREE, group, u0 + 0.08, 0.005, v0 + 0.08, u1 - 0.08, 0.014, v1 - 0.08, cyanMat)
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

  for (const w of plan.walls) {
    if (w.floor !== 0) continue
    const alongU = w.axis === 'u'
    const th = w.thickness || 0.15
    const a = Math.min(alongU ? w.u0 : w.v0, alongU ? w.u1 : w.v1)
    const b = Math.max(alongU ? w.u0 : w.v0, alongU ? w.u1 : w.v1)
    const L = alongU ? w.v0 : w.u0
    if (alongU) addBoxMesh(THREE, group, a, 0.008, L - th / 2, b, 0.028, L + th / 2, chalkMat)
    else addBoxMesh(THREE, group, L - th / 2, 0.008, a, L + th / 2, 0.028, b, chalkMat)
  }

  for (const d of plan.doors) {
    if (d.floor !== 0) continue
    const alongU = d.axis === 'u'
    const hw = d.width / 2
    if (alongU) addBoxMesh(THREE, group, d.at - hw, 0.01, d.pos - 0.1, d.at + hw, 0.034, d.pos + 0.1, doorMat)
    else addBoxMesh(THREE, group, d.pos - 0.1, 0.01, d.at - hw, d.pos + 0.1, 0.034, d.at + hw, doorMat)
  }

  const parts: readonly StructurePart[] = (plan.structure as Structure | undefined)?.parts ?? []
  for (const p of parts) {
    if (p.floor !== 0 || (p.role !== 'column' && p.role !== 'foundation')) continue
    if (!/^(column_|wall_column_|jamb_column_|footing_pier_)/.test(p.id)) continue
    const [u0, v0, u1, v1] = p.aabb
    addBoxMesh(THREE, group, u0 - 0.02, 0.01, v0 - 0.02, u1 + 0.02, 0.042, v1 + 0.02, pillarMat)
  }

  if (Number.isFinite(bx0) && Number.isFinite(bx1)) {
    addBatterBoards(THREE, group, bx0, bz0, bx1, bz1, woodMat, cyanMat)
  }
  return group
}

export function renderBlueprintDataUrl(
  doc: Document | null,
  plan: HouseRecord,
  rectsOf: (room: HouseRecord['rooms'][number]) => readonly Rect[],
  stageLabel: string,
): string | null {
  if (!doc) return null
  const c = doc.createElement('canvas')
  c.width = 420
  c.height = 420
  const g = c.getContext('2d')
  if (!g) return null
  g.fillStyle = '#0c1f38'
  g.fillRect(0, 0, c.width, c.height)
  const lot = plan.lot?.rect ?? [-1, -1, (plan.w || 10) + 1, (plan.d || 8) + 1]
  const pad = 34
  const spanU = Math.max(4, lot[2] - lot[0])
  const spanV = Math.max(4, lot[3] - lot[1])
  const scale = Math.min((c.width - pad * 2) / spanU, (c.height - pad * 2 - 36) / spanV)
  const ox = (c.width - spanU * scale) / 2 - lot[0] * scale
  const oz = 44 + (c.height - 44 - pad - spanV * scale) / 2 - lot[1] * scale
  const X = (u: number): number => ox + u * scale
  const Z = (v: number): number => oz + v * scale

  g.strokeStyle = 'rgba(120, 190, 255, 0.25)'
  g.lineWidth = 1
  g.strokeRect(X(lot[0]), Z(lot[1]), (lot[2] - lot[0]) * scale, (lot[3] - lot[1]) * scale)

  for (const room of plan.rooms) {
    if (room.floor !== 0 || room.type === 'void') continue
    for (const [u0, v0, u1, v1] of rectsOf(room)) {
      g.fillStyle = 'rgba(56, 189, 248, 0.14)'
      g.fillRect(X(u0), Z(v0), (u1 - u0) * scale, (v1 - v0) * scale)
      g.strokeStyle = '#7dd3fc'
      g.lineWidth = 1.5
      g.strokeRect(X(u0), Z(v0), (u1 - u0) * scale, (v1 - v0) * scale)
    }
    const r0 = rectsOf(room)[0]
    if (r0) {
      g.fillStyle = '#f8fafc'
      g.font = 'bold 11px sans-serif'
      g.textAlign = 'center'
      g.fillText(String(room.name || room.type).slice(0, 14), X((r0[0] + r0[2]) / 2), Z((r0[1] + r0[3]) / 2) + 4)
    }
  }

  g.strokeStyle = '#ffffff'
  g.lineWidth = 3
  for (const w of plan.walls) {
    if (w.floor !== 0) continue
    g.beginPath()
    g.moveTo(X(w.u0), Z(w.v0))
    g.lineTo(X(w.u1), Z(w.v1))
    g.stroke()
  }

  const parts: readonly StructurePart[] = (plan.structure as Structure | undefined)?.parts ?? []
  g.fillStyle = '#ef4444'
  for (const p of parts) {
    if (p.floor !== 0 || p.role !== 'column') continue
    const [u0, v0, u1, v1] = p.aabb
    g.fillRect(X(u0) - 2, Z(v0) - 2, Math.max(4, (u1 - u0) * scale), Math.max(4, (v1 - v0) * scale))
  }

  g.fillStyle = '#e2e8f0'
  g.font = 'bold 13px sans-serif'
  g.textAlign = 'left'
  g.fillText(`${plan.name || plan.template} · ${stageLabel}`, 12, 22)
  g.fillStyle = '#94a3b8'
  g.font = '11px monospace'
  g.fillText(`Planta 2D (${(plan.w || 0).toFixed(1)}m × ${(plan.d || 0).toFixed(1)}m) · Pilares em vermelho`, 12, 408)
  return c.toDataURL('image/png')
}
