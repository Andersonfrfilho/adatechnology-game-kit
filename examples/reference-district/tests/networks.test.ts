import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { connectionsInWorld } from '@adatechnology/game-floorplan-structure'
import type { StructuredResult } from '@adatechnology/game-floorplan-structure'
import { validateNetworks } from '@adatechnology/game-urban/networks'

import { planLots } from '../src/game/assemble/houses'
import { DOWNTOWN_UNDERGROUND, buildNetworks, isUndergroundLot } from '../src/game/assemble/networks'
import { POLE_MIN_GAP } from '../src/game/roads'
import { SIDEWALK_WIDTH } from '../src/game/ground'
import { keepOutOf } from '../src/game/service'
import { plan, site } from './helpers'

const lots = planLots(site)
const avoid = keepOutOf(lots, POLE_MIN_GAP)
const generated = buildNetworks({ plan, site, lots, avoid })
const { nodes, edges } = generated.networks
/** The bytes of the recorte's networks: a change that moves anything shows here, and is recorded on purpose. */
// re-recorded when every house declared its own connections (T2.8c: meter post or facade mast anchor, inspection box clear of the wall, downspout at the kerb, water meter)
// re-recorded when the rules the networks carry gained `sewer.turnTolerance`, `sewer.branchMaxSkew` and `storm` (T2.8e; nodes and edges unchanged)
// re-recorded when the rules gained underground power (`underground`, the ducts' cover and rank, `layout.connection.telecomBesidePower`; nodes and edges unchanged)
const RECORDED = 'a09e053ff87b394b5accd10ab7c849a67b11d40f39eb88fcec7531d82c57c816'

describe('the networks of the recorte', () => {
  it('pass every rule of validateNetworks, laid with no warning', () => {
    expect(validateNetworks(generated.networks, { connections: generated.connections, surfaceAt: generated.surfaceAt, frontages: generated.frontages })).toEqual([])
    expect(generated.warnings).toEqual([])
  })

  it('link each of the 15 lots to the five networks once', () => {
    expect(site.lots.length).toBe(15)
    for (const lot of site.lots) {
      for (const network of ['power', 'telecom', 'sewer', 'storm', 'water']) expect(nodes.filter((node) => node.id === `lot:${lot.id}:${network}`).length, `${lot.id} ${network}`).toBe(1)
    }
  })

  it('take each house where it declared: its power, telecom, sewer, storm and water points (`connectionsInWorld`), the drop ending on its meter post\'s anchor', () => {
    for (const { lot, plan: house, placement } of lots) {
      const declared = connectionsInWorld({ plan: house, lot: lot.id, placement, kerb: SIDEWALK_WIDTH })
      expect(declared.map((connection) => connection.network), lot.id).toEqual(['power', 'telecom', 'sewer', 'storm', 'water'])
      for (const connection of declared) expect(nodes.find((node) => node.id === `lot:${lot.id}:${connection.network}`)?.at, `${lot.id} ${connection.network}`).toEqual(connection.at)
      const drop = edges.find((edge) => edge.id === `drop:${lot.id}`)
      expect(drop?.kind, lot.id).toBe('service_drop')
      expect(drop?.heights?.[1], lot.id).toBe(declared[0]!.at[1])
    }
  })

  it('stand no pole in front of a door, a gate or within 3 m of an entrance post', () => {
    for (const pole of nodes.filter((node) => node.kind === 'pole')) {
      for (const rect of avoid) expect(pole.at[0] > rect[0] && pole.at[0] < rect[2] && pole.at[2] > rect[1] && pole.at[2] < rect[3], pole.id).toBe(false)
    }
  })

  it('come out the same for the same plan, lots and seed, and lay a lamp on every pole', () => {
    expect(JSON.stringify(buildNetworks({ plan, site, lots, avoid }).networks)).toBe(JSON.stringify(generated.networks))
    expect(createHash('sha256').update(JSON.stringify(generated.networks)).digest('hex')).toBe(RECORDED)
    const poles = nodes.filter((node) => node.kind === 'pole')
    expect(nodes.filter((node) => node.kind === 'light').length).toBe(poles.length)
    expect(edges.filter((edge) => edge.kind === 'light_feed').length).toBe(poles.length)
  })
})

describe('the recorte with its downtown power underground (`?energia=enterrada`)', () => {
  const undergroundLots = planLots(site, { underground: (lot) => isUndergroundLot({ plan, power: DOWNTOWN_UNDERGROUND, rect: lot.rect }) })
  const underground = buildNetworks({ plan, site, lots: undergroundLots, avoid: keepOutOf(undergroundLots, POLE_MIN_GAP), power: DOWNTOWN_UNDERGROUND })
  const downtown = site.lots.filter((lot) => isUndergroundLot({ plan, power: DOWNTOWN_UNDERGROUND, rect: lot.rect }))

  it('passes every rule of validateNetworks with no warning, every lot still linked to the five networks once', () => {
    expect(validateNetworks(underground.networks, { connections: underground.connections, surfaceAt: underground.surfaceAt, frontages: underground.frontages, undergroundAt: underground.undergroundAt })).toEqual([])
    expect(underground.warnings).toEqual([])
    for (const lot of site.lots) {
      for (const network of ['power', 'telecom', 'sewer', 'storm', 'water']) expect(underground.networks.nodes.filter((node) => node.id === `lot:${lot.id}:${network}`).length, `${lot.id} ${network}`).toBe(1)
    }
  })

  it('feeds the downtown by laterals from the duct bank, with no wire over its streets, and keeps the poles of the periphery', () => {
    expect(downtown.length).toBeGreaterThan(2)
    for (const lot of downtown) expect(underground.networks.edges.some((edge) => edge.kind === 'service_lateral' && edge.to === `lot:${lot.id}:power`), lot.id).toBe(true)
    const poles = underground.networks.nodes.filter((node) => node.kind === 'pole')
    for (const pole of poles.filter((node) => underground.undergroundAt(node.at[0], node.at[2]))) expect(pole.carries).toEqual(['lighting'])
    expect(poles.filter((node) => node.carries.includes('power_mv')).length).toBeGreaterThan(5)
    expect(underground.networks.nodes.filter((node) => node.mount === 'pad').length).toBeGreaterThan(0)
  })

  it('stands every downtown house with its meter low and no post: the plan asks its street for underground power', () => {
    for (const { lot, plan: house } of undergroundLots) {
      const entrance = (house as StructuredResult).utilities?.electrical.serviceEntrance
      expect(entrance?.street, lot.id).toBe(downtown.some((entry) => entry.id === lot.id) ? 'network_underground' : 'network')
      if (entrance?.street === 'network_underground') expect(entrance.pole, lot.id).toBeNull()
    }
  })
})
