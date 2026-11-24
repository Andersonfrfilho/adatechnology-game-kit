import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { generateNetworks, validateNetworks } from '@adatechnology/game-urban/networks'

import { planLots } from '../src/game/assemble/houses'
import { buildNetworks } from '../src/game/assemble/networks'
import { POLE_MIN_GAP } from '../src/game/roads'
import { keepOutOf } from '../src/game/service'
import { plan, site } from './helpers'

const lots = planLots(site)
const avoid = keepOutOf(lots, POLE_MIN_GAP)
const generated = buildNetworks({ plan, site, avoid })
const { nodes, edges } = generated.networks
/** The bytes of the recorte's networks: a change that moves anything shows here, and is recorded on purpose. */
const RECORDED = '8e2a69c24c6cdfdb4e14bb08f5a8e12576375794525c9ec74a740a72868b42cd'

describe('the networks of the recorte', () => {
  it('pass every rule of validateNetworks, laid with no warning', () => {
    expect(validateNetworks(generated.networks, { connections: generated.connections, surfaceAt: generated.surfaceAt })).toEqual([])
    expect(generated.warnings).toEqual([])
  })

  it('link each of the 15 lots to the five networks once', () => {
    expect(site.lots.length).toBe(15)
    for (const lot of site.lots) {
      for (const network of ['power', 'telecom', 'sewer', 'storm', 'water']) expect(nodes.filter((node) => node.id === `lot:${lot.id}:${network}`).length, `${lot.id} ${network}`).toBe(1)
    }
  })

  it('stand no pole in front of a door, a gate or within 3 m of an entrance post', () => {
    for (const pole of nodes.filter((node) => node.kind === 'pole')) {
      for (const rect of avoid) expect(pole.at[0] > rect[0] && pole.at[0] < rect[2] && pole.at[2] > rect[1] && pole.at[2] < rect[3], pole.id).toBe(false)
    }
  })

  it('come out the same for the same plan, lots and seed, and lay a lamp on every pole', () => {
    expect(JSON.stringify(generateNetworks({ plan, lots: site.lots, seed: site.seed, avoid }).networks)).toBe(JSON.stringify(generated.networks))
    expect(createHash('sha256').update(JSON.stringify(generated.networks)).digest('hex')).toBe(RECORDED)
    const poles = nodes.filter((node) => node.kind === 'pole')
    expect(nodes.filter((node) => node.kind === 'light').length).toBe(poles.length)
    expect(edges.filter((edge) => edge.kind === 'light_feed').length).toBe(poles.length)
  })
})
