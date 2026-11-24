import type { NetworkViolation } from './codes'
import { buildNetworkGraph } from './graph'
import type { UtilityNetworks } from './types'
import { validateAerial } from './validate-aerial'
import { validateBuried } from './validate-buried'
import { validateDrops } from './validate-drops'
import type { ValidateNetworksOptions, ValidationContext } from './validate-context'
import { validateLoad } from './validate-load'
import { validateIds, validateLots, validateOrphans, validateTrees } from './validate-structure'

/**
 * Everything wrong with the networks, by the rules they carry: ids and links, each network a tree tied to its source, every lot linked once,
 * spans (reach, sag, clearance, buildings, crowns), pipes (slope, cover, depth, crossings) and transformers (loading, circuit length).
 * Pure and in input order: the same networks give the same list.
 */
export function validateNetworks(networks: UtilityNetworks, options: ValidateNetworksOptions = {}): NetworkViolation[] {
  const violations: NetworkViolation[] = []
  const context: ValidationContext = { graph: buildNetworkGraph(networks), rules: networks.rules, options, report: (violation) => violations.push(violation) }
  validateIds(context, networks)
  validateTrees(context)
  validateLots(context)
  validateOrphans(context)
  validateAerial(context)
  validateDrops(context)
  validateBuried(context)
  validateLoad(context)
  return violations
}
