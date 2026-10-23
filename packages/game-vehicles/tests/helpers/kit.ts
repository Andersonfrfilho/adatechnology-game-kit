import * as THREE from 'three'
import { createVehicleKit, type VehicleKit, type VehicleKitOptions } from '../../src'
import { fakeDocument } from './fake-dom'
import { registerSampleFleet } from './sample-fleet'

/** A kit on the real three.js with a fake canvas document, optionally with the sample fleet registered. */
export function makeKit(options: Partial<VehicleKitOptions> = {}, fleet = true): VehicleKit {
  const kit = createVehicleKit({ THREE, document: fakeDocument, ...options })
  if (fleet) registerSampleFleet(kit)
  return kit
}
