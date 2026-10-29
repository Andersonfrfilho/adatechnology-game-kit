import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { exactSnapshot } from '@adatechnology/golden-tool'
import { afterEach, describe, expect, it } from 'vitest'

import { fleetGroups } from '../src'
import { makeFleetKit } from './helpers/kit'

/**
 * Every bit of the 69 vehicles of the fleet, intact and damaged, and of a crash scenario on one per group: recorded on the old path (three's
 * own geometry constructors) before the move to game-shapes, so the move cannot change a byte. `UPDATE_EXACT=1` rewrites it.
 */
const FIXTURE = join(process.cwd(), 'tests/fixtures/exact-fleet.json')
const TITLE = 'the fleet, bit for bit'
afterEach(() => new Promise((resolve) => setImmediate(resolve)))

type Root = { traverse(f: (o: unknown) => void): void }
const kit = makeFleetKit('pt-BR')
const cases: Array<[string, () => Root]> = []
for (const keys of Object.values(fleetGroups)) {
  for (const key of keys) for (const state of ['intact', 'damaged'] as const) cases.push([`${key}/${state}`, () => kit.build(key, state).root])
  const first = keys[0] as string
  cases.push([
    `${first}/front_crash`,
    () => {
      const c = kit.build(first, 'intact')
      kit.applyZones(c, kit.zoneScenario(c, 'front_crash'))
      return c.root
    },
  ])
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
