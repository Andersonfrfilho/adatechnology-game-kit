import { describe, expect, it } from 'vitest'

import { BLAST_DEBRIS_DEFAULTS, chooseForPhysics, physicsPieceCount, resolveBlastDebris } from '../src/blast-debris'

describe('blast debris options (spec 008 D4: every number is an option)', () => {
  it('the defaults are the measured numbers', () => {
    expect(BLAST_DEBRIS_DEFAULTS).toEqual({
      wakeCostTargetMs: 4,
      maxWakeDelay: 0.08,
      maxQueuedWakes: 2048,
      minWakesPerFrame: 8,
      minPhysicsPieces: 24,
      maxPhysicsPieces: 300,
      physicsCostTargetMs: 5,
      physicsCostPerBodyMs: 0.0022,
      wakeCostPerBodyMs: 0.02,
      chipSize: 0.15,
      maxLivePieces: 600,
      far: { distance: 40, age: 30, action: 'sleep', fadeSeconds: 0.5 },
    })
    expect(resolveBlastDebris()).toEqual(BLAST_DEBRIS_DEFAULTS)
  })

  it('a blast overrides the renderer, which overrides the defaults; a number left undefined is the one below', () => {
    const resolved = resolveBlastDebris({ maxPhysicsPieces: 100, far: { distance: 10 } }, { maxPhysicsPieces: 50, chipSize: undefined, far: { action: 'fade' } })
    expect(resolved.maxPhysicsPieces).toBe(50)
    expect(resolved.chipSize).toBe(BLAST_DEBRIS_DEFAULTS.chipSize)
    expect(resolved.far).toEqual({ distance: 10, age: 30, action: 'fade', fadeSeconds: 0.5 })
    expect(BLAST_DEBRIS_DEFAULTS.maxPhysicsPieces).toBe(300)
  })

  it('the count of pieces that enter physics follows the measured wake cost, between the minimum and the maximum', () => {
    const budget = (o = resolveBlastDebris()) => ({ minPieces: o.minPhysicsPieces, maxPieces: o.maxPhysicsPieces, costTargetMs: o.physicsCostTargetMs })
    // 5 ms at 0.02 ms a body = 250 bodies, nothing awake
    expect(physicsPieceCount(budget(), 0.02, 0)).toBe(250)
    // a machine twice as slow per body: 125 bodies; 100 awake already take their share of it
    expect(physicsPieceCount(budget(), 0.04, 0)).toBe(125)
    expect(physicsPieceCount(budget(), 0.04, 100)).toBe(25)
    // a machine twice as fast would give 500: the maximum is 300
    expect(physicsPieceCount(budget(), 0.01, 0)).toBe(300)
    // never under the minimum, never over the maximum
    expect(physicsPieceCount(budget(), 0.5, 0)).toBe(24)
    expect(physicsPieceCount(budget(resolveBlastDebris({ minPhysicsPieces: 5, maxPhysicsPieces: 9 })), 0.0001, 0)).toBe(9)
  })

  it('big pieces come before chips, nearest first, up to the count; the rest are chips', () => {
    const candidates = [
      { name: 'beam', size: 1.2, distance: 9 },
      { name: 'chip far', size: 0.05, distance: 8 },
      { name: 'chip near', size: 0.05, distance: 1 },
      { name: 'chip mid', size: 0.1, distance: 4 },
      { name: 'door', size: 0.9, distance: 2 },
    ]
    const { physics, chips } = chooseForPhysics(candidates, 3, 0.15)
    expect(physics.map((c) => c.name)).toEqual(['door', 'beam', 'chip near'])
    expect(chips.map((c) => c.name)).toEqual(['chip mid', 'chip far'])
    // a big one is never passed over for a chip, and the count is a cap
    expect(chooseForPhysics(candidates, 1, 0.15).physics.map((c) => c.name)).toEqual(['door'])
    expect(chooseForPhysics(candidates, 0, 0.15).physics).toEqual([])
  })
})
