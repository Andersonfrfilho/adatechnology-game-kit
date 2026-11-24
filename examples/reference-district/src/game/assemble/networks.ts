import { connectionsInWorld } from '@adatechnology/game-floorplan-structure'
import type { CityPlanInput, PlanRect } from '@adatechnology/game-urban'
import { generateNetworks, validateNetworks } from '@adatechnology/game-urban/networks'
import type { GeneratedNetworks } from '@adatechnology/game-urban/networks'

import { SIDEWALK_WIDTH } from '../ground'
import type { Site } from '../site'
import type { PlannedLot } from './houses'

export type NetworksParams = {
  readonly plan: CityPlanInput
  readonly site: Site
  /** The planned houses (`planLots`, `street: 'network'`): each declares where it takes every network. */
  readonly lots: readonly PlannedLot[]
  /** Ground no pole may stand on: the doors, gates and entrance posts of the planned houses (`keepOutOf`). */
  readonly avoid: readonly PlanRect[]
}

/**
 * The utility networks of the district as data (power, street lights, telecom, sewer, drainage, water), laid by `game-urban` from the plan's
 * streets and the site's lots and checked by its validator: every violation (and every warning of the generator) is logged with the id of
 * its node or edge and the district keeps loading; the example's test fails on any of them. Every house declares its own points
 * (`connectionsInWorld`: the anchor on its meter post, the inspection box, the downspout carried out to the kerb, the water meter); the drawing comes in T2.8d.
 */
export function buildNetworks({ plan, site, lots, avoid }: NetworksParams): GeneratedNetworks {
  const connections = lots.flatMap(({ lot, plan: house, placement }) => connectionsInWorld({ plan: house, lot: lot.id, placement, kerb: SIDEWALK_WIDTH }))
  const generated = generateNetworks({ plan, lots: site.lots, seed: site.seed, avoid, connections })
  const violations = validateNetworks(generated.networks, { connections: generated.connections, surfaceAt: generated.surfaceAt })
  if (violations.length > 0) console.error(`the networks of "${plan.id}" break ${violations.length} rule(s)`, violations)
  if (generated.warnings.length > 0) console.error(`the networks of "${plan.id}" were laid with ${generated.warnings.length} warning(s)`, generated.warnings)
  return generated
}
