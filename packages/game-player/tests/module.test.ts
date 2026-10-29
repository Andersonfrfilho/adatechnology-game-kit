import { checkBench } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createPlayerTestModule } from '../src'

describe('player test module', () => {
  it('declares a clean bench in both locales', () => {
    for (const locale of ['pt-BR', 'en']) {
      const module = createPlayerTestModule({ locale })
      const report = checkBench({ controls: module.controls?.(locale), metrics: module.metrics?.(locale) })
      expect(report.problems).toEqual([])
    }
  })

  it('passes its scenarios', async () => {
    const module = createPlayerTestModule()
    const failures: string[] = []
    for (const scenario of module.scenarios?.('pt-BR') ?? []) {
      await scenario.run({ expect: (ok, label) => void (ok || failures.push(`${scenario.id}: ${label}`)) })
    }
    expect(failures).toEqual([])
  })
})
