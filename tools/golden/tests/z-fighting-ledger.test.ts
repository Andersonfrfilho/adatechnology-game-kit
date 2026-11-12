import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { checkZFightingLedger } from '../src'

function ledgerFile(content: Record<string, number>): string {
  const file = join(mkdtempSync(join(tmpdir(), 'zfight-')), 'ledger.json')
  writeFileSync(file, JSON.stringify(content))
  return file
}

const piece = (id: string, hits: number): { id: string; hits: number; detail: string } => ({ id, hits, detail: '' })

describe('checkZFightingLedger', () => {
  it('passes a clean piece and a recorded piece at its count', () => {
    const file = ledgerFile({ old: 3 })
    expect(checkZFightingLedger({ file, cases: [piece('clean', 0), piece('old', 3)] }).problems).toEqual([])
  })

  it('fails a new piece with any z-fighting, a recorded piece that got worse and one that got better', () => {
    const file = ledgerFile({ worse: 1, better: 5 })
    const { problems } = checkZFightingLedger({ file, cases: [piece('new', 1), piece('worse', 2), piece('better', 4)] })
    expect(problems).toHaveLength(3)
    expect(problems.join('\n')).toMatch(/new: new piece/)
    expect(problems.join('\n')).toMatch(/worse: z-fighting went from 1 to 2/)
    expect(problems.join('\n')).toMatch(/better: now 4/)
  })

  it('fails a ledger entry whose piece left the catalog', () => {
    const file = ledgerFile({ gone: 2 })
    expect(checkZFightingLedger({ file, cases: [] }).problems[0]).toMatch(/gone: in the ledger but no longer/)
  })

  it('updates only downwards: never adds a piece nor raises a count', () => {
    const file = ledgerFile({ better: 5, worse: 1, fixed: 2 })
    const { problems } = checkZFightingLedger({ file, cases: [piece('better', 4), piece('worse', 9), piece('fixed', 0), piece('new', 3)], update: true })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ better: 4, worse: 1 })
    expect(problems.join('\n')).toMatch(/new: new piece/)
  })
})
