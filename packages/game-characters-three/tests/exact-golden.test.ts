import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exactSnapshot } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'
import { cases } from './catalog-cases'

/**
 * Every bit of the people of the Retratos (with every accessory), of the Bestiário bodies (13 types, 4 decays, 2 levels), of their bakes and
 * of the instanced body: recorded on the old path (three's own geometry constructors) before the move to game-shapes, so the move cannot
 * change a byte. `UPDATE_EXACT=1` rewrites it.
 */
// happy-dom: import.meta.url is not a file, the fixture is found from the package folder
const FIXTURE = join(process.cwd(), 'tests/fixtures/exact-characters.json')

const recorded: Record<string, { hash: string; objects: number }> = (() => {
  try {
    return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  } catch {
    return {}
  }
})()

describe('the characters, bit for bit', () => {
  if (process.env.UPDATE_EXACT) {
    it('records the fixture', () => {
      const out: Record<string, { hash: string; objects: number }> = {}
      for (const [id, build] of cases) {
        const { hash, nodes } = exactSnapshot(build())
        out[id] = { hash, objects: nodes.length }
      }
      writeFileSync(FIXTURE, JSON.stringify(out).replace(/},"/g, '},\n"') + '\n')
    }, 600000)
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
