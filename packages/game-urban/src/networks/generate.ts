import type { DeepPartial, UtilityConnection } from '@adatechnology/game-contracts'

import type { CityPlanInput, PlanRect } from '../cities/types'
import { DISTRIBUTION } from '../pole-distribution'
import type { DistributionSpec } from '../pole-specs'
import { layPower, poleHeightsOf } from './aerial'
import type { NetworkSink } from './aerial'
import type { BuriedContext } from './buried'
import { lotConnectionsOf, ofNetwork } from './connections'
import type { LotFrontage } from './drop-rules'
import type { GroundAt } from './connections'
import { frameOf, hashOf } from './frame'
import { poleStationsOf } from './pole-layout'
import { poleTreeOf } from './pole-tree'
import { reachLots } from './reach'
import { resolveNetworkRules } from './rules'
import type { NetworkRules } from './rules'
import { poleSidesOf, servedLotsOf, streetRunsOf } from './runs'
import type { NetworkLot, ServedLot, StreetRun } from './runs'
import { laySewer } from './sewer'
import { inletsOf, layStorm } from './storm'
import { layTelecom } from './telecom'
import type { NetworkSurface, PowerMode, UtilityNetworks } from './types'
import { layUnderground } from './underground'
import type { NetworkWarning } from './warnings'
import { layWater } from './water'

export type GenerateNetworksParams = {
  readonly plan: CityPlanInput
  /** The lots of the site; each takes the networks from the street it faces. */
  readonly lots: readonly NetworkLot[]
  /** What the lots declared (`frame: 'world'`); a lot that declared none of a network gets the default point from its rectangle. */
  readonly connections?: readonly UtilityConnection[]
  /** A game's numbers over the defaults. */
  readonly rules?: DeepPartial<NetworkRules>
  /** Draws (illegal hookups, telecom bundles) come from the hash of the seed and an id, never from a scene's random. */
  readonly seed: number
  /** Ground no pole may stand on: the front of every gate and door, the meter posts. */
  readonly avoid?: readonly PlanRect[]
  /** Ground level at a point. Default 0 (the flat ground of a levelled city). */
  readonly groundAt?: GroundAt
  /** The distribution pole of the registry: its bands and its lamp's reach are read from its spec. Default `concrete_distribution`. */
  readonly pole?: { readonly id: string; readonly spec: DistributionSpec }
  /** On poles or under the sidewalk, per street: a line's own mode, else its district's (by id or kind), else `default` (overhead). */
  readonly power?: PowerModes
}

/** How the streets take their power: a mode per line id, per district (id or kind) and for the rest. */
export type PowerModes = {
  readonly default?: PowerMode
  readonly lines?: Readonly<Record<string, PowerMode>>
  readonly districts?: Readonly<Record<string, PowerMode>>
}

/** The mode of a run: its line's, else that of the last district of the plan holding its middle (by id, then kind), else the default. */
export function powerModeOf({ plan, modes, run }: { readonly plan: CityPlanInput; readonly modes: PowerModes | undefined; readonly run: StreetRun }): PowerMode {
  const own = modes?.lines?.[run.line]
  if (own !== undefined) return own
  const middle = (run.from + run.to) / 2
  const [x, z] = run.along === 'x' ? [middle, run.axis] : [run.axis, middle]
  const holder = [...(plan.districts ?? [])].reverse().find((district) => x >= district.rect[0] && x <= district.rect[2] && z >= district.rect[1] && z <= district.rect[3])
  return (holder === undefined ? undefined : (modes?.districts?.[holder.id] ?? modes?.districts?.[holder.kind])) ?? modes?.default ?? 'overhead'
}

export type GeneratedNetworks = {
  readonly networks: UtilityNetworks
  /** Every connection the networks link (the declared ones and the defaults), for `validateNetworks`. */
  readonly connections: readonly UtilityConnection[]
  /** Road, sidewalk or lot under a point, from the plan's streets: the `surfaceAt` of `validateNetworks`. */
  readonly surfaceAt: (x: number, z: number) => NetworkSurface
  /** The front of every lot on its street: the `frontages` of `validateNetworks` (the drop rules). */
  readonly frontages: readonly LotFrontage[]
  /** What the generator laid against its own rules because nothing else fit (empty for a plan it can lay). */
  readonly warnings: readonly NetworkWarning[]
  /** Whether a point lies on a street (roadway or sidewalk) whose power runs underground: the `undergroundAt` of `validateNetworks`. */
  readonly undergroundAt: (x: number, z: number) => boolean
}

/** What lies under a point: the roadway or the sidewalk of a street of the plan, else a lot. */
export function surfaceOf({ runs, sidewalk }: { readonly runs: readonly StreetRun[]; readonly sidewalk: number }): (x: number, z: number) => NetworkSurface {
  return (x, z) => {
    let surface: NetworkSurface = 'lot'
    for (const run of runs) {
      const [u, v] = frameOf({ frame: run, x, z })
      if (u < run.from || u > run.to) continue
      if (Math.abs(v) < run.width / 2) return 'road'
      if (Math.abs(v) < run.width / 2 + sidewalk) surface = 'sidewalk'
    }
    return surface
  }
}

/** Whether a point is in a district of the periphery (the last district of the plan that holds it decides). */
function peripheryOf({ plan, kinds }: { readonly plan: CityPlanInput; readonly kinds: readonly string[] }): (x: number, z: number) => boolean {
  const districts = [...(plan.districts ?? [])].reverse()
  return (x, z) => {
    const holder = districts.find((district) => x >= district.rect[0] && x <= district.rect[2] && z >= district.rect[1] && z <= district.rect[3])
    return holder !== undefined && kinds.includes(holder.kind)
  }
}

type Layout = { readonly rules: NetworkRules; readonly runs: readonly StreetRun[]; readonly served: readonly ServedLot[]; readonly sides: ReadonlyMap<string, 1 | -1>; readonly connections: UtilityConnection[] }

/** The poles of every run, with the ones added to reach far lots, as a tree per feed. */
function polesOf({ params, layout, sink }: { readonly params: GenerateNetworksParams; readonly layout: Layout; readonly sink: NetworkSink }) {
  const { rules, runs, served, sides } = layout
  const avoid = params.avoid ?? []
  const warn = (warning: NetworkWarning): void => void sink.warnings.push(warning)
  const stations = runs.map((run) => poleStationsOf({ run, side: sides.get(run.id) ?? -1, served, avoid, rules: rules.layout, warn }))
  const anchors = layout.connections.filter((connection) => connection.network === 'power' || connection.network === 'telecom')
  const isFree = (x: number, z: number): boolean => !avoid.some((rect) => x > rect[0] && x < rect[2] && z > rect[1] && z < rect[3])
  const surface = surfaceOf({ runs, sidewalk: rules.layout.sidewalk })
  const inside = (x: number, z: number, rect: PlanRect): boolean => x > rect[0] && x < rect[2] && z > rect[1] && z < rect[3]
  const canServe = ({ x, z, lot }: { readonly x: number; readonly z: number; readonly lot: string }): boolean =>
    surface(x, z) !== 'road' && !params.lots.some((other) => other.id !== lot && inside(x, z, other.rect))
  const reach = Math.min(rules.power.dropMaxLength, rules.telecom.dropMaxLength)
  const frontages = new Map(frontagesOf({ served, sidewalk: rules.layout.sidewalk }).map((frontage) => [frontage.lot, frontage]))
  const reached = reachLots({ runs: stations, anchors, served: new Map(served.map((entry) => [entry.lot.id, entry])), reach, rules: rules.layout, isFree, canServe, warn, frontages, power: rules.power })
  return { tree: poleTreeOf({ chains: [...reached.runs, ...reached.chains], sides, setback: rules.layout.poles.curbSetback }), feeds: reached.feeds }
}

/** The front of every lot on its street, for the drop rules (`validateNetworks`' `frontages`). */
export function frontagesOf({ served, sidewalk }: { readonly served: readonly ServedLot[]; readonly sidewalk: number }): LotFrontage[] {
  return served.map((entry) => ({ lot: entry.lot.id, rect: entry.lot.rect, frame: { along: entry.run.along, axis: entry.run.axis }, reach: entry.run.width / 2 + sidewalk, side: entry.side, span: entry.span }))
}

/**
 * The utility networks of a district from its city plan and the site's lots, as data: power (medium voltage from a feed where the trunk
 * leaves the map, transformers sized by the diversified demand, low voltage, a drop to every lot), a lamp on every street pole, telecom, sewer
 * to an interceptor along the river, drainage to headwalls on the bank, water from a reservoir at the border. Pure: the same input gives the same bytes.
 */
export function generateNetworks(params: GenerateNetworksParams): GeneratedNetworks {
  const rules = resolveNetworkRules(params.rules)
  const groundAt = params.groundAt ?? ((): number => 0)
  const runs = streetRunsOf({ plan: params.plan, edgeReach: rules.layout.edgeReach })
  const underground = new Set(runs.filter((run) => powerModeOf({ plan: params.plan, modes: params.power, run }) === 'underground').map((run) => run.id))
  const overheadRuns = runs.filter((run) => !underground.has(run.id))
  const served = servedLotsOf({ lots: params.lots, runs })
  const sides = poleSidesOf({ runs, served })
  const buriedLots = new Set(served.filter((entry) => underground.has(entry.run.id)).map((entry) => entry.lot.id))
  const connections = lotConnectionsOf({ served, declared: params.connections ?? [], rules, groundAt, buried: buriedLots })
  const aerial = (connection: UtilityConnection): boolean => !buriedLots.has(connection.lot)
  const sink: NetworkSink = { nodes: [], edges: [], warnings: [] }
  const pole = params.pole ?? { id: 'concrete_distribution', spec: DISTRIBUTION }
  const heights = poleHeightsOf(pole.spec.slots)
  const isPeriphery = peripheryOf({ plan: params.plan, kinds: rules.layout.periphery.kinds })
  const surface = surfaceOf({ runs, sidewalk: rules.layout.sidewalk })
  if (overheadRuns.length > 0) {
    const overheadServed = served.filter((entry) => !underground.has(entry.run.id))
    const { tree, feeds } = polesOf({ params, layout: { rules, runs: overheadRuns, served: overheadServed, sides, connections: connections.filter(aerial) }, sink })
    const unmetered = new Set(
      overheadServed
        .filter(({ lot }) => isPeriphery((lot.rect[0] + lot.rect[2]) / 2, (lot.rect[1] + lot.rect[3]) / 2) && hashOf({ seed: params.seed, id: `hookup:${lot.id}` }) < rules.layout.periphery.hookupShare)
        .map((entry) => entry.lot.id),
    )
    layPower({ tree, connections: ofNetwork({ connections, network: 'power' }).filter(aerial), rules, heights, pole: { id: pole.id, lampReach: pole.spec.lamp.reach }, unmetered, feeds, sink })
    layTelecom({ tree, connections: ofNetwork({ connections, network: 'telecom' }).filter(aerial), rules, heights, seed: params.seed, isPeriphery, feeds, sink })
  }
  const [width, depth] = params.plan.size ?? [0, 0]
  const rivers = (params.plan.lines ?? []).filter((line) => line.kind === 'river')
  const base: BuriedContext = { runs, sides, served: new Map(served.map((entry) => [entry.lot.id, entry])), rules, groundAt, rivers, border: [width / 2, depth / 2], sink }
  const ducts = layUnderground({
    context: base,
    runs: runs.filter((run) => underground.has(run.id)),
    connections: connections.filter((connection) => !aerial(connection)),
    column: { id: pole.id, lampReach: pole.spec.lamp.reach, heights },
    canStand: (x, z) => surface(x, z) === 'sidewalk' && !(params.avoid ?? []).some((rect) => x > rect[0] && x < rect[2] && z > rect[1] && z < rect[3]),
    crossings: crossingsOf({ context: base, connections }),
  })
  const context: BuriedContext = { ...base, banks: ducts.banks }
  const storm = layStorm({ context, connections: ofNetwork({ connections, network: 'storm' }), above: ducts.edges })
  layWater({ context, connections: ofNetwork({ connections, network: 'water' }) })
  laySewer({ context, connections: ofNetwork({ connections, network: 'sewer' }), above: [...storm, ...ducts.edges] })
  const networks: UtilityNetworks = { nodes: sink.nodes, edges: sink.edges, seed: params.seed, rules }
  const undergroundAt = (x: number, z: number): boolean =>
    runs.some((run) => {
      if (!underground.has(run.id)) return false
      const [u, v] = frameOf({ frame: run, x, z })
      return u >= run.from && u <= run.to && Math.abs(v) <= run.width / 2 + rules.layout.sidewalk
    })
  return { networks, connections, surfaceAt: surface, frontages: frontagesOf({ served, sidewalk: rules.layout.sidewalk }), warnings: sink.warnings, undergroundAt }
}

/** Stations along each street of the pipes that cross it to the lots (every lot point) and of its inlets: a light column's cable keeps clear of them. */
function crossingsOf({ context, connections }: { readonly context: BuriedContext; readonly connections: readonly UtilityConnection[] }): ReadonlyMap<string, readonly number[]> {
  const out = new Map<string, number[]>()
  for (const connection of connections) {
    const served = context.served.get(connection.lot)
    if (served === undefined) continue
    out.set(served.run.id, [...(out.get(served.run.id) ?? []), frameOf({ frame: served.run, x: connection.at[0], z: connection.at[2] })[0]])
  }
  for (const inlet of inletsOf(context)) out.set(inlet.run.id, [...(out.get(inlet.run.id) ?? []), inlet.u])
  return out
}
