import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { describe, expect, it } from 'vitest'

import { makeFleetKit } from './helpers/kit'

/** An M67 as the destruction world hands it to a vehicle: 200 kJ, 0.24 kg of TNT by the arsenal's scale, a game radius of 15 m. */
const M67 = { energy: 200000, radius: 15 }

describe('a hand grenade beside a parked sedan', () => {
  // The fireball of 0.24 kg of TNT is 0.8 m wide and lives 6 ms (`chargeFireball`): 9 kJ/m2 inside it, (0.81 / 3)^2 of that 3 m away, against the 99 kJ/m2 a tyre
  // (rubber, 350 °C) needs to light. The old 450 °C over half the game radius (7.5 m) set the four tyres alight and melted them.
  for (const distance of [3, 6]) {
    it(`${distance} m from the car lights nothing and melts no tyre in the 25 s after it`, () => {
      const kit = makeFleetKit('en')
      const item = buildVehicleItem(kit, 'midsize_sedan')
      const d = createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root })
      const [x, , z] = d.partWorldCenter('roof')
      const types = new Set<string>()
      for (const event of d.hit({ type: 'explosive', point: [x, 1, z + distance], energy: M67.energy, radius: M67.radius })) types.add(event.type)
      for (let frame = 0; frame < 25 * 60; frame++) for (const event of d.update!(1 / 60)) types.add(event.type)
      expect(types.has('ignite')).toBe(false)
      expect(types.has('melt')).toBe(false)
      expect(d.status().burning).toEqual([])
    })
  }
})
