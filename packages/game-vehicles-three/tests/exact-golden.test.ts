import { defaultVehicleFleet } from '@adatechnology/game-kit-defaults'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createVehicleKit } from '@adatechnology/game-vehicles'
import { fleetGroups, installFleet } from '@adatechnology/game-vehicles-fleet'
import { exactSnapshot } from '@adatechnology/golden-tool'
import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'

import { createVehiclesThree } from '../src'
import { fakeDocument } from './fake-dom'

/**
 * Every bit of the 69 vehicles in light mode (the six fused meshes) and of one per group at full detail in the game frame: recorded on the old
 * path (three's own geometry constructors) before the move to game-shapes, so the move cannot change a byte. `UPDATE_EXACT=1` rewrites it.
 */
const FIXTURE = join(process.cwd(), 'tests/fixtures/exact-vehicles-three.json')
const TITLE = 'the vehicles in the game frame, bit for bit'
afterEach(() => new Promise((resolve) => setImmediate(resolve)))

type Root = { traverse(f: (o: unknown) => void): void }
const kit = createVehicleKit({ THREE, document: fakeDocument, locale: 'pt-BR' })
installFleet(kit)
const vehicles = createVehiclesThree(THREE, { kit, fleet: defaultVehicleFleet() })
const cases: Array<[string, () => Root]> = []
for (const keys of Object.values(fleetGroups)) {
  for (const key of keys) cases.push([`${key}/lite`, () => (vehicles.build(key, { quality: 'lite', seed: 7 }) as any).group])
  cases.push([`${keys[0]}/high`, () => (vehicles.build(keys[0] as string, { quality: 'high', seed: 7 }) as any).group])
}

const recorded: Record<string, { hash: string; objects: number }> = (() => {
  try {
    return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  } catch {
    return {}
  }
})()

describe(TITLE, () => {
  if (process.env.UPDATE_EXACT) {
    it('records the fixture', () => {
      const out: Record<string, { hash: string; objects: number }> = {}
      for (const [id, build] of cases) {
        const { hash, nodes } = exactSnapshot(build())
        out[id] = { hash, objects: nodes.length }
      }
      writeFileSync(FIXTURE, JSON.stringify(out).replace(/},"/g, '},\n"') + '\n')
    }, 3600000)
    return
  }
  it('has a recording of every case', () => {
    expect(Object.keys(recorded).sort()).toEqual(cases.map(([id]) => id).sort())
  })
  it.each(cases)('%s', (id, build) => {
    const snapshot = exactSnapshot(build())
    expect({ hash: snapshot.hash, objects: snapshot.nodes.length }).toEqual(recorded[id])
  })
})
