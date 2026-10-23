import * as THREE from 'three'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import type { VehicleKit } from '@adatechnology/game-vehicles'
import { installFleet } from '../../src'
import type { FleetOptions } from '../../src'
import { fakeDocument } from './fake-dom'

/** A kit on the real three.js with a fake canvas document and the fleet installed. */
export function makeFleetKit(locale = 'pt-BR', options?: FleetOptions): VehicleKit {
  const kit = createVehicleKit({ THREE, document: fakeDocument, locale })
  installFleet(kit, options)
  return kit
}

/** Every string in a value (objects, arrays and strings), with its path. */
export function* strings(value: unknown, path = ''): Generator<[string, string]> {
  if (typeof value === 'string') yield [path, value]
  else if (Array.isArray(value)) for (let i = 0; i < value.length; i++) yield* strings(value[i], `${path}[${i}]`)
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) yield* strings(v, path ? `${path}.${k}` : k)
}
