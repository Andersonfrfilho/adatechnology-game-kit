import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent } from '@adatechnology/game-contracts'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { describe, expect, it } from 'vitest'

import { makeFleetKit } from './helpers/kit'

/** The M67 of the arsenal: 200 kJ, 0.24 kg of TNT, a 190 g steel case in 1000 pieces round 180 g of Composition B. */
const M67 = { energy: 200000, radius: 15, charge: { tnt: 0.24, casing: { mass: 0.19, material: 'steel', fragments: 1000, chargeMass: 0.18, gurneyVelocity: 2700 } } }

/** Half the width of the sedan, metres: the charges stand this much plus their distance off its long side (the car runs along z). */
const HALF_WIDTH = 0.9

const sedanInWorld = (seed = 4) => {
  const kit = makeFleetKit('en')
  const item = buildVehicleItem(kit, 'midsize_sedan')
  const d = createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root })
  const world = createDestruction({ seed })
  world.register(d)
  const events: DestructionEvent[] = []
  world.on('*', (event: DestructionEvent) => events.push(event))
  const [x, , z] = d.partWorldCenter('roof')
  return { d, world, events, x, z }
}

describe('a hand grenade beside a parked sedan, through the destruction world', () => {
  // The wave is the P-I work of the reflected load on each part (waveWork): 3 m off the side the M67 puts 119 J into the front door, 132 J into the bumper and under 20 J
  // into the engine, which the body covers (a quarter of the wave). The old coupling, energy / (1 + 4 d^2) x 0.04 over the game radius, gave the same door
  // 200 000 / 37 x 0.04 = 216 J and every part of the car its share on each blast, which wore the engine's mounts off. The case's fragments fly as rounds into the car
  // (one sphere round it) and hole the doors and the glass they reach.
  // The glass of the side, some 1.5 m2, catches 1000 x 1.5 / (4 pi 3.9^2) = 8 pieces from 3 m off the side and 2 or 3 from 6 m, and the whole side (about 6 m2) some
  // 10 from 6 m: each seed holes the body at 3 m, most of them at 6 m (one of four throws none at the car at all), and the glass is holed or cracked at 3 m
  for (const distance of [3, 6]) {
    it(`${distance} m from its side tears nothing off in four throws, and its fragments hole the body${distance <= 3 ? ' and the glass' : ''}`, () => {
      let holed = 0
      let glassHit = 0
      for (const seed of [1, 2, 3, 4]) {
        const { d, world, events, x, z } = sedanInWorld(seed)
        world.explode([x + HALF_WIDTH + distance, 1, z], M67.energy, M67.radius, 'test', { charge: M67.charge })
        for (let frame = 0; frame < 10 * 60; frame++) world.update(1 / 60)
        expect(d.detachedParts(), `seed ${seed}`).toEqual([])
        if (events.some((event) => event.type === 'hole')) holed++
        const glass = d.model.parts.filter((part) => part.material === 'glass').map((part) => part.id)
        if (events.some((event) => (event.type === 'hole' || event.type === 'crack' || event.type === 'fracture') && glass.includes((event as { part?: string }).part ?? ''))) glassHit++
      }
      expect(holed).toBeGreaterThanOrEqual(distance <= 3 ? 4 : 3)
      if (distance <= 3) expect(glassHit).toBeGreaterThanOrEqual(3)
    })
  }

  // 5 kg of TNT 2 m away: Z = 1.17 m/kg^(1/3), some 2 MPa and 0.6 kPa s reflected, tens of kilojoules into a door: the car is wrecked
  it('5 kg of TNT 2 m from it wrecks it: parts torn off and lost', () => {
    const { d, world, x, z } = sedanInWorld()
    world.explode([x + HALF_WIDTH + 2, 1, z], 5 * 200000 / 0.24, 30, 'test', { charge: { tnt: 5 } })
    for (let frame = 0; frame < 5 * 60; frame++) world.update(1 / 60)
    const parts = world.state('sedan')?.parts ?? []
    const gone = parts.filter((part) => part.status === 'broken').length + d.detachedParts().length
    expect(gone).toBeGreaterThan(3)
  })
})
