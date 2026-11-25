import type * as THREE_NS from 'three'

import { connectionsInWorld } from '@adatechnology/game-floorplan-structure'
import type { KitWorld } from '@adatechnology/game-kit-defaults/world'
import type { LightBudget } from '@adatechnology/game-render-three'
import type { CityPlanInput, LampShares, PlanRect, UrbanKit } from '@adatechnology/game-urban'
import { createUrbanThree } from '@adatechnology/game-urban-three'
import type { DrawnBuried, DrawnNetworks, DrawnSurface } from '@adatechnology/game-urban-three'
import { breachOf, generateNetworks, validateNetworks } from '@adatechnology/game-urban/networks'
import type { Breach, GeneratedNetworks } from '@adatechnology/game-urban/networks'

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
  const violations = validateNetworks(generated.networks, { connections: generated.connections, surfaceAt: generated.surfaceAt, frontages: generated.frontages })
  if (violations.length > 0) console.error(`the networks of "${plan.id}" break ${violations.length} rule(s)`, violations)
  if (generated.warnings.length > 0) console.error(`the networks of "${plan.id}" were laid with ${generated.warnings.length} warning(s)`, generated.warnings)
  return generated
}

/** The camera moves this far (metres) before the networks' level of detail is looked at again. */
const REFOCUS_DISTANCE = 10

export type DrawNetworksParams = {
  readonly THREE: typeof THREE_NS
  readonly urban: UrbanKit
  readonly generated: GeneratedNetworks
  readonly lights: LightBudget
  readonly isNight: boolean
  /** At night, the share of lamps that work and the share that flicker (the rest are burnt out). Default every lamp works. */
  readonly lamps?: LampShares
}

export type DistrictNetworks = {
  readonly drawn: DrawnNetworks
  /** Each frame: the failing lamps blink, and the near spans follow the camera once it has moved `REFOCUS_DISTANCE`. */
  update(time: number, focus: { readonly x: number; readonly z: number }): void
}

/**
 * The aerial networks drawn by `game-urban-three` (`drawNetworks`): the poles the network stands, their hardware, the conductors and the drops,
 * the lamps of its light nodes lit at night by their state through the world's light budget. The poles of the street are the network's: the scene draws no other.
 */
export function drawDistrictNetworks({ THREE, urban, generated, lights, isNight, lamps }: DrawNetworksParams): DistrictNetworks {
  const drawn = createUrbanThree(THREE, { lights, physicalLights: true, flickerLenses: true }).drawNetworks(generated.networks, {
    isNight,
    surfaceAt: generated.surfaceAt,
    poles: urban.poles,
    ...(lamps === undefined ? {} : { lamps }),
  })
  let focus: { x: number; z: number } | undefined
  return {
    drawn,
    update(time, at) {
      drawn.animate(time)
      if (focus && Math.hypot(at.x - focus.x, at.z - focus.z) < REFOCUS_DISTANCE) return
      focus = { x: at.x, z: at.z }
      drawn.setFocus(at.x, at.z)
    },
  }
}

/** The asphalt is the terrain's own layer (no plane over it), so a cover stands on the ground level. */
const ROAD_ON_TERRAIN = 0

export type DistrictSewers = {
  readonly surface: DrawnSurface
  readonly buried: DrawnBuried
  /** What each blow that dug the ground did to the pipes and covers under it, in order (T2.8f makes them leaks and outages). */
  readonly breaches: readonly Breach[]
  dispose(): void
}

/**
 * The sewer, the drainage and the water where they meet the ground: the covers, grates, hydrants and wing walls on it (`drawNetworkSurface`) and the pipes and pits
 * under it at their depths (`drawBuriedNetworks`), which a crater shows. Each blow that digs the ground (`world.ground.on('blow')`) is asked what it reached (`breachOf`):
 * a pipe the bowl got down to breaks, a cover inside it is thrown off.
 */
export function drawDistrictSewers({ THREE, generated, world }: { readonly THREE: typeof THREE_NS; readonly generated: GeneratedNetworks; readonly world: KitWorld }): DistrictSewers {
  const drawer = createUrbanThree(THREE, {})
  const surface = drawer.drawNetworkSurface(generated.networks, { surfaceAt: generated.surfaceAt, roadLevel: ROAD_ON_TERRAIN })
  const buried = drawer.drawBuriedNetworks(generated.networks, { surfaceAt: generated.surfaceAt, roadLevel: ROAD_ON_TERRAIN })
  const breaches: Breach[] = []
  const gone = new Set<string>()
  const stop = world.ground.on('blow', (result) => {
    if (result.radius <= 0) return
    const breach = breachOf({ pipes: buried.pipes, surface: surface.pieces.filter((piece) => !gone.has(piece.id)) }, { x: result.point[0], z: result.point[2], radius: result.radius, depth: result.totalDepth })
    for (const pipe of breach.pipes) if (pipe.severed && !gone.has(pipe.id)) buried.sever(pipe.id, pipe.share)
    for (const id of breach.surface) surface.remove(id)
    for (const id of [...breach.pipes.filter((pipe) => pipe.severed).map((pipe) => pipe.id), ...breach.surface]) gone.add(id)
    if (breach.pipes.length > 0 || breach.surface.length > 0) breaches.push(breach)
  })
  return { surface, buried, breaches, dispose: () => (stop(), surface.dispose(), buried.dispose()) }
}
