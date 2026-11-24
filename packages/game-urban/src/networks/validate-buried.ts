import { isAerialEdgeKind } from './classes'
import { NETWORK_VIOLATION } from './codes'
import { segmentCrossing } from './geometry'
import { edgeLength } from './graph'
import type { BuriedEdgeKind, NetworkEdge, NetworkNode } from './types'
import { edgeEnds } from './validate-context'
import type { ValidationContext } from './validate-context'

/** A pipe with everything the rules read: its ends, the inverts at each end and its diameter. */
type Pipe = { readonly edge: NetworkEdge; readonly kind: BuriedEdgeKind; readonly from: NetworkNode; readonly to: NetworkNode; readonly inverts: readonly [number, number]; readonly diameter: number }

const SLOPE_TOLERANCE = 1e-3

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

function groundAt(context: ValidationContext, pipe: Pipe, t: number): number {
  const x = lerp(pipe.from.at[0], pipe.to.at[0], t)
  const z = lerp(pipe.from.at[2], pipe.to.at[2], t)
  return context.options.groundAt?.(x, z) ?? lerp(pipe.from.at[1], pipe.to.at[1], t)
}

function pipeOf(context: ValidationContext, edge: NetworkEdge): Pipe | undefined {
  if (isAerialEdgeKind(edge.kind)) return undefined
  const ends = edgeEnds(context, edge)
  if (ends === undefined) return undefined
  const inverts = edge.inverts ?? (ends[0].invert !== undefined && ends[1].invert !== undefined ? ([ends[0].invert, ends[1].invert] as const) : undefined)
  if (inverts === undefined) context.report({ code: NETWORK_VIOLATION.MISSING_INVERT, id: edge.id })
  if (edge.diameter === undefined) context.report({ code: NETWORK_VIOLATION.MISSING_DIAMETER, id: edge.id })
  if (inverts === undefined || edge.diameter === undefined) return undefined
  return { edge, kind: edge.kind, from: ends[0], to: ends[1], inverts, diameter: edge.diameter }
}

/** Gravity pipes fall along the flow by at least the least slope; a declared slope agrees with the inverts. */
function validateSlope(context: ValidationContext, pipe: Pipe): void {
  if (pipe.kind === 'water_main' || pipe.kind === 'water_service') return
  const length = edgeLength(context.graph, pipe.edge)
  if (length === 0) return
  const slope = (pipe.inverts[0] - pipe.inverts[1]) / length
  const limit = context.rules.minSlope[pipe.kind]
  if (slope < limit) context.report({ code: NETWORK_VIOLATION.SLOPE, id: pipe.edge.id, value: slope, limit })
  if (pipe.edge.slope !== undefined && Math.abs(pipe.edge.slope - slope) > SLOPE_TOLERANCE) context.report({ code: NETWORK_VIOLATION.SLOPE_MISMATCH, id: pipe.edge.id, value: pipe.edge.slope, limit: slope })
}

/** Cover from the ground to the top of the pipe within its range, sampled along it; a sewer no deeper than the pumping limit. */
function validateCover(context: ValidationContext, pipe: Pipe): void {
  const range = context.rules.cover[pipe.kind]
  const samples = Math.max(1, context.rules.catenarySamples)
  let least = Number.POSITIVE_INFINITY
  let most = Number.NEGATIVE_INFINITY
  let deepest = Number.NEGATIVE_INFINITY
  for (let index = 0; index <= samples; index++) {
    const t = index / samples
    const ground = groundAt(context, pipe, t)
    const invert = lerp(pipe.inverts[0], pipe.inverts[1], t)
    least = Math.min(least, ground - invert - pipe.diameter)
    most = Math.max(most, ground - invert - pipe.diameter)
    deepest = Math.max(deepest, ground - invert)
  }
  if (least < range.min) context.report({ code: NETWORK_VIOLATION.COVER, id: pipe.edge.id, detail: 'min', value: least, limit: range.min })
  if (range.max !== undefined && most > range.max) context.report({ code: NETWORK_VIOLATION.COVER, id: pipe.edge.id, detail: 'max', value: most, limit: range.max })
  const isSewer = pipe.kind === 'sewer_main' || pipe.kind === 'sewer_lateral'
  if (isSewer && deepest > context.rules.sewer.maxDepth) context.report({ code: NETWORK_VIOLATION.TOO_DEEP, id: pipe.edge.id, value: deepest, limit: context.rules.sewer.maxDepth })
}

const shareEnds = (a: NetworkEdge, b: NetworkEdge): boolean => a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to

/** Two pipes that cross in plan keep the least vertical gap, and the one of lower rank (water, then the sewer lateral, then drainage, then the sewer main) goes above. */
function validateCrossing(context: ValidationContext, a: Pipe, b: Pipe): void {
  if (shareEnds(a.edge, b.edge)) return
  const crossing = segmentCrossing([a.from.at[0], a.from.at[2]], [a.to.at[0], a.to.at[2]], [b.from.at[0], b.from.at[2]], [b.to.at[0], b.to.at[2]])
  if (crossing === undefined) return
  const bottomA = lerp(a.inverts[0], a.inverts[1], crossing[0])
  const bottomB = lerp(b.inverts[0], b.inverts[1], crossing[1])
  const [upper, lower, upperBottom, lowerBottom] = bottomA >= bottomB ? [a, b, bottomA, bottomB] : [b, a, bottomB, bottomA]
  const gap = upperBottom - (lowerBottom + lower.diameter)
  const id = `${a.edge.id}x${b.edge.id}`
  const separation = context.rules.crossing.separation
  if (gap < separation) context.report({ code: NETWORK_VIOLATION.CROSSING_TOO_CLOSE, id, value: gap, limit: separation })
  const rank = context.rules.crossing.rank
  if (rank[upper.kind] > rank[lower.kind]) context.report({ code: NETWORK_VIOLATION.CROSSING_ORDER, id, detail: `${upper.edge.id} above ${lower.edge.id}` })
}

/** Inverts and diameters known, slopes, covers and depths, and every crossing between two pipes. */
export function validateBuried(context: ValidationContext): void {
  const pipes: Pipe[] = []
  for (const edge of context.graph.edges.values()) {
    const pipe = pipeOf(context, edge)
    if (pipe === undefined) continue
    validateSlope(context, pipe)
    validateCover(context, pipe)
    pipes.push(pipe)
  }
  for (let first = 0; first < pipes.length; first++) {
    for (let second = first + 1; second < pipes.length; second++) validateCrossing(context, pipes[first] as Pipe, pipes[second] as Pipe)
  }
}
