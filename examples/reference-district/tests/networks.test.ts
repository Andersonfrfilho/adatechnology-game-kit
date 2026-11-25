import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { connectionsInWorld } from '@adatechnology/game-floorplan-structure'
import { validateNetworks } from '@adatechnology/game-urban/networks'

import { planLots } from '../src/game/assemble/houses'
import { buildNetworks } from '../src/game/assemble/networks'
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
const RECORDED = '5aad36774c07b22570d77a5f6515c5b8b5d0643fee90b62f6a2a4da6937cf304'

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
