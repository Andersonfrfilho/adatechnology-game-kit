import { colorFromSeed, fleetDims, fleetHullCeilingOf, installFleet, paintPalettes, paletteOf } from '@adatechnology/game-vehicles-fleet'

/** The fleet content as `defaultVehicleFleet()` of `game-kit-defaults` hands it over, built here so the tests do not depend on the preset (which depends on this package). */
export function defaultVehicleFleet(): { colorFromSeed: typeof colorFromSeed; fleetDims: typeof fleetDims; hullCeilingOf: typeof fleetHullCeilingOf; installFleet: typeof installFleet; paintPalettes: typeof paintPalettes; paletteOf: typeof paletteOf } {
  return { colorFromSeed, fleetDims, hullCeilingOf: fleetHullCeilingOf, installFleet, paintPalettes, paletteOf }
}
