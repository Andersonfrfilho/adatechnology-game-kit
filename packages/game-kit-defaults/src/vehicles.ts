import { colorFromSeed, fleetDims, installFleet, paintPalettes, paletteOf } from '@adatechnology/game-vehicles-fleet'

/** The paint palettes, measured sizes and install of `game-vehicles-fleet`, as the `fleet` option of `createVehiclesThree` and of the vehicles test area of `game-vehicles-three` takes them. */
export function defaultVehicleFleet(): { colorFromSeed: typeof colorFromSeed; fleetDims: typeof fleetDims; installFleet: typeof installFleet; paintPalettes: typeof paintPalettes; paletteOf: typeof paletteOf } {
  return { colorFromSeed, fleetDims, installFleet, paintPalettes, paletteOf }
}
