import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exactSnapshot } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'
import { cases } from './catalog-cases'

/**
 * Every bit of the urban drawing: 28 of the part cases of the capture, the sample sheet of neighbourhoods, the valley
 * terrain, the module's items and the rounded box and prism helpers. Recorded on the old path (three's own geometry constructors) before the
 * move to game-shapes, so the move cannot change a byte. `UPDATE_EXACT=1` rewrites it.
 */
const FIXTURE = join(process.cwd(), 'tests/fixtures/exact-urban.json')

const recorded: Record<string, { hash: string; objects: number }> = (() => {
  try {
    return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  } catch {
    return {}
  }
})()

describe('the urban drawing, bit for bit', () => {
  if (process.env.UPDATE_EXACT) {
    it('records the fixture', () => {
      const out: Record<string, { hash: string; objects: number }> = {}
      for (const [id, build] of cases) {
        const { hash, nodes } = exactSnapshot(build())
        out[id] = { hash, objects: nodes.length }
      }
      writeFileSync(FIXTURE, JSON.stringify(out).replace(/},"/g, '},\n"') + '\n')
    }, 900000)
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
