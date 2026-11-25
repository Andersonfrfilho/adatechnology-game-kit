import { connectedNodes, buildNetworkGraph } from './graph'
import type { Breach } from './breach'
import type { FluidContent } from './pipes'
import { isFluidContent, pipePiecesOf } from './pipes'
import type { NetworkKind } from './types'
import type { UtilityNetworks } from './types'

/** What one broken pipe lets out: the fluid, where, how fast at most, and how much is there to lose (finite: a valve closes, a pipe empties). */
export type NetworkLeak = {
  /** The id of the pipe (its edge). */
  readonly id: string
  readonly content: FluidContent
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

/** The houses that lose their water or their power, and the nodes of the network (hydrants, valves, services; boxes, light columns) that go with them. */
export type NetworkOutage = {
  readonly network: 'water' | 'power'
  /** The pipes or ducts whose break cut the supply. */
  readonly causes: readonly string[]
  /** Nodes the source (the reservoir, the feed) no longer reaches. */
  readonly nodes: readonly string[]
  /** Lots (`NetworkNode.lot`) with no water, or no power. */
  readonly lots: readonly string[]
  /** Power: the street lights (`light` nodes) left dark. */
  readonly lights?: readonly string[]
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

export type LeakRules = Readonly<Record<FluidContent, LeakRule>>

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
    const content = reached.content
    if (!reached.severed || pipe === undefined || !isFluidContent(content)) return []
    if (content === 'stormwater' && !isRaining) return []
    const rule = rules[content]
    const rate = BRANCH_KINDS.has(pipe.kind) ? rule.branchRate : rule.mainRate
    return [{ id: reached.id, content, at: reached.at, diameter: pipe.diameter, rate, volume: rate * rule.seconds, isPressurised: rule.isPressurised }]
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
export function waterOutageOf(networks: Pick<UtilityNetworks, 'nodes' | 'edges'>, severed: Severed): NetworkOutage | undefined {
  const lost = lostOf({ networks, severed, kinds: ['water'] })
  if (lost.length === 0) return undefined
  return { network: 'water', causes: causesOf(severed), nodes: lost.map((node) => node.id), lots: [...new Set(lost.flatMap((node) => node.lot ?? []))] }
}

/** The ducts broken before a blast, and with it. */
export type Severed = { readonly before: readonly string[]; readonly after: readonly string[] }

const causesOf = ({ before, after }: Severed): string[] => {
  const already = new Set(before)
  return after.filter((id) => !already.has(id))
}

/** The nodes carrying one of `kinds` that their source reached with the `before` edges broken and no longer reaches with the `after` ones. */
function lostOf({ networks, severed, kinds }: { readonly networks: Pick<UtilityNetworks, 'nodes' | 'edges'>; readonly severed: Severed; readonly kinds: readonly NetworkKind[] }) {
  const supplied = (broken: readonly string[]): ReadonlySet<string> => {
    const gone = new Set(broken)
    const graph = buildNetworkGraph({ nodes: networks.nodes, edges: networks.edges.filter((edge) => !gone.has(edge.id)) })
    return new Set(kinds.flatMap((kind) => [...connectedNodes(graph, kind)]))
  }
  const [was, is] = [supplied(severed.before), supplied(severed.after)]
  return networks.nodes.filter((node) => node.carries.some((kind) => kinds.includes(kind)) && was.has(node.id) && !is.has(node.id))
}

/**
 * The houses and street lights that lose their power when the ducts in `after` are cut and the ones in `before` already were: a medium voltage
 * duct darkens every circuit past it (its pads no longer fed), a low voltage duct the boxes past it, a lateral its lot, a light's cable its
 * lamp. Pure, from the graph walked once without the severed ducts.
 */
export function powerOutageOf(networks: Pick<UtilityNetworks, 'nodes' | 'edges'>, severed: Severed): NetworkOutage | undefined {
  const lost = lostOf({ networks, severed, kinds: ['power_lv', 'lighting'] })
  if (lost.length === 0) return undefined
  const lots = [...new Set(lost.filter((node) => node.carries.includes('power_lv')).flatMap((node) => node.lot ?? []))]
  return { network: 'power', causes: causesOf(severed), nodes: lost.map((node) => node.id), lots, lights: lost.filter((node) => node.kind === 'light').map((node) => node.id) }
}
