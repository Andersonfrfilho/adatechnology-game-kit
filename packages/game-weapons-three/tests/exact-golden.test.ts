import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exactSnapshot, installPortableMath } from '@adatechnology/golden-tool'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cases } from './catalog-cases'

/**
 * Every bit of the gallery models (the brand weapons and the archetypes they lend a model to), of each weapon with what ships on it, of
 * each accessory on a weapon that takes it, of the cartridges and of the simple props: recorded on the old path (three's own geometry
 * constructors) before the move to game-shapes, so the move cannot change a byte. `UPDATE_EXACT=1` rewrites it.
 */
// happy-dom: import.meta.url is not a file, the fixture is found from the package folder
const FIXTURE = join(process.cwd(), 'tests/fixtures/exact-weapons.json')
// Math.pow changed its last bit between Node 22 and 24: the hashes here use the portable one, so both give the same bytes
let restoreMath: () => void = () => undefined
beforeAll(() => {
  restoreMath = installPortableMath()
})
afterAll(() => restoreMath())

const recorded: Record<string, { hash: string; objects: number }> = (() => {
  try {
    return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  } catch {
    return {}
  }
})()

describe('the weapon models, bit for bit', () => {
  if (process.env.UPDATE_EXACT) {
    it('records the fixture', () => {
      // the hash and the object count only: a weapon has hundreds of meshes, a hash per object would make the fixture half a megabyte
      const out: Record<string, { hash: string; objects: number }> = {}
      for (const [id, build] of cases) {
        const { hash, nodes } = exactSnapshot(build())
        out[id] = { hash, objects: nodes.length }
      }
      writeFileSync(FIXTURE, JSON.stringify(out).replace(/},"/g, '},\n"') + '\n')
    }, 300000)
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
