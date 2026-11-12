import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exactSnapshot, installPortableMath } from '@adatechnology/golden-tool'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cases } from './catalog-cases'

/**
 * Every bit of the 24 showcase models and the 25 simple shapes, alone, merged and as a LOD: recorded on the old path (three's own geometry
 * constructors and props3d's merge) before the move to game-shapes, so the move cannot change a byte. `UPDATE_EXACT=1` rewrites it.
 */
// the package runs its tests in happy-dom, where import.meta.url is not a file: the fixture is found from the package folder
const FIXTURE = join(process.cwd(), 'tests/fixtures/exact-items.json')

const recorded: Record<string, { hash: string; nodes: readonly string[] }> = (() => {
  try {
    return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  } catch {
    return {}
  }
})()

// Math.pow changed its last bit between Node 22 and 24 (the crowbar's centripetal Catmull-Rom curve raises distances to 0.25): hash with the portable one
let restoreMath: () => void = () => undefined
beforeAll(() => {
  restoreMath = installPortableMath()
})
afterAll(() => restoreMath())

describe('the items, bit for bit', () => {
  if (process.env.UPDATE_EXACT) {
    it('records the fixture', () => {
      const out: Record<string, { hash: string; nodes: readonly string[] }> = {}
      for (const [id, build] of cases) {
        const { hash, nodes } = exactSnapshot(build())
        out[id] = { hash, nodes }
      }
      writeFileSync(FIXTURE, JSON.stringify(out, null, 1) + '\n')
    })
    return
  }
  it('has a recording of every case', () => {
    expect(Object.keys(recorded).sort()).toEqual(cases.map(([id]) => id).sort())
  })
  it.each(cases)('%s', (id, build) => {
    const snapshot = exactSnapshot(build())
    if (snapshot.hash !== recorded[id]?.hash) expect(snapshot.nodes).toEqual(recorded[id]?.nodes)
    expect(snapshot.hash).toBe(recorded[id]?.hash)
  })
})
