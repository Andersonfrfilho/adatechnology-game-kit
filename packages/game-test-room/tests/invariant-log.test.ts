import { describe, expect, it } from 'vitest'
import type { KitEnergyOver } from '@adatechnology/game-destruction-three'

import { createInvariantLog } from '../src/invariant-log'
import { createLog } from '../src/log'

describe('the room says aloud the invariants the kit breaks', () => {
  it('a kit rule that made energy is a check that failed, with the rule, what it gave and the fall it had', () => {
    const log = createLog()
    let tell: ((over: KitEnergyOver) => void) | undefined
    const destruction = { on: (_event: 'kitEnergy', handler: (over: KitEnergyOver) => void) => ((tell = handler), () => undefined) }
    const t = (key: string, vars?: Record<string, string | number>): string => `${key} ${JSON.stringify(vars)}`
    createInvariantLog({ log, t, destruction, subjectOf: (id) => (id === 'table' ? { name: 'Mesa', itemId: 'table_long' } : undefined) })
    tell?.({ rule: 'goOverIfBalanced', objectId: 'table', given: 11877.84, fall: 648.05 })
    const [entry] = log.entries({ channel: 'check', type: 'fail' })
    expect(entry?.objectId).toBe('table')
    expect(entry?.itemId).toBe('table_long')
    expect(entry?.data).toEqual({ invariant: 'kit_energy', rule: 'goOverIfBalanced', given: 11877.84, fall: 648.05 })
    expect(entry?.text).toContain('"rule":"goOverIfBalanced"')
  })

  it('what was left of a broken object standing on nothing keeps its own invariant', () => {
    const log = createLog()
    createInvariantLog({ log, t: (key) => key, destruction: { on: () => () => undefined }, subjectOf: () => undefined }).brokenFloating('shelf')
    expect(log.entries({ channel: 'check' }).map((entry) => [entry.objectId, entry.data])).toEqual([['shelf', { invariant: 'broken_floating' }]])
  })
})
