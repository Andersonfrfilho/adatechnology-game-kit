import { describe, expect, it } from 'vitest'
import { allFleetDims, colorFromSeed, fleetCard, fleetDims, fleetStats, fleetVehicleIds, paintPalettes, paletteOf } from '../src'

describe('fleet data', () => {
  it('has dims, stats and a design card for every vehicle of the fleet', () => {
    for (const id of fleetVehicleIds) {
      const dims = fleetDims(id)
      expect(dims, id).toBeTruthy()
      expect(dims!.length, id).toBeGreaterThan(1)
      expect(fleetStats(id), id).toMatchObject({ speed: expect.any(Number), noiseRadius: expect.any(Number), maxSpeedKmh: expect.any(Number) })
      expect(fleetCard(id)?.name, id).toBeTruthy()
    }
    expect(Object.keys(allFleetDims())).toHaveLength(69)
  })

  it('keeps the six ratings between 0 and 10', () => {
    for (const id of fleetVehicleIds) {
      const stats = fleetStats(id)!
      for (const key of ['speed', 'acceleration', 'handling', 'toughness', 'load', 'consumption'] as const) {
        expect(stats[key], `${id}.${key}`).toBeGreaterThanOrEqual(0)
        expect(stats[key], `${id}.${key}`).toBeLessThanOrEqual(10)
      }
    }
  })

  it('gives the military vehicles the military palette and the rest the civil one', () => {
    expect(paintPalettes.civil).toHaveLength(13)
    expect(paintPalettes.military).toHaveLength(5)
    expect(paletteOf('military')).toBe(paintPalettes.military)
    expect(paletteOf('battle_tank')).toBe(paintPalettes.military)
    expect(paletteOf('compact_hatch')).toBe(paintPalettes.civil)
  })

  it('picks the same colour for the same seed, number or text, and spreads over the palette', () => {
    expect(colorFromSeed(7)).toBe(colorFromSeed(7))
    expect(colorFromSeed('hatch-1')).toBe(colorFromSeed('hatch-1'))
    const colours = new Set(Array.from({ length: 300 }, (_, seed) => colorFromSeed(seed)))
    expect(colours.size).toBeGreaterThan(8)
    for (const colour of colours) expect(paintPalettes.civil.map((entry) => entry[0])).toContain(colour)
    const military = new Set(Array.from({ length: 100 }, (_, seed) => colorFromSeed(seed, paintPalettes.military)))
    for (const colour of military) expect(paintPalettes.military.map((entry) => entry[0])).toContain(colour)
  })
})
