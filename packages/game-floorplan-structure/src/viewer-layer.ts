import type { ViewerLayer, ViewerLayerContext, ViewerLayerLegendEntry } from '@adatechnology/game-floorplan'

import type { StructurePart } from './types'

type MaterialGroup = 'concrete' | 'steel' | 'masonry' | 'wood'

const COLORS: Record<MaterialGroup, string> = { concrete: '#7d8590', steel: '#3d6fb0', masonry: '#b5654b', wood: '#a0693a' }
const BEAM_IDS = ['plate_', 'porch_beam', 'base_beam', 'trestle_beam']

export const LAYER_ID = 'structure'

export function groupOf(material: string): MaterialGroup {
  if (material === 'concrete') return 'concrete'
  if (material === 'steel' || material === 'aluminium' || material === 'cast_iron') return 'steel'
  if (material === 'brick' || material === 'stone' || material === 'ceramic') return 'masonry'
  return 'wood'
}

const isRoofFrame = (part: StructurePart): boolean => ['truss', 'rafter', 'ridge'].some((prefix) => part.id.startsWith(prefix))
const isDrawnBeam = (part: StructurePart): boolean => part.role === 'beam' && BEAM_IDS.some((prefix) => part.id.startsWith(prefix))

function drawColumns(context: ViewerLayerContext, parts: readonly StructurePart[]): void {
  for (const part of parts.filter((p) => p.role === 'column')) {
    const color = COLORS[groupOf(part.material)]
    if (groupOf(part.material) === 'wood') context.rect(part.aabb, null, color, 2)
    else context.rect(part.aabb, color, null)
    context.hit(part.aabb, `${part.id} · column · ${part.material} · ${part.mass} kg`)
  }
}

function drawBeams(context: ViewerLayerContext, parts: readonly StructurePart[]): void {
  context.g.save()
  context.g.setLineDash([6, 4])
  for (const part of parts.filter(isDrawnBeam)) {
    context.rect(part.aabb, null, COLORS[groupOf(part.material)], 1.5)
    context.hit(part.aabb, `${part.id} · beam · ${part.material} · ${part.mass} kg`)
  }
  context.g.restore()
}

function drawRoofFrames(context: ViewerLayerContext, parts: readonly StructurePart[]): void {
  context.g.save()
  context.g.strokeStyle = COLORS.wood
  context.g.lineWidth = 1
  for (const part of parts.filter(isRoofFrame)) {
    const [u0, v0, u1, v1] = part.aabb
    const alongV = v1 - v0 > u1 - u0
    context.g.beginPath()
    if (alongV) { context.g.moveTo(context.X((u0 + u1) / 2), context.Z(v0)); context.g.lineTo(context.X((u0 + u1) / 2), context.Z(v1)) }
    else { context.g.moveTo(context.X(u0), context.Z((v0 + v1) / 2)); context.g.lineTo(context.X(u1), context.Z((v0 + v1) / 2)) }
    context.g.stroke()
  }
  context.g.restore()
}

function drawPorchRoofs(context: ViewerLayerContext, parts: readonly StructurePart[]): void {
  context.g.save()
  context.g.setLineDash([2, 4])
  for (const part of parts.filter((p) => p.id.startsWith('porch_roof'))) context.rect(part.aabb, null, COLORS.wood, 1)
  context.g.restore()
}

/** What the viewer draws at one storey: pillars (filled for concrete, steel and masonry, hollow for wood), dashed beams, trusses on the top storey, the porch roof outline. */
export function drawStructure(context: ViewerLayerContext): void {
  const structure = context.plan.structure
  if (!structure) return
  const floor = context.all ? 0 : context.floor
  const here = (structure.parts as StructurePart[]).filter((part) => part.floor === floor)
  drawPorchRoofs(context, here)
  if (floor === (context.plan.roof?.bearingFloor ?? 0)) drawRoofFrames(context, structure.parts)
  drawBeams(context, here)
  drawColumns(context, here)
}

export function structureLegend(plan: { structure?: { parts: StructurePart[] } }): ViewerLayerLegendEntry[] {
  const parts = plan.structure?.parts ?? []
  const entries: ViewerLayerLegendEntry[] = []
  for (const group of ['concrete', 'steel', 'masonry', 'wood'] as const) {
    const columns = parts.some((p) => p.role === 'column' && groupOf(p.material) === group)
    if (columns) entries.push({ label: `structure_column_${group}`, color: COLORS[group], shape: group === 'wood' ? 'hollow' : 'filled' })
  }
  for (const group of ['concrete', 'wood'] as const) {
    if (parts.some((p) => isDrawnBeam(p) && groupOf(p.material) === group)) entries.push({ label: `structure_beam_${group}`, color: COLORS[group], shape: 'dashed' })
  }
  if (parts.some(isRoofFrame)) entries.push({ label: 'structure_roof_frame', color: COLORS.wood, shape: 'line' })
  return entries
}

export const structureLayer: ViewerLayer = {
  id: LAYER_ID,
  label: 'structure_layer',
  defaultOn: false,
  draw: drawStructure,
  legend: structureLegend,
}
