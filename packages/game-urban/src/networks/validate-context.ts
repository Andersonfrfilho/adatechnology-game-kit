import type { UtilityConnection } from '@adatechnology/game-contracts'

import type { NetworkViolation } from './codes'
import type { LotFrontage } from './drop-rules'
import type { NetworkGraph } from './graph'
import type { NetworkRules } from './rules'
import type { NetworkBuilding, NetworkCrown, NetworkEdge, NetworkNode, NetworkSurface } from './types'

/** What the validator reads besides the networks: the lots' connections, the buildings and trees in the way, the ground. */
export type ValidateNetworksOptions = {
  /** Every connection a lot declared; each must be linked once, in `frame: 'world'`. */
  readonly connections?: readonly UtilityConnection[]
  /** Outlines no span may cross (a drop may end over the building of its own lot). */
  readonly buildings?: readonly NetworkBuilding[]
  /** Tree crowns no span may go through (from the scene's plant provider). */
  readonly obstacles?: { readonly crowns?: readonly NetworkCrown[] }
  /** What lies under a point of a span. Default: road everywhere (the strictest clearance a conductor may have). A point with no surface is not checked. */
  readonly surfaceAt?: (x: number, z: number) => NetworkSurface | undefined
  /** Ground level at a point. Default: 0 under a span; along a pipe, the cover levels of its two nodes. */
  readonly groundAt?: (x: number, z: number) => number
  /** The lots' fronts on their streets (`GeneratedNetworks.frontages`): with them the drops are held to the street's practice. */
  readonly frontages?: readonly LotFrontage[]
  /** Whether a point lies on a street whose power runs underground (`GeneratedNetworks.undergroundAt`): no conductor may hang over it. */
  readonly undergroundAt?: (x: number, z: number) => boolean
}

export type ValidationContext = {
  readonly graph: NetworkGraph
  readonly rules: NetworkRules
  readonly options: ValidateNetworksOptions
  readonly report: (violation: NetworkViolation) => void
}

/** The ends of an edge whose nodes both exist, or nothing. */
export function edgeEnds(context: ValidationContext, edge: NetworkEdge): readonly [NetworkNode, NetworkNode] | undefined {
  const from = context.graph.nodes.get(edge.from)
  const to = context.graph.nodes.get(edge.to)
  return from === undefined || to === undefined ? undefined : [from, to]
}
