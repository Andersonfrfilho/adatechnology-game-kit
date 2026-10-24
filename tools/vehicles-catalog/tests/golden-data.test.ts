import { readFileSync } from 'node:fs'

import { colorFromSeed, fleetCard, fleetDims, fleetStats, fleetVehicleIds, legacyVehicleSeeds, paintPalettes } from '@adatechnology/game-vehicles-fleet'
import { cutFunction, evaluateSlice } from '@adatechnology/golden-tool/cut-source'
import { describe, expect, it } from 'vitest'

import { extractCards, extractLightFleet, extractRegisters } from '../src/extract'
import { SOURCE_PATHS } from '../src/paths'

type TeamColour = (seed: number | string, palette: ReadonlyArray<readonly [string, number]>) => string

/** The team's own `corDaSemente`, cut from the Frota Leve page and run with its own palettes. */
const teamColour = (): TeamColour => {
  const source = readFileSync(SOURCE_PATHS.lightFleet, 'utf8')
  const code = ['mulberry', 'hashStr', 'corDaSemente'].map((name) => cutFunction(source, name)).join('\n')
  return evaluateSlice<{ corDaSemente: TeamColour }>(code, ['corDaSemente'], { Math }).corDaSemente
}

describe('golden: colour by seed (G-colour)', () => {
  const team = teamColour()
  const light = extractLightFleet()
  const strings = Array.from({ length: 40 }, (_, index) => `vehicle-${index}-${index * 7919}`)
  const seeds: Array<number | string> = [...Array.from({ length: 500 }, (_, seed) => seed), ...strings]

  it('picks the same civil colour as the page for seeds 0-499 and 40 strings', () => {
    for (const seed of seeds) expect(colorFromSeed(seed, paintPalettes.civil), String(seed)).toBe(team(seed, light.palette))
  })

  it('picks the same military colour as the page', () => {
    for (const seed of seeds) expect(colorFromSeed(seed, paintPalettes.military), String(seed)).toBe(team(seed, light.militaryPalette))
  })
})

describe('golden: dims and design cards (G-dims, G-stats)', () => {
  it('has the DIMS of the page for every vehicle', () => {
    for (const entry of extractLightFleet().dims) {
      const id = Object.keys(legacyVehicleSeeds).find((candidate) => legacyVehicleSeeds[candidate] === entry.k) as string
      expect(fleetDims(id), entry.k).toEqual({ length: entry.L, width: entry.W, height: entry.H })
    }
  })

  it('has the ratings, noise radius and top speed of every card of the Frota document', () => {
    const registers = extractRegisters()
    for (const card of extractCards()) {
      const key = registers.find((entry) => entry.name === card.n)!.key
      const id = fleetVehicleIds.find((candidate) => legacyVehicleSeeds[candidate] === key) as string
      const [speed, acceleration, handling, toughness, load, consumption] = card.s
      expect(fleetStats(id), card.n).toEqual({ speed, acceleration, handling, toughness, load, consumption, noiseRadius: card.r, maxSpeedKmh: card.vmax })
      expect(fleetCard(id)?.name, card.n).toBe(card.n)
    }
  })
})
