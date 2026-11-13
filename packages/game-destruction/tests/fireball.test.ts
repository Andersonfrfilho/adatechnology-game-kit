import { chargeFireball, fireballDose, fuelFireball, ignitionDose } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import type { DestructibleSpec, Vec3 } from '../src'

/** The M67: 0.24 kg of TNT, 200 kJ in the arsenal's energy, a game radius of 15 m. */
const M67 = { energy: 200000, radius: 15, tnt: 0.24 }

const sheet = (material: string): DestructibleSpec => ({ parts: [{ id: 'sheet', material, shape: { kind: 'box', size: [0.5, 0.5, 0.01] }, position: [0, 0, 0], thickness: 0.01 }] })
const wall: DestructibleSpec = { parts: [{ id: 'wall', material: 'concrete', shape: { kind: 'box', size: [3, 3, 0.2] }, position: [0, 0, 0], anchored: true }] }

describe('the fireball of a blast', () => {
  it('of an M67 is 0.8 m wide and lives 6 ms: 9 kJ/m2 inside it, under the 63 kJ/m2 paper or cloth needs and the 93 kJ/m2 of hard wood', () => {
    const fireball = chargeFireball(M67.tnt)
    expect(fireball.radius).toBeCloseTo(0.81, 2)
    expect(fireball.seconds).toBeCloseTo(0.0062, 4)
    expect(fireballDose(fireball, 0.3)).toBeCloseTo(9300, -2)
    expect(fireballDose(fireball, 2)).toBeCloseTo(9300 * (0.81 / 2) ** 2, -2)
    expect(ignitionDose(230)).toBe(63000)
    expect(ignitionDose(330)).toBe(93000)
  })

  it('of 13 kg of propane bursting (a P13) is 6.8 m wide and lives 1.1 s: 270 kJ/m2, enough to light wood within it', () => {
    const fireball = fuelFireball(13)
    expect(fireball.radius).toBeCloseTo(6.8, 1)
    expect(fireballDose(fireball, 3)).toBeGreaterThan(ignitionDose(330))
  })
})

describe('an M67 among things that burn', () => {
  it('lights nothing, near or far, and leaves what is 2 m and more from it at the temperature of the room', () => {
    const world = createDestruction({ seed: 1 })
    const at: Array<[string, number]> = []
    for (const material of ['fabric', 'paper', 'wood_soft', 'wood_hard', 'rubber', 'plastic'])
      for (const distance of [0.5, 1, 2, 4]) at.push([world.add(sheet(material), { position: [distance, 1, (at.length % 6) * 0.01] }), distance])
    world.explode([0, 1, 0], M67.energy, M67.radius, 'test', { charge: { tnt: M67.tnt } })
    for (let i = 0; i < 100; i++) world.update(0.1)
    for (const [id, distance] of at) {
      const part = world.part(id, 'sheet')!
      expect(part.burning, `${id} at ${distance} m`).toBe(false)
      if (distance >= 2) expect(part.temperature, `${id} at ${distance} m`).toBeLessThan(25)
    }
  })
})

describe('the heat of a fireball and a wall', () => {
  it('a gas burst lights a cloth it sees 2 m away, and not the same cloth behind a 20 cm concrete wall', () => {
    const run = (walled: boolean): boolean => {
      const world = createDestruction({ seed: 1 })
      const cloth = world.add(sheet('fabric'), { position: [0, 1, 2] })
      if (walled) world.add(wall, { position: [0, 1, 1] })
      const burst: Vec3 = [0, 1, 0]
      world.explode(burst, 100000, 5, 'test', { charge: { fuel: 13 } })
      return world.part(cloth, 'sheet')!.burning
    }
    expect(run(false)).toBe(true)
    expect(run(true)).toBe(false)
  })
})
