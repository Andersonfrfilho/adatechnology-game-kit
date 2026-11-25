import { connectedNodes, buildNetworkGraph } from './graph'
import type { Breach } from './breach'
import type { PipeContent } from './pipes'
import { pipePiecesOf } from './pipes'
import type { UtilityNetworks } from './types'

/** What one broken pipe lets out: the fluid, where, how fast at most, and how much is there to lose (finite: a valve closes, a pipe empties). */
export type NetworkLeak = {
  /** The id of the pipe (its edge). */
  readonly id: string
  readonly content: PipeContent
  /** The break: world metres, `y` the pipe's centre line. */
  readonly at: readonly [number, number, number]
  readonly diameter: number
  /** Litres per second at most. */
  readonly rate: number
  /** Litres there are to lose, in all. */
  readonly volume: number
  /** It leaves under pressure (a water main), up out of the ground; the rest runs. */
  readonly isPressurised: boolean
}

/** The houses that lose their water, and the nodes of the network (hydrants, valves, services) that go with them. */
export type NetworkOutage = {
  readonly network: 'water'
  /** The pipes whose break cut the supply. */
  readonly causes: readonly string[]
  /** Nodes the reservoir no longer reaches. */
  readonly nodes: readonly string[]
  /** Lots (`NetworkNode.lot`) with no water. */
  readonly lots: readonly string[]
}

/** What a blast on the networks tells the host, in the order it happens: a pipe leaks, a house loses its water, a cover opens its hole. */
export type NetworkEvent =
  | { readonly type: 'network_leak'; readonly leak: NetworkLeak }
  | { readonly type: 'network_outage'; readonly outage: NetworkOutage }
  | { readonly type: 'network_hole'; readonly id: string; readonly kind: string }

export type LeakRule = {
  /** Litres per second of the break (a bored main, a service). */
  readonly mainRate: number
  readonly branchRate: number
  /** Seconds before the utility closes the valve (water), the inflow stops (sewage) or the rain does (drainage): the volume is `rate` times this. */
  readonly seconds: number
  readonly isPressurised: boolean
}

export type LeakRules = Readonly<Record<PipeContent, LeakRule>>

export const DEFAULT_LEAK_RULES: LeakRules = {
  water: { mainRate: 6, branchRate: 0.8, seconds: 300, isPressurised: true },
  sewage: { mainRate: 0.5, branchRate: 0.15, seconds: 600, isPressurised: false },
  stormwater: { mainRate: 2, branchRate: 0.6, seconds: 240, isPressurised: false },
}

const BRANCH_KINDS: ReadonlySet<string> = new Set(['water_service', 'sewer_lateral', 'storm_lateral'])

export type LeaksOptions = {
  /** The drainage only runs while it rains (`game-weather`: `effects.rain` above zero). */
  readonly isRaining: boolean
  readonly rules?: LeakRules
}

/**
 * The leaks a breach opens: one for each pipe the bowl severed, of its content, at the break. Water runs under pressure and comes up out of the crater; sewage runs slow; stormwater only runs
 * when it rains. Each is finite (`rate` for `seconds`): `drainLeak` gives what a step lets out until nothing is left. Pure, in the order of the breach.
 */
export function leaksOf(networks: Pick<UtilityNetworks, 'nodes' | 'edges'>, breach: Breach, { isRaining, rules = DEFAULT_LEAK_RULES }: LeaksOptions): NetworkLeak[] {
  const pipes = new Map(pipePiecesOf(networks).map((pipe) => [pipe.id, pipe]))
  return breach.pipes.flatMap((reached): NetworkLeak[] => {
    const pipe = pipes.get(reached.id)
    if (!reached.severed || pipe === undefined) return []
    if (reached.content === 'stormwater' && !isRaining) return []
    const rule = rules[reached.content]
    const rate = BRANCH_KINDS.has(pipe.kind) ? rule.branchRate : rule.mainRate
    return [{ id: reached.id, content: reached.content, at: reached.at, diameter: pipe.diameter, rate, volume: rate * rule.seconds, isPressurised: rule.isPressurised }]
  })
}

/** A leak being let out: what is left of it. */
export type LeakState = { readonly leak: NetworkLeak; remaining: number }

export function startLeak(leak: NetworkLeak): LeakState {
  return { leak, remaining: leak.volume }
}

/** Litres a step of `dt` seconds lets out of a leak (never more than its rate, never more than is left); takes them from `remaining`. */
export function drainLeak(state: LeakState, dt: number): number {
  const out = Math.min(state.leak.rate * Math.max(0, dt), state.remaining)
  state.remaining -= out
  return out
}

/**
 * The houses that lose their water when the pipes in `after` are broken and the ones in `before` already were: the nodes the reservoir reached then and reaches no more,
 * and the lots among them. Pure, from the graph walked once without the severed edges (a tree loses everything downstream of the break).
 */
export function waterOutageOf(networks: Pick<UtilityNetworks, 'nodes' | 'edges'>, { before, after }: { readonly before: readonly string[]; readonly after: readonly string[] }): NetworkOutage | undefined {
  const supplied = (severed: readonly string[]): ReadonlySet<string> => {
    const gone = new Set(severed)
    return connectedNodes(buildNetworkGraph({ nodes: networks.nodes, edges: networks.edges.filter((edge) => !gone.has(edge.id)) }), 'water')
  }
  const [was, is] = [supplied(before), supplied(after)]
  const lost = networks.nodes.filter((node) => node.carries.includes('water') && was.has(node.id) && !is.has(node.id))
  if (lost.length === 0) return undefined
  const lots = [...new Set(lost.flatMap((node) => node.lot ?? []))]
  const already = new Set(before)
  return { network: 'water', causes: after.filter((id) => !already.has(id)), nodes: lost.map((node) => node.id), lots }
}
