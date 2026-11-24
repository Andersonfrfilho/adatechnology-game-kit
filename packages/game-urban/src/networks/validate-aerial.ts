import { EDGE_CLASS, isAerialEdgeKind } from './classes'
import { NETWORK_VIOLATION } from './codes'
import { catenaryHeight, circleShares, pointInPolygon, polygonCrossings, segmentEntersPolygon } from './geometry'
import type { PlanPoint } from './geometry'
import { edgeLength } from './graph'
import type { AerialClass, NetworkBuilding, NetworkEdge, NetworkNode } from './types'
import { edgeEnds } from './validate-context'
import type { ValidationContext } from './validate-context'

type Span = { readonly edge: NetworkEdge; readonly from: NetworkNode; readonly to: NetworkNode; readonly sag: number; readonly heights: readonly [number, number] }

const planOf = (node: NetworkNode): PlanPoint => [node.at[0], node.at[2]]

function validateDrop(context: ValidationContext, edge: NetworkEdge): void {
  const limit = edge.kind === 'service_drop' ? context.rules.power.dropMaxLength : edge.kind === 'telecom_drop' ? context.rules.telecom.dropMaxLength : undefined
  if (limit === undefined) return
  const length = edgeLength(context.graph, edge)
  if (length > limit) context.report({ code: NETWORK_VIOLATION.DROP_TOO_LONG, id: edge.id, value: length, limit })
}

/** The lowest point of the conductor over each sampled surface against the clearance of its class. */
function validateClearance(context: ValidationContext, span: Span): void {
  const row = context.rules.clearance[EDGE_CLASS[span.edge.kind] as AerialClass]
  const samples = Math.max(1, context.rules.catenarySamples)
  const lowest = new Map<'road' | 'sidewalk' | 'lot', number>()
  for (let index = 0; index <= samples; index++) {
    const t = index / samples
    const x = span.from.at[0] + (span.to.at[0] - span.from.at[0]) * t
    const z = span.from.at[2] + (span.to.at[2] - span.from.at[2]) * t
    const surface = context.options.surfaceAt === undefined ? 'road' : context.options.surfaceAt(x, z)
    if (surface === undefined) continue
    const height = catenaryHeight(span.heights[0], span.heights[1], span.sag, t) - (context.options.groundAt?.(x, z) ?? 0)
    lowest.set(surface, Math.min(lowest.get(surface) ?? Number.POSITIVE_INFINITY, height))
  }
  for (const [surface, height] of lowest) {
    const limit = row[surface]
    if (limit === null) context.report({ code: NETWORK_VIOLATION.MV_OVER_LOT, id: span.edge.id, detail: surface })
    else if (height < limit) context.report({ code: NETWORK_VIOLATION.CLEARANCE, id: span.edge.id, detail: surface, value: height, limit })
  }
}

const pointAt = (span: Span, t: number): PlanPoint => [span.from.at[0] + (span.to.at[0] - span.from.at[0]) * t, span.from.at[2] + (span.to.at[2] - span.from.at[2]) * t]

/** Lowest and highest conductor over the shares `[start, end]` of a span, sampled. */
function heightRange(context: ValidationContext, span: Span, start: number, end: number): readonly [number, number] {
  const samples = Math.max(1, context.rules.catenarySamples)
  let low = Number.POSITIVE_INFINITY
  let high = Number.NEGATIVE_INFINITY
  for (let index = 0; index <= samples; index++) {
    const y = catenaryHeight(span.heights[0], span.heights[1], span.sag, start + ((end - start) * index) / samples)
    low = Math.min(low, y)
    high = Math.max(high, y)
  }
  return [low, high]
}

/** The part of a span over a building, as shares, or none: a drop to its own lot may end over the house, but not cross the whole body. */
function overBuilding(span: Span, building: NetworkBuilding): readonly [number, number] | undefined {
  const a = planOf(span.from)
  const b = planOf(span.to)
  const crossings = polygonCrossings(a, b, building.outline)
  const ownLot = span.to.kind === 'connection' && span.to.lot !== undefined && building.lot === span.to.lot
  if (ownLot) return crossings.length >= 2 ? [crossings[0] as number, crossings[crossings.length - 1] as number] : undefined
  if (!segmentEntersPolygon(a, b, building.outline)) return undefined
  const start = pointInPolygon(a, building.outline) ? 0 : (crossings[0] ?? 0)
  const end = pointInPolygon(b, building.outline) ? 1 : (crossings[crossings.length - 1] ?? 1)
  return [start, end]
}

/** No span passes over a building lower than its roof. */
function validateBuildings(context: ValidationContext, span: Span): void {
  for (const building of context.options.buildings ?? []) {
    const over = overBuilding(span, building)
    if (over === undefined) continue
    const middle = pointAt(span, (over[0] + over[1]) / 2)
    const roof = (context.options.groundAt?.(middle[0], middle[1]) ?? 0) + building.height
    const [low] = heightRange(context, span, over[0], over[1])
    if (low < roof) context.report({ code: NETWORK_VIOLATION.SPAN_OVER_BUILDING, id: span.edge.id, detail: building.id, value: low, limit: roof })
  }
}

/** No span goes through a crown: the conductor over the part of the span inside the crown's radius stays out of `[bottom, top]`. */
function validateCrowns(context: ValidationContext, span: Span): void {
  for (const crown of context.options.obstacles?.crowns ?? []) {
    const inside = circleShares(planOf(span.from), planOf(span.to), [crown.x, crown.z], crown.radius)
    if (inside === undefined) continue
    const [low, high] = heightRange(context, span, inside[0], inside[1])
    if (low <= crown.top && high >= crown.bottom) context.report({ code: NETWORK_VIOLATION.SPAN_THROUGH_CROWN, id: span.edge.id, detail: `${crown.x},${crown.z}` })
  }
}

/** Drops within reach; every span with its sag, its clearance by class over road, sidewalk and lot, clear of buildings and crowns. */
export function validateAerial(context: ValidationContext): void {
  for (const edge of context.graph.edges.values()) {
    if (!isAerialEdgeKind(edge.kind)) continue
    validateDrop(context, edge)
    const ends = edgeEnds(context, edge)
    if (ends === undefined) continue
    if (edge.sag === undefined) {
      context.report({ code: NETWORK_VIOLATION.MISSING_SAG, id: edge.id })
      continue
    }
    const span: Span = { edge, from: ends[0], to: ends[1], sag: edge.sag, heights: edge.heights ?? [ends[0].at[1], ends[1].at[1]] }
    validateClearance(context, span)
    validateBuildings(context, span)
    validateCrowns(context, span)
  }
}
