import { NETWORK_VIOLATION } from './codes'
import type { NetworkGraph } from './graph'
import type { NetworkEdge, NetworkNode, NetworkNodeKind } from './types'
import type { ValidationContext } from './validate-context'

type Direction = readonly [number, number]
type Main = { readonly edge: NetworkEdge; readonly away: Direction }

const MAIN_KINDS: ReadonlySet<string> = new Set(['sewer_main', 'storm_gallery'])
/** The nodes a main may meet other pipes at, or turn at: a pit with a cover over it. */
const PIT_KINDS: ReadonlySet<NetworkNodeKind> = new Set(['manhole', 'pumping_station', 'treatment', 'outfall'])
const DEGREES = Math.PI / 180

function unit(dx: number, dz: number): Direction {
  const length = Math.hypot(dx, dz)
  return length === 0 ? [0, 0] : [dx / length, dz / length]
}

/** The mains (sewer mains and storm galleries) that meet at a node, each with the direction it leaves in; one of no length (two saddles on one spot) joins nothing. */
function mainsAt(graph: NetworkGraph, node: NetworkNode): Main[] {
  const leaving = graph.outgoing(node.id).filter((edge) => MAIN_KINDS.has(edge.kind)).map((edge) => ({ edge, other: graph.nodes.get(edge.to) }))
  const reaching = graph.incoming(node.id).filter((edge) => MAIN_KINDS.has(edge.kind)).map((edge) => ({ edge, other: graph.nodes.get(edge.from) }))
  return [...leaving, ...reaching].flatMap(({ edge, other }) => (other === undefined || (other.at[0] === node.at[0] && other.at[2] === node.at[2]) ? [] : [{ edge, away: unit(other.at[0] - node.at[0], other.at[2] - node.at[2]) }]))
}

/** A PV (a pit with a cover) at every crossing and every change of direction of a main: a node where three mains meet, or two that do not run straight on. */
function validatePits(context: ValidationContext): void {
  const tolerance = Math.cos((180 - context.rules.sewer.turnTolerance) * DEGREES)
  for (const node of context.graph.nodes.values()) {
    if (PIT_KINDS.has(node.kind)) continue
    const mains = mainsAt(context.graph, node)
    const [first, second] = mains
    const meets = mains.length >= 3
    const turns = mains.length === 2 && first !== undefined && second !== undefined && first.away[0] * second.away[0] + first.away[1] * second.away[1] > tolerance
    if (meets || turns) context.report({ code: NETWORK_VIOLATION.PV_MISSING, id: node.id, detail: meets ? 'crossing' : 'turn' })
  }
}

/** The kerb an inlet is on: its id without the ordinal of the inlet along the stretch (`storm:inlet:main_street:plus:02:03` is of `...:02`). */
const kerbOf = (id: string): string => id.slice(0, id.lastIndexOf(':'))

/** At most `inletSpacing` between two inlets of a kerb's stretch. */
function validateInletSpacing(context: ValidationContext, inlets: readonly NetworkNode[]): void {
  const kerbs = new Map<string, NetworkNode[]>()
  for (const inlet of inlets) kerbs.set(kerbOf(inlet.id), [...(kerbs.get(kerbOf(inlet.id)) ?? []), inlet])
  const limit = context.rules.storm.inletSpacing
  for (const kerb of kerbs.values()) {
    const alongX = Math.max(...kerb.map((inlet) => inlet.at[0])) - Math.min(...kerb.map((inlet) => inlet.at[0])) >= Math.max(...kerb.map((inlet) => inlet.at[2])) - Math.min(...kerb.map((inlet) => inlet.at[2]))
    const ordered = [...kerb].sort((a, b) => (alongX ? a.at[0] - b.at[0] : a.at[2] - b.at[2]))
    ordered.slice(1).forEach((inlet, index) => {
      const previous = ordered[index] as NetworkNode
      const gap = Math.hypot(inlet.at[0] - previous.at[0], inlet.at[2] - previous.at[2])
      if (gap > limit + 1e-6) context.report({ code: NETWORK_VIOLATION.INLET_SPACING, id: inlet.id, value: gap, limit })
    })
  }
}

/** The corners of a crossing of galleries: where the box has an arm in `+x` or `-x` and one in `+z` or `-z`, there is a corner between them. */
function cornersOf(mains: readonly Main[]): Array<readonly [number, number]> {
  const signs = (axis: 0 | 1): number[] => [...new Set(mains.filter((main) => Math.abs(main.away[axis]) > 0.7).map((main) => Math.sign(main.away[axis])))]
  return signs(0).flatMap((x) => signs(1).map((z): readonly [number, number] => [x, z]))
}

/** Every corner of a crossing has an inlet at the kerb's end: one within `cornerReach` of the gallery box, on the corner's side. */
function validateInletCorners(context: ValidationContext, inlets: readonly NetworkNode[]): void {
  const reach = context.rules.storm.cornerReach
  for (const node of context.graph.nodes.values()) {
    if (node.kind !== 'manhole' || !node.carries.includes('storm')) continue
    const mains = mainsAt(context.graph, node)
    if (mains.length < 3) continue
    for (const [x, z] of cornersOf(mains)) {
      const found = inlets.some((inlet) => Math.sign(inlet.at[0] - node.at[0]) === x && Math.sign(inlet.at[2] - node.at[2]) === z && Math.hypot(inlet.at[0] - node.at[0], inlet.at[2] - node.at[2]) <= reach)
      if (!found) context.report({ code: NETWORK_VIOLATION.INLET_AT_CORNER, id: node.id, detail: `${x > 0 ? '+' : '-'}x${z > 0 ? '+' : '-'}z`, limit: reach })
    }
  }
}

/** The direction of the street at the end of a lateral: that of the main it reaches, found through the cleanout when the lateral reaches one. */
function streetAt(graph: NetworkGraph, nodeId: string, seen: ReadonlySet<string> = new Set()): Direction | undefined {
  const node = graph.nodes.get(nodeId)
  if (node === undefined || seen.has(nodeId)) return undefined
  const [main] = mainsAt(graph, node)
  if (main !== undefined) return main.away
  const onward = graph.outgoing(nodeId).find((edge) => edge.kind === 'sewer_lateral' || edge.kind === 'storm_lateral')
  return onward === undefined ? undefined : streetAt(graph, onward.to, new Set([...seen, nodeId]))
}

/** A house lateral and an inlet's lateral meet the street at a right angle, within `branchMaxSkew`. */
function validateBranches(context: ValidationContext): void {
  const limit = context.rules.sewer.branchMaxSkew
  for (const edge of context.graph.edges.values()) {
    if (edge.kind !== 'sewer_lateral' && edge.kind !== 'storm_lateral') continue
    const from = context.graph.nodes.get(edge.from)
    const to = context.graph.nodes.get(edge.to)
    const street = streetAt(context.graph, edge.to)
    if (from === undefined || to === undefined || street === undefined) continue
    const branch = unit(to.at[0] - from.at[0], to.at[2] - from.at[2])
    if (branch[0] === 0 && branch[1] === 0) continue
    const skew = Math.abs(90 - Math.acos(Math.min(1, Math.abs(branch[0] * street[0] + branch[1] * street[1]))) / DEGREES)
    if (skew > limit) context.report({ code: NETWORK_VIOLATION.BRANCH_SKEWED, id: edge.id, value: skew, limit })
  }
}

/** What the plan of a street asks of the pipes under it: PVs where mains meet or turn, inlets along each kerb and at each corner, branches square to the street. */
export function validateSurface(context: ValidationContext): void {
  const inlets = [...context.graph.nodes.values()].filter((node) => node.kind === 'inlet')
  validatePits(context)
  validateInletSpacing(context, inlets)
  validateInletCorners(context, inlets)
  validateBranches(context)
}
