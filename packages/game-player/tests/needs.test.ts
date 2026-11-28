import { describe, expect, it } from 'vitest'

import { NEEDS_DEFAULTS, advanceNeeds, applyItemEffect, createBodyVitals, createNeedsState, createPlayer, isStarving, needsHoursOf, nourish } from '../src'
import type { VitalsBody } from '../src'

describe('hunger and thirst (the team game needs, G 57255-57344)', () => {
  it('start at 20 and rise on the slice clock: 1 game hour is 50 s, hunger 2.5/h (4/h running), thirst 4/h, times 1.1 - 0.02 x vigor', () => {
    const state = createNeedsState()
    expect(state).toEqual({ hunger: 20, thirst: 20 })
    expect(needsHoursOf(50, 5)).toBeCloseTo(1, 10)
    expect(advanceNeeds(state, 500, { vigor: 5 })).toBe(0)
    expect(state.hunger).toBeCloseTo(45, 6)
    expect(state.thirst).toBeCloseTo(60, 6)
    const runner = createNeedsState()
    advanceNeeds(runner, 500, { vigor: 5, running: true })
    expect(runner.hunger).toBeCloseTo(60, 6)
    const strong = createNeedsState()
    advanceNeeds(strong, 500, { vigor: 10 })
    expect(strong.thirst).toBeCloseTo(20 + 40 * 0.9, 6)
  })

  it('cost 0.2 health a second past 90, and never go past 100', () => {
    const state = { hunger: 95, thirst: 10 }
    expect(isStarving(state)).toBe(true)
    expect(advanceNeeds(state, 2, { vigor: 5 })).toBeCloseTo(0.4, 10)
    advanceNeeds(state, 100_000, { vigor: 5 })
    expect(state.hunger).toBe(NEEDS_DEFAULTS.max)
  })

  it('fall by the satiety and hydration of what is eaten, within 0 and 100: salted food makes you thirsty', () => {
    const state = { hunger: 30, thirst: 30 }
    expect(nourish(state, { satiety: 25, hydration: -5 })).toEqual({ hunger: -25, thirst: 5 })
    expect(state).toEqual({ hunger: 5, thirst: 35 })
    nourish(state, { satiety: 25, hydration: 50 })
    expect(state).toEqual({ hunger: 0, thirst: 0 })
  })
})

describe('item effects on the body (the team game useItem, G 57269-57279)', () => {
  const body = (): VitalsBody => ({ health: 50, bleeding: 1, panic: 40, wounds: ['scratch', 'laceration'], hunger: 50, thirst: 50 })

  it('food and drink feed by the numbers the catalogue gave', () => {
    const b = body()
    const r = applyItemEffect(b, { id: 'consume_nutrition', satiety: 12, hydration: -4 }, { maxHealth: 100 })
    expect(r).toMatchObject({ applied: true, hunger: -12, thirst: 4 })
    expect(b.hunger).toBe(38)
  })

  it('a painkiller heals its amount up to the most health, a dressing stops the bleeding, alcohol cleans the last wound, a sedative calms', () => {
    const b = body()
    expect(applyItemEffect(b, { id: 'heal', params: { amount: 15 } }, { maxHealth: 60 }).health).toBe(10)
    expect(b.health).toBe(60)
    expect(applyItemEffect(b, { id: 'stop_bleeding' }, { maxHealth: 100 }).stoppedBleeding).toBe(true)
    expect(b.bleeding).toBe(0)
    expect(applyItemEffect(b, { id: 'clean_wound' }, { maxHealth: 100 }).cleaned).toBe('laceration')
    expect(b.wounds).toEqual(['scratch'])
    expect(applyItemEffect(b, { id: 'calm' }, { maxHealth: 100 }).calmed).toBe(true)
    expect(b.panic).toBe(0)
    expect(applyItemEffect(b, { id: 'wash' }, { maxHealth: 100 }).applied).toBe(false)
    expect(applyItemEffect({ ...body(), wounds: [] }, { id: 'clean_wound' }, { maxHealth: 100 }).applied).toBe(false)
  })
})

describe('createBodyVitals', () => {
  it('starves a body that eats nothing to death by hunger and thirst', () => {
    const vitals = createBodyVitals()
    for (let i = 0; i < 2000 && vitals.state.alive; i++) vitals.update(1)
    expect(vitals.state.alive).toBe(false)
    expect(vitals.state.cause).toBe('hunger_thirst')
    expect(vitals.apply({ id: 'consume_nutrition', satiety: 50 }).applied).toBe(false)
    vitals.reset()
    expect(vitals.state).toMatchObject({ alive: true, health: 100, hunger: 20, thirst: 20 })
  })
})

describe('the player body', () => {
  it('gets hungry on its clock, starving costs health, and food from the hand feeds it', () => {
    const player = createPlayer({ seed: 1 })
    expect(player.state.hunger).toBe(20)
    player.update(500)
    expect(player.state.thirst).toBeCloseTo(60, 4)
    player.state.thirst = 95
    const health = player.state.health
    player.update(1)
    expect(player.state.health).toBeLessThan(health)
    expect(player.use({ id: 'consume_nutrition', hydration: 25 }).thirst).toBeCloseTo(-25, 4)
    player.state.bleeding = 1
    player.use({ id: 'stop_bleeding' })
    expect(player.state.bleeding).toBe(0)
  })

  it('keeps still with needs off, and an old save starts fed', () => {
    const still = createPlayer({ needs: false })
    still.update(500)
    expect(still.state.hunger).toBe(0)
    const player = createPlayer()
    const save = player.save()
    const old = { ...save, state: { ...save.state } } as { state: Partial<typeof save.state> }
    delete old.state.hunger
    delete old.state.thirst
    player.load(old as typeof save)
    expect(player.state.hunger).toBe(20)
  })
})
