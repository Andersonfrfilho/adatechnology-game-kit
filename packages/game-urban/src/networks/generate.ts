import type { DeepPartial, UtilityConnection } from '@adatechnology/game-contracts'

import type { CityPlanInput, PlanRect } from '../cities/types'
import type { PoleSlots } from '../pole-specs'
import { layPower, poleHeightsOf } from './aerial'
import type { NetworkSink } from './aerial'
import type { BuriedContext } from './buried'
import { lotConnectionsOf, ofNetwork } from './connections'
import type { GroundAt } from './connections'
import { frameOf, hashOf } from './frame'
import { poleStationsOf } from './pole-layout'
import { poleTreeOf } from './pole-tree'
import { resolveNetworkRules } from './rules'
import type { NetworkRules } from './rules'
import { poleSidesOf, servedLotsOf, streetRunsOf } from './runs'
import type { NetworkLot, StreetRun } from './runs'
import { laySewer } from './sewer'
import { DEFAULT_POLE_SLOTS } from './slots'
import { layStorm } from './storm'
import { layTelecom } from './telecom'
import type { NetworkSurface, UtilityNetworks } from './types'
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
  /** The distribution pole of the registry and its bands. Default `concrete_distribution` with `DEFAULT_POLE_SLOTS`. */
  readonly pole?: { readonly id: string; readonly slots: PoleSlots }
}

export type GeneratedNetworks = {
  readonly networks: UtilityNetworks
  /** Every connection the networks link (the declared ones and the defaults), for `validateNetworks`. */
  readonly connections: readonly UtilityConnection[]
  /** Road, sidewalk or lot under a point, from the plan's streets: the `surfaceAt` of `validateNetworks`. */
  readonly surfaceAt: (x: number, z: number) => NetworkSurface
}

/** What lies under a point: the roadway or the sidewalk of a street of the plan, else a lot. */
export function surfaceOf(runs: readonly StreetRun[], sidewalk: number): (x: number, z: number) => NetworkSurface {
  return (x, z) => {
    let surface: NetworkSurface = 'lot'
    for (const run of runs) {
      const [u, v] = frameOf(run.along, run.axis, x, z)
      if (u < run.from || u > run.to) continue
      if (Math.abs(v) < run.width / 2) return 'road'
      if (Math.abs(v) < run.width / 2 + sidewalk) surface = 'sidewalk'
    }
    return surface
  }
}

/** Whether a point is in a district of the periphery (the last district of the plan that holds it decides). */
function peripheryOf(plan: CityPlanInput, kinds: readonly string[]): (x: number, z: number) => boolean {
  const districts = plan.districts ?? []
  return (x, z) => {
    const holder = [...districts].reverse().find((district) => x >= district.rect[0] && x <= district.rect[2] && z >= district.rect[1] && z <= district.rect[3])
    return holder !== undefined && kinds.includes(holder.kind)
  }
}

/**
 * The utility networks of a district from its city plan and the site's lots, as data: power (medium voltage from a feed where the trunk
 * leaves the map, transformers sized by the diversified demand, low voltage, a drop to every lot), a lamp on every pole, telecom, sewer to an
 * interceptor along the river, drainage to headwalls on the bank, water from a reservoir at the border. Pure: the same input gives the same bytes.
 */
export function generateNetworks(params: GenerateNetworksParams): GeneratedNetworks {
  const rules = resolveNetworkRules(params.rules)
  const layout = rules.layout
  const groundAt = params.groundAt ?? ((): number => 0)
  const runs = streetRunsOf(params.plan, layout.edgeReach)
  const served = servedLotsOf(params.lots, runs)
  const sides = poleSidesOf(runs, served)
  const connections = lotConnectionsOf(served, params.connections ?? [], layout, groundAt)
  const stations = runs.map((run) => poleStationsOf({ run, side: sides.get(run.id) ?? -1, served, avoid: params.avoid ?? [], rules: layout }))
  const tree = poleTreeOf(stations, sides, layout.poles.curbSetback)
  const pole = params.pole ?? { id: 'concrete_distribution', slots: DEFAULT_POLE_SLOTS }
  const heights = poleHeightsOf(pole.slots)
  const isPeriphery = peripheryOf(params.plan, layout.periphery.kinds)
  const unmetered = new Set(
    served.filter((entry) => {
      const [x0, z0, x1, z1] = entry.lot.rect
      return isPeriphery((x0 + x1) / 2, (z0 + z1) / 2) && hashOf(params.seed, `hookup:${entry.lot.id}`) < layout.periphery.hookupShare
    }).map((entry) => entry.lot.id),
  )
  const sink: NetworkSink = { nodes: [], edges: [] }
  layPower({ tree, connections: ofNetwork(connections, 'power'), rules, heights, poleSpec: pole.id, unmetered, sink })
  layTelecom({ tree, connections: ofNetwork(connections, 'telecom'), rules, heights, seed: params.seed, isPeriphery, sink })
  const context: BuriedContext = { runs, sides, served: new Map(served.map((entry) => [entry.lot.id, entry])), rules, groundAt, rivers: (params.plan.lines ?? []).filter((line) => line.kind === 'river'), sink }
  const storm = layStorm(context, ofNetwork(connections, 'storm'))
  layWater(context, ofNetwork(connections, 'water'))
  laySewer(context, ofNetwork(connections, 'sewer'), storm)
  return { networks: { nodes: sink.nodes, edges: sink.edges, seed: params.seed, rules }, connections, surfaceAt: surfaceOf(runs, layout.sidewalk) }
}
