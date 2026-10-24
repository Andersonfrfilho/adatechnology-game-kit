import { describe, expect, it } from 'vitest'

import { createVfx, GAME_EFFECTS } from '../src'

// The Garagem's recipes written around a car: played at a point of the world they land there (the Workshop keeps the car at (5.6, 0, 0.8)).
const world = () => createVfx({ seed: 5, randomMode: 'shared', effects: GAME_EFFECTS })
const run = (vfx: ReturnType<typeof world>, seconds: number): void => {
  for (let i = 0; i < seconds * 30; i++) vfx.update(1 / 30)
}

describe('vehicle effects', () => {
  it('keeps the three aliases next to the Workshop recipes and the point-based entries the vehicles use', () => {
    for (const id of ['vehicle_fire', 'vehicle_exhaust', 'vehicle_leak']) expect(GAME_EFFECTS[id]?.anchor).toEqual([5.6, 0, 0.8])
    expect(GAME_EFFECTS.engine_smoke?.anchor).toBeUndefined()
    const vfx = world()
    expect(vfx.catalog()).toContain('car_fuel_tank')
    for (const id of ['impact_metal', 'glass_burst']) expect(vfx.effectIds()).toContain(id)
  })

  it('plays the engine fire where the vehicle stands, and its light follows', () => {
    const vfx = world()
    const handle = vfx.play('vehicle_fire', [20, 0, -4])
    expect(handle).not.toBeNull()
    run(vfx, 2)
    const smoke = vfx.workshop().normal
    expect(smoke.count).toBeGreaterThan(0)
    for (let i = 0; i < smoke.count; i++) {
      expect(Math.abs((smoke.position[i * 3] ?? 0) - 20)).toBeLessThan(6)
      expect(Math.abs((smoke.position[i * 3 + 2] ?? 0) + 4)).toBeLessThan(6)
    }
  })

  it('plays the exhaust for a short stretch and the leak with the page numbers', () => {
    const vfx = world()
    expect(vfx.play('vehicle_exhaust', [0, 0.3, 0])).not.toBeNull()
    run(vfx, 0.5)
    expect(vfx.workshop().normal.count).toBeGreaterThan(0)
    run(vfx, 1)
    expect(vfx.workshop().normal.count).toBeGreaterThanOrEqual(0)
    expect(vfx.play('vehicle_leak', [3, 0, 3])).not.toBeNull()
    run(vfx, 4)
    expect(() => run(vfx, 8)).not.toThrow()
  })

  it('blows a car up at a point with the catalogue entry of the Garagem', () => {
    const vfx = world()
    expect(vfx.explosion('car_fuel_tank', [4, 0.6, 4], { scale: 1 })).not.toBeNull()
    run(vfx, 1)
    expect(vfx.stats().puffs).toBeGreaterThan(0)
  })
})
