import type { StructurePart, Structure } from '@adatechnology/game-floorplan-structure'
import type { HouseRecord, Rect } from '../kernel-types.js'

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
