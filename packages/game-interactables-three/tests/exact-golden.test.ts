import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { exactSnapshot } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'
import { cases } from './catalog-cases'

/**
 * Every bit of what the mesh api builds, for the 57 props and the 51 household objects in both qualities (and a few options): recorded on
 * the old path (its own templates and arrays) before the move to game-shapes, so the move cannot change a byte. `UPDATE_EXACT=1` rewrites it.
 */
const FIXTURE = fileURLToPath(new URL('./fixtures/exact-mesh-api.json', import.meta.url))

const recorded: Record<string, { hash: string; nodes: readonly string[] }> = (() => {
  try {
    return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  } catch {
    return {}
  }
})()

describe('the mesh api, bit for bit', () => {
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
