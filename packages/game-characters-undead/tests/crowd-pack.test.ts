import { describe, expect, it } from 'vitest'

import { UNDEAD_TYPES, undeadCrowdPack } from '../src'

describe('undeadCrowdPack', () => {
  it('lists the 13 types in the catalog order, with the game horde numbers', () => {
    const pack = undeadCrowdPack()
    expect(pack.types.map((type) => type.id)).toEqual(UNDEAD_TYPES.map((type) => type.id))
    expect(pack.types.find((type) => type.id === 'blind')?.speed.chase).toBe(3)
    expect(pack.types.find((type) => type.id === 'drowned')?.weight).toBe(0)
    expect(pack.ages.map((age) => age.p)).toEqual([0.8, 0.15, 0.04, 0.01])
    expect(pack.segments).toEqual({ head: 40, arm: 60, leg: 80 })
  })

  it('hands out a fresh copy each call', () => {
    const a = undeadCrowdPack()
    a.types[0]!.health = 1
    expect(undeadCrowdPack().types[0]!.health).toBe(100)
  })
})

describe('the balance table of the pack (design-chain-horde.md 5.1)', () => {
  const table: Readonly<Record<string, { stability?: number; trip: number; driveForce: number; canFall?: boolean }>> = {
    walker: { stability: 1, trip: 0.04, driveForce: 250 },
    runner: { stability: 0.8, trip: 0.06, driveForce: 320 },
    crawler: { trip: 0, driveForce: 150, canFall: false },
    brute: { stability: 2.5, trip: 0.015, driveForce: 600 },
    sniffer: { stability: 1, trip: 0.04, driveForce: 260 },
    leaper: { stability: 0.9, trip: 0.03, driveForce: 300 },
    bloater: { stability: 0.7, trip: 0.06, driveForce: 200 },
    stalker: { stability: 1.1, trip: 0.03, driveForce: 280 },
    blind: { stability: 0.8, trip: 0.07, driveForce: 260 },
    screamer: { stability: 0.9, trip: 0.04, driveForce: 220 },
    charred: { stability: 0.8, trip: 0.05, driveForce: 230 },
    drowned: { stability: 0.9, trip: 0.045, driveForce: 240 },
    devourer: { stability: 1.2, trip: 0.035, driveForce: 300 },
  }

  it('every type carries its stability, trip and drive force, and only the crawler cannot fall', () => {
    const pack = undeadCrowdPack()
    expect(pack.types.map((type) => type.id).sort()).toEqual(Object.keys(table).sort())
    for (const type of pack.types) expect(type.balance, type.id).toEqual(table[type.id])
  })

  it('the brute holds the line and the runner and the blind give way first', () => {
    const balance = Object.fromEntries(undeadCrowdPack().types.map((type) => [type.id, type.balance as { stability?: number }]))
    expect(balance.brute!.stability).toBeGreaterThan(balance.walker!.stability!)
    expect(balance.runner!.stability).toBeLessThan(balance.walker!.stability!)
    expect(balance.blind!.stability).toBeLessThan(balance.walker!.stability!)
  })
})
