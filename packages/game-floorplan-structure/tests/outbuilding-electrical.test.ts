import { describe, expect, it } from 'vitest'

import type { Electrical, Outbuilding } from '../src'
import { outbuildingCeilingLight } from '../src'
import { engine } from './support'

const generate = (seed: number) => engine.generate('single_storey_a', { seed, state: 'normal' }) as unknown as { outbuildings: Outbuilding[]; utilities: { electrical: Electrical } }

describe('the outbuilding is wired as a room of the house (NBR 5410)', () => {
  it('has its circuit with its ceiling light, a switch by its door, sockets and the conduits to them', () => {
    let wired = 0
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { outbuildings, utilities } = generate(seed)
      const E = utilities.electrical
      if (E.mode !== 'grid') continue
      for (const building of outbuildings) {
        const circuit = E.circuits.find((c) => c.room === building.id)
        expect(circuit, `seed ${seed} ${building.id}`).toBeDefined()
        expect(circuit!.lamps).toEqual([outbuildingCeilingLight(building).id])
        expect(E.switches.filter((s) => s.room === building.id).length, `seed ${seed}`).toBeGreaterThanOrEqual(1)
        expect(E.outlets.filter((t) => t.room === building.id).length, `seed ${seed}`).toBeGreaterThanOrEqual(2)
        expect(E.conduits.filter((c) => c.circuit === circuit!.id).length, `seed ${seed}`).toBeGreaterThanOrEqual(3)
        wired++
      }
    }
    expect(wired).toBeGreaterThan(0)
  })
})
