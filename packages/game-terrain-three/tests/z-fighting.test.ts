import { join } from 'node:path'

import { coincidentFacesOf, describeCoincidentFaces } from '@adatechnology/game-shapes-three'
import { checkZFightingLedger } from '@adatechnology/golden-tool'
import type { ZFightingCase } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { cases } from './catalog-cases'

/**
 * No piece of the catalog may have two faces on the same plane, facing the same way, overlapping: they z-fight (flicker as the camera
 * moves). New pieces must have none; the pieces that already had some when the guard came in are in the ledger, which only goes down
 * (`UPDATE_ZFIGHT=1` lowers it after a fix). Rule: `CLAUDE.md` §13.
 */
const LEDGER = join(process.cwd(), 'tests/fixtures/z-fighting-ledger.json')

describe('z-fighting', () => {
  it('no piece of the catalog has coincident faces beyond the ledger', async () => {
    const checked: ZFightingCase[] = []
    for (const [id, build] of cases) {
      const hits = coincidentFacesOf(build() as never, { maxHits: Number.POSITIVE_INFINITY })
      checked.push({ id, hits: hits.length, detail: describeCoincidentFaces(hits, 4) })
      await new Promise((resolve) => setImmediate(resolve)) // a long catalog must not starve the test runner
    }
    const { problems } = checkZFightingLedger({ file: LEDGER, cases: checked, update: process.env.UPDATE_ZFIGHT === '1' })
    expect(problems, problems.join('\n')).toEqual([])
  }, 600_000)
})
