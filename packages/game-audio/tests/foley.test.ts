import { describe, expect, it } from 'vitest'
import { FOLEY_BANK, FOLEY_FALLOFF, cutoffDivisor, LEAF_FOLEY_SETS, PICKUP_CLASSES, createSoundRegistry, planSound } from '../src'

const registry = createSoundRegistry([FOLEY_BANK])
const ids = (FOLEY_BANK.sounds ?? []).map((s) => s.id)

describe('foley bank', () => {
  it('has a sound for every set and every pickup class', () => {
    for (const set of Object.values(LEAF_FOLEY_SETS)) for (const id of [set.open, set.turn, set.close, set.slam, set.locked]) if (id) expect(ids).toContain(id)
    for (const c of PICKUP_CLASSES) expect(ids).toContain(`item_pickup_${c}`)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never plays the same take twice in a row (C5)', () => {
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    // an electronic beep is the same every time, as in life
    for (const id of ids.filter((i) => i !== 'microwave_beep')) {
      const recipe = registry.sound(id)!
      const a = JSON.stringify(planSound(recipe, { random, volume: 1 })?.layers)
      const b = JSON.stringify(planSound(recipe, { random, volume: 1 })?.layers)
      expect(a, id).not.toBe(b)
    }
  })

  it('falls off and loses its highs with distance, and is gone far away (C3)', () => {
    const recipe = registry.sound('car_door_close')!
    const at = (distance: number) => planSound(recipe, { distance, volume: 1 })
    const level = (distance: number) => at(distance)?.level ?? 0
    expect(level(1)).toBeGreaterThan(level(10))
    expect(level(10)).toBeGreaterThan(level(50))
    expect(at(200)).toBeNull()
    expect(cutoffDivisor(FOLEY_FALLOFF, 50)).toBeGreaterThan(2)
  })

  it('a car door is not the fridge nor the microwave', () => {
    expect(new Set([LEAF_FOLEY_SETS.car_door.close, LEAF_FOLEY_SETS.fridge.close, LEAF_FOLEY_SETS.microwave.close]).size).toBe(3)
  })
})
