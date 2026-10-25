import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { exactSnapshot } from '@adatechnology/golden-tool'
import { afterEach, describe, expect, it } from 'vitest'

import { OPERATIONS, registerCaseScenario } from './helpers/cases'
import { makeKit } from './helpers/kit'
import { SAMPLE_KEYS } from './helpers/sample-fleet'

/**
 * Every bit of the sample fleet in the three states, a few zones in bands and the interactions of the damage tests: recorded on the old path
 * (three's own geometry constructors) before the move to game-shapes, so the move cannot change a byte. `UPDATE_EXACT=1` rewrites it.
 */
const FIXTURE = join(process.cwd(), 'tests/fixtures/exact-vehicles.json')
const TITLE = 'the sample vehicles, bit for bit'
afterEach(() => new Promise((resolve) => setImmediate(resolve)))

type Root = { traverse(f: (o: unknown) => void): void }
const kit = makeKit()
registerCaseScenario(kit)
const cases: Array<[string, () => Root]> = []
for (const key of SAMPLE_KEYS) for (const state of ['intact', 'damaged', 'modified'] as const) cases.push([`${key}/${state}`, () => kit.build(key, state).root])
for (const [zone, health] of [['bumper_front', 13], ['door_front_left', 38], ['windshield', 0], ['headlight_left', 63]] as const)
  cases.push([`proto/${zone}@${health}`, () => kit.build('proto', 'intact', { health: { [zone]: health }, flags: {} }).root])
for (const name of Object.keys(OPERATIONS))
  cases.push([
    `proto/op:${name}`,
    () => {
      const c = kit.build('proto', 'intact')
      OPERATIONS[name]!(kit, c)
      return c.root
    },
  ])

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
