import { fleetDims, paintPalettes } from '@adatechnology/game-vehicles-fleet'
import { toSpec } from '@adatechnology/game-vegetation-species'
import { describe, expect, it } from 'vitest'

import { defaultPlantSpec, defaultVegetationSpecies, defaultVehicleFleet } from '../src'

describe('the vehicle and vegetation presets', () => {
  it('hands over the fleet the builder reads', () => {
    const fleet = defaultVehicleFleet()
    expect(fleet.paintPalettes).toBe(paintPalettes)
    expect(fleet.fleetDims('compact_hatch')).toEqual(fleetDims('compact_hatch'))
    expect(fleet.paletteOf('military')).toBe(paintPalettes.military)
    expect(typeof fleet.installFleet).toBe('function')
  })

  it('hands over the species pack and the spec of a species', () => {
    expect(defaultVegetationSpecies().regions.br.contexts).toBeDefined()
    const id = defaultVegetationSpecies().listIds()[0] as string
    expect(defaultPlantSpec(id)).toEqual(toSpec(id))
  })
})
