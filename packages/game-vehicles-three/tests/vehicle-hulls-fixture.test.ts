import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { gzipSync } from 'node:zlib'

import * as THREE from 'three'
import { it } from 'vitest'

import { fleetGroupOf, fleetVehicleIds } from '@adatechnology/game-vehicles-fleet'

import { createVehicleColliders } from '../src'
import { build } from './vehicle-colliders-support'

/** Hulls a model of each class may have (the K7 ceilings of `vehicle-hulls-fleet.test.ts`). */
const CEILING: Readonly<Record<string, number>> = { cars: 256, suvs: 256, pickups: 256, vans: 300 }
/** The 12 models of the heap test of T6.21 (`game-physics-jolt/tests/heap.test.ts`): how many of each class. */
const MODELS: ReadonlyArray<readonly [string, number]> = [['cars', 6], ['suvs', 2], ['pickups', 2], ['vans', 2]]

/** Writes the real hulls of those 12 models, as the engine would hold them: `HULLS_FIXTURE=<file.json.gz>` (the file `heap.test.ts` reads); skipped otherwise. */
it.skipIf(!process.env.HULLS_FIXTURE)('writes the hulls of the 12 models of the heap test', () => {
  const out: Record<string, number[][]> = {}
  for (const [group, count] of MODELS) {
    for (const id of fleetVehicleIds.filter((candidate) => fleetGroupOf(candidate) === group).slice(0, count)) {
      const { vehicle, frame, dispose } = build(id)
      const hulls = createVehicleColliders(THREE, vehicle, frame, { hulls: true, maxHulls: CEILING[group] }).hulls()
      out[id] = hulls.map((hull) => Array.from(hull.points, (value) => Math.round(value * 10000) / 10000))
      dispose()
    }
  }
  const file = process.env.HULLS_FIXTURE!
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, gzipSync(JSON.stringify(out)))
}, 600000)
