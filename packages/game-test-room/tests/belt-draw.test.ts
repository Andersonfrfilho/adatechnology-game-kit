import { describe, expect, it } from 'vitest'
import { createArsenal } from '@adatechnology/game-weapons'

import { createHeldHands } from '../src/held-hands'
import type { HeldHandsReport } from '../src/held-hands'

describe('two pistols and a gas bottle (owner, 2026-11-27)', () => {
  it('the second pistol goes into the belt, nothing falls, and both come back to their hands', () => {
    const hands: { R: string; L: string | null } = { R: 'glock_17', L: 'glock_17' }
    const reports: HeldHandsReport[] = []
    const placed: string[] = []
    const held = createHeldHands<{ readonly weaponId: string }>({
      arsenal: createArsenal(),
      loadout: ['glock_17'],
      catalog: [{ id: 'item_glock', name: 'Glock', weapon: 'glock_17' }],
      inHand: () => hands,
      equip: (hand, weapon) => {
        if (hand === 'R') hands.R = weapon ?? 'hand'
        else hands.L = weapon
      },
      carried: { get: () => null, set: () => undefined, putDown: () => undefined },
      place: (entry) => placed.push(entry.itemId),
      report: (event) => reports.push(event),
      instant: () => true,
    })
    held.begin({ massKg: 16, size: [0.36, 0.58, 0.36] }, { size: [0.36, 0.58, 0.36], item: () => null, taken: () => undefined })
    held.update(0.1)
    expect(hands).toEqual({ R: 'hand', L: null })
    expect(reports.filter((r) => r.type === 'holster').map((r) => r.slot).sort()).toEqual(['belt', 'hip'])
    expect(placed).toEqual([])
    held.end()
    held.update(0.1)
    expect(hands).toEqual({ R: 'glock_17', L: 'glock_17' })
  })
})
