import { GROUND } from '../types'
import type { Construction, Rect, Roof, Structure, StructureExtras } from '../types'
import { StructureBuilder } from './builder'

const GROUNDSHEET = 0.02

/** Camping tents: canvas over aluminium poles, a plastic groundsheet and pegs with guy ropes; no walls. */
export function buildCanvasStructure(construction: Construction, extras: StructureExtras): Structure {
  const builder = new StructureBuilder()
  const panes: string[] = []
  for (const tent of extras.tents ?? []) {
    const [u0, v0, u1, v1] = tent.aabb
    const centreU = (u0 + u1) / 2
    const centreV = (v0 + v1) / 2
    const sheet = builder.add({ id: `groundsheet_${tent.id}`, role: 'slab', material: 'plastic', aabb: tent.aabb, y0: 0, y1: GROUNDSHEET }, { floor: 0, tent: tent.id })
    builder.rest(sheet, GROUND, 'resting')
    const canvas = builder.add({ id: `canvas_${tent.id}`, role: 'roof', material: 'fabric', aabb: tent.aabb, y0: GROUNDSHEET, y1: tent.height }, { floor: 0, fill: 0.04, tent: tent.id, form: tent.kind })
    panes.push(canvas.id)
    const poles: [Rect, number][] =
      tent.kind === 'tunnel'
        ? [0.25, 0.75].map((fraction, k): [Rect, number] => [[u0 + (u1 - u0) * fraction - 0.015, v0 + 0.05, u0 + (u1 - u0) * fraction + 0.015, v1 - 0.05], k])
        : [[[u0 + 0.05, centreV - 0.015, u1 - 0.05, centreV + 0.015], 0], [[centreU - 0.015, v0 + 0.05, centreU + 0.015, v1 - 0.05], 1]]
    for (const [aabb, k] of poles) {
      const pole = builder.add({ id: `pole_${tent.id}_${k}`, role: 'column', material: construction.frame.pillars, aabb, y0: GROUNDSHEET, y1: tent.height - GROUNDSHEET }, { floor: 0, fill: 0.05, tent: tent.id })
      builder.rest(pole, GROUND, 'resting')
      builder.rest(canvas, pole, 'tie')
    }
    const corners: [number, number][] = [[u0 - 0.2, v0 - 0.2], [u1 + 0.2, v0 - 0.2], [u0 - 0.2, v1 + 0.2], [u1 + 0.2, v1 + 0.2]]
    corners.forEach(([u, v], k) => {
      const peg = builder.add({ id: `peg_${tent.id}_${k}`, role: 'column', material: 'wood_soft', aabb: [u - 0.02, v - 0.02, u + 0.02, v + 0.02], y0: 0, y1: 0.2 }, { floor: 0 })
      builder.rest(peg, GROUND, 'nail')
      builder.rest(canvas, peg, 'tie')
    })
  }
  const roof: Roof = { shape: 'tent', covering: 'canvas', material: 'fabric', pitch: 0, bearingFloor: 0, panes, trusses: 0 }
  return { parts: builder.parts, supports: builder.supports, levels: [0], elevation: 0, roof, framed: false }
}
