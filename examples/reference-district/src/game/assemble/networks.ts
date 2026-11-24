import type { CityPlanInput, PlanRect } from '@adatechnology/game-urban'
import { generateNetworks, validateNetworks } from '@adatechnology/game-urban/networks'
import type { GeneratedNetworks } from '@adatechnology/game-urban/networks'

import type { Site } from '../site'

export type NetworksParams = {
  readonly plan: CityPlanInput
  readonly site: Site
  /** Ground no pole may stand on: the doors, gates and entrance posts of the planned houses (`keepOutOf`). */
  readonly avoid: readonly PlanRect[]
}

/**
 * The utility networks of the district as data (power, street lights, telecom, sewer, drainage, water), laid by `game-urban` from the plan's
 * streets and the site's lots and checked by its validator: every violation (and every warning of the generator) is logged with the id of
 * its node or edge and the district keeps loading; the example's test fails on any of them. Until the houses
 * declare their own points (spec 011, T2.8c) each lot takes the default one of its rectangle; the drawing comes in T2.8d.
 */
export function buildNetworks({ plan, site, avoid }: NetworksParams): GeneratedNetworks {
  const generated = generateNetworks({ plan, lots: site.lots, seed: site.seed, avoid })
  const violations = validateNetworks(generated.networks, { connections: generated.connections, surfaceAt: generated.surfaceAt })
  if (violations.length > 0) console.error(`the networks of "${plan.id}" break ${violations.length} rule(s)`, violations)
  if (generated.warnings.length > 0) console.error(`the networks of "${plan.id}" were laid with ${generated.warnings.length} warning(s)`, generated.warnings)
  return generated
}
