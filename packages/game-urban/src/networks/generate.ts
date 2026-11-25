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
import { layStorm } from './storm'
import { layTelecom } from './telecom'
import type { NetworkSurface, UtilityNetworks } from './types'
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
  const served = servedLotsOf({ lots: params.lots, runs })
  const sides = poleSidesOf({ runs, served })
  const connections = lotConnectionsOf({ served, declared: params.connections ?? [], rules, groundAt })
  const sink: NetworkSink = { nodes: [], edges: [], warnings: [] }
  const { tree, feeds } = polesOf({ params, layout: { rules, runs, served, sides, connections }, sink })
  const pole = params.pole ?? { id: 'concrete_distribution', spec: DISTRIBUTION }
  const heights = poleHeightsOf(pole.spec.slots)
  const isPeriphery = peripheryOf({ plan: params.plan, kinds: rules.layout.periphery.kinds })
  const unmetered = new Set(
    served
      .filter(({ lot }) => isPeriphery((lot.rect[0] + lot.rect[2]) / 2, (lot.rect[1] + lot.rect[3]) / 2) && hashOf({ seed: params.seed, id: `hookup:${lot.id}` }) < rules.layout.periphery.hookupShare)
      .map((entry) => entry.lot.id),
  )
  layPower({ tree, connections: ofNetwork({ connections, network: 'power' }), rules, heights, pole: { id: pole.id, lampReach: pole.spec.lamp.reach }, unmetered, feeds, sink })
  layTelecom({ tree, connections: ofNetwork({ connections, network: 'telecom' }), rules, heights, seed: params.seed, isPeriphery, feeds, sink })
  const [width, depth] = params.plan.size ?? [0, 0]
  const rivers = (params.plan.lines ?? []).filter((line) => line.kind === 'river')
  const context: BuriedContext = { runs, sides, served: new Map(served.map((entry) => [entry.lot.id, entry])), rules, groundAt, rivers, border: [width / 2, depth / 2], sink }
  const storm = layStorm({ context, connections: ofNetwork({ connections, network: 'storm' }) })
  layWater({ context, connections: ofNetwork({ connections, network: 'water' }) })
  laySewer({ context, connections: ofNetwork({ connections, network: 'sewer' }), above: storm })
  const networks: UtilityNetworks = { nodes: sink.nodes, edges: sink.edges, seed: params.seed, rules }
  return { networks, connections, surfaceAt: surfaceOf({ runs, sidewalk: rules.layout.sidewalk }), frontages: frontagesOf({ served, sidewalk: rules.layout.sidewalk }), warnings: sink.warnings }
}
