import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { exactSnapshot } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'
import { cases } from './catalog-cases'

/**
 * Every bit of the 13 animals (two seeds each) and of the body profile: recorded on the old path (three's own geometry constructors) before
 * the move to game-shapes, so the move cannot change a byte. `UPDATE_EXACT=1` rewrites it.
 */
const FIXTURE = fileURLToPath(new URL('./fixtures/exact-animals.json', import.meta.url))

const recorded: Record<string, { hash: string; objects: number }> = (() => {
  try {
    return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  } catch {
    return {}
  }
})()

describe('the animals, bit for bit', () => {
  if (process.env.UPDATE_EXACT) {
    it('records the fixture', () => {
      const out: Record<string, { hash: string; objects: number }> = {}
      for (const [id, build] of cases) {
        const { hash, nodes } = exactSnapshot(build())
        out[id] = { hash, objects: nodes.length }
      }
      writeFileSync(FIXTURE, JSON.stringify(out).replace(/},"/g, '},\n"') + '\n')
    })
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
