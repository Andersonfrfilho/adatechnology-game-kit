import { defaultVehicleFleet } from '@adatechnology/game-kit-defaults'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { fleetGroups, installFleet } from '@adatechnology/game-vehicles-fleet'
import * as THREE from 'three'
import { createVehiclesThree } from '../src'
import { fakeDocument } from './fake-dom'

/** The pieces of the catalog every catalog test walks (exact golden, z-fighting): built from the package's own lists, so a new piece is in them. */
export type Root = { traverse(f: (o: unknown) => void): void }
const kit = createVehicleKit({ THREE, document: fakeDocument, locale: 'pt-BR' })
installFleet(kit)
const vehicles = createVehiclesThree(THREE, { kit, fleet: defaultVehicleFleet() })
export const cases: Array<[string, () => Root]> = []
for (const keys of Object.values(fleetGroups)) {
  for (const key of keys) cases.push([`${key}/lite`, () => vehicles.build(key, { quality: 'lite', seed: 7 }).group])
  cases.push([`${keys[0]}/high`, () => vehicles.build(keys[0] as string, { quality: 'high', seed: 7 }).group])
}
