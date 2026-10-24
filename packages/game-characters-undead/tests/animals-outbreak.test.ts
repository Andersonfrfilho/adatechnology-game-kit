import { createRng } from '@adatechnology/game-characters'
import { SPECIES } from '@adatechnology/game-animals-species'
import { describe, expect, it } from 'vitest'

import { createAnimalOutbreak } from '../src'

describe('undead/animals: the outbreak rule over the 13 species', () => {
  const outbreak = createAnimalOutbreak({ species: SPECIES })

  it('a bitten dog, cat or pig turns in 10 to 30 minutes; the jaguar in an hour; the rat in 2 minutes (when the 5% takes)', () => {
    for (const id of ['dog', 'cat', 'pig', 'wild_boar']) {
      for (let seed = 1; seed <= 20; seed++) {
        const fate = outbreak.bite(id, createRng(seed), 1000)!
        expect(fate.outcome).toBe('turns')
        expect(fate.dueAt - 1000).toBeGreaterThanOrEqual(600)
        expect(fate.dueAt - 1000).toBeLessThanOrEqual(1800)
      }
    }
    expect(outbreak.bite('jaguar', createRng(1), 0)!.dueAt).toBe(3600)
    let turned = 0
    for (let seed = 1; seed <= 400; seed++) {
      const fate = outbreak.bite('rat', createRng(seed), 0)
      if (fate) {
        turned++
        expect(fate.dueAt).toBe(120)
      }
    }
    expect(turned).toBeGreaterThan(5)
    expect(turned).toBeLessThan(45)
  })

  it('cow, horse and capybara die of it in 2 to 6 hours; the birds, the snake and the chicken are immune', () => {
    for (const id of ['cow', 'horse', 'capybara']) {
      const fate = outbreak.bite(id, createRng(3), 0)!
      expect(fate.outcome).toBe('dies')
      expect(fate.dueAt).toBeGreaterThanOrEqual(2 * 3600)
      expect(fate.dueAt).toBeLessThanOrEqual(6 * 3600)
    }
    for (const id of ['chicken', 'southern_lapwing', 'vulture', 'lancehead']) expect(outbreak.bite(id, createRng(3), 0)).toBeUndefined()
  })

  it('walks from incubating to turned or dead', () => {
    const turns = outbreak.bite('dog', () => 0, 100)!
    expect(outbreak.stateOf(turns, 100)).toBe('incubating')
    expect(outbreak.stateOf(turns, turns.dueAt)).toBe('turned')
    const dies = outbreak.bite('cow', () => 0, 0)!
    expect(outbreak.stateOf(dies, dies.dueAt - 1)).toBe('incubating')
    expect(outbreak.stateOf(dies, dies.dueAt)).toBe('dead')
  })

  it('a carcass lures zombies within 200 m for one day and the vultures arrive in 10 minutes', () => {
    const carcass = outbreak.carcass('cow', [10, 0, 5], 1000)!
    expect(outbreak.lures(carcass, 150, 1000)).toBe(true)
    expect(outbreak.lures(carcass, 250, 1000)).toBe(false)
    expect(outbreak.lures(carcass, 150, 1000 + 86_399)).toBe(true)
    expect(outbreak.lures(carcass, 150, 1000 + 86_400)).toBe(false)
    expect(outbreak.vulturesArrived(carcass, 1000 + 599)).toBe(false)
    expect(outbreak.vulturesArrived(carcass, 1000 + 600)).toBe(true)
    expect(outbreak.carcass('dog', [0, 0, 0], 0)).toBeUndefined()
  })

  it('the game switches it off and on, and accelerates the clock', () => {
    const off = createAnimalOutbreak({ species: SPECIES, enabled: false })
    expect(off.bite('dog', () => 0, 0)).toBeUndefined()
    expect(off.carcass('cow', [0, 0, 0], 0)).toBeUndefined()
    off.enabled = true
    expect(off.bite('dog', () => 0, 0)).toBeDefined()
    const fast = createAnimalOutbreak({ species: SPECIES, timeScale: 60 })
    expect(fast.bite('jaguar', () => 0, 0)!.dueAt).toBe(60)
  })
})
