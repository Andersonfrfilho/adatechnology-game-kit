import { EDGE_NETWORK, POWER_DUCTS, isAerialEdgeKind, isDuctEdgeKind } from './classes'
import { NETWORK_VIOLATION } from './codes'
import { edgeLength } from './graph'
import { pipeOf } from './validate-buried'
import type { Pipe } from './validate-buried'
import type { ValidationContext } from './validate-context'

/** Two pipes closer than this to parallel (the sine of the angle between them) run side by side. */
const PARALLEL_SINE = Math.sin((10 * Math.PI) / 180)
/** Least length (metres) two pipes run side by side before their gap counts. */
const MIN_OVERLAP = 0.05
const BESIDE: ReadonlySet<string> = new Set(['water_main', 'water_service', 'sewer_main', 'sewer_lateral', 'storm_gallery', 'storm_lateral'])

type Plan = readonly [number, number]
const planOf = (pipe: Pipe): readonly [Plan, Plan] => [
  [pipe.from.at[0], pipe.from.at[2]],
  [pipe.to.at[0], pipe.to.at[2]],
]
const shareEnds = (a: Pipe, b: Pipe): boolean => a.edge.from === b.edge.from || a.edge.from === b.edge.to || a.edge.to === b.edge.from || a.edge.to === b.edge.to

/** The clear gap in plan between a power duct and a pipe that runs beside it, where they overlap along the duct; none when they are not parallel or do not overlap. */
function sideGap(duct: Pipe, other: Pipe): number | undefined {
  const [a0, a1] = planOf(duct)
  const [b0, b1] = planOf(other)
  const [dx, dz] = [a1[0] - a0[0], a1[1] - a0[1]]
  const length = Math.hypot(dx, dz)
  const otherLength = Math.hypot(b1[0] - b0[0], b1[1] - b0[1])
  if (length < 1e-9 || otherLength < 1e-9) return undefined
  const sine = Math.abs(dx * (b1[1] - b0[1]) - dz * (b1[0] - b0[0])) / (length * otherLength)
  if (sine > PARALLEL_SINE) return undefined
  const along = (point: Plan): number => ((point[0] - a0[0]) * dx + (point[1] - a0[1]) * dz) / length
  const [t0, t1] = [along(b0), along(b1)].sort((p, q) => p - q) as [number, number]
  const [from, to] = [Math.max(0, t0), Math.min(length, t1)]
  if (to - from < MIN_OVERLAP) return undefined
  const across = (point: Plan): number => Math.abs((point[0] - a0[0]) * dz - (point[1] - a0[1]) * dx) / length
  const middle = (from + to) / 2
  const share = (middle - t0) / Math.max(t1 - t0, 1e-9)
  const at: Plan = along(b0) <= along(b1) ? [b0[0] + (b1[0] - b0[0]) * share, b0[1] + (b1[1] - b0[1]) * share] : [b1[0] + (b0[0] - b1[0]) * share, b1[1] + (b0[1] - b1[1]) * share]
  return across(at) - (duct.edge.width ?? duct.diameter) / 2 - (other.edge.width ?? other.diameter) / 2
}

/** A power duct keeps `underground.parallel` of clear ground beside every water, sewer and storm pipe it runs along. */
function validateParallel(context: ValidationContext, pipes: readonly Pipe[]): void {
  const limit = context.rules.underground.parallel
  for (const duct of pipes) {
    if (!POWER_DUCTS.has(duct.kind)) continue
    for (const other of pipes) {
      if (!BESIDE.has(other.kind) || shareEnds(duct, other)) continue
      const gap = sideGap(duct, other)
      if (gap !== undefined && gap < limit) context.report({ code: NETWORK_VIOLATION.PARALLEL_TOO_CLOSE, id: `${duct.edge.id}|${other.edge.id}`, value: gap, limit })
    }
  }
}

/** The bank has a box at most every `underground.boxSpacing` metres: its nodes are the boxes, so no duct of the bank is longer. */
function validateBoxes(context: ValidationContext, pipes: readonly Pipe[]): void {
  const limit = context.rules.underground.boxSpacing
  for (const pipe of pipes) {
    if (pipe.kind !== 'mv_duct' && pipe.kind !== 'lv_duct' && pipe.kind !== 'telecom_duct') continue
    const length = edgeLength(context.graph, pipe.edge)
    if (length > limit) context.report({ code: NETWORK_VIOLATION.BOX_SPACING, id: pipe.edge.id, value: length, limit })
  }
}

/** On a street whose power is underground nothing hangs in the air but the lamps on their columns: no pole carries a conductor, no span crosses it. */
function validateNoAerial(context: ValidationContext): void {
  const isUnderground = context.options.undergroundAt
  if (isUnderground === undefined) return
  for (const node of context.graph.nodes.values()) {
    if (node.kind === 'pole' && node.carries.some((network) => network !== 'lighting') && isUnderground(node.at[0], node.at[2])) context.report({ code: NETWORK_VIOLATION.AERIAL_ON_UNDERGROUND, id: node.id })
  }
  const samples = Math.max(1, context.rules.catenarySamples)
  for (const edge of context.graph.edges.values()) {
    if (!isAerialEdgeKind(edge.kind) || edge.kind === 'light_feed') continue
    const [from, to] = [context.graph.nodes.get(edge.from), context.graph.nodes.get(edge.to)]
    if (from === undefined || to === undefined) continue
    for (let index = 0; index <= samples; index++) {
      const t = index / samples
      if (!isUnderground(from.at[0] + (to.at[0] - from.at[0]) * t, from.at[2] + (to.at[2] - from.at[2]) * t)) continue
      context.report({ code: NETWORK_VIOLATION.AERIAL_ON_UNDERGROUND, id: edge.id, detail: EDGE_NETWORK[edge.kind] })
      break
    }
  }
}

/** Underground power: separation beside the other pipes, boxes along the bank, and nothing in the air over its streets. The crossings and covers are the buried rules'. */
export function validateUnderground(context: ValidationContext): void {
  const pipes: Pipe[] = []
  for (const edge of context.graph.edges.values()) {
    if (isAerialEdgeKind(edge.kind)) continue
    const pipe = pipeOf(context, edge, { quiet: true })
    if (pipe !== undefined && (isDuctEdgeKind(pipe.kind) || BESIDE.has(pipe.kind))) pipes.push(pipe)
  }
  validateParallel(context, pipes)
  validateBoxes(context, pipes)
  validateNoAerial(context)
}
