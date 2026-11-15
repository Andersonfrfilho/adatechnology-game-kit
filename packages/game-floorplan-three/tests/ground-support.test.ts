import { describe, expect, it } from 'vitest'

import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent } from '@adatechnology/game-contracts'
import { createTerrain } from '@adatechnology/game-terrain'

import { houseOf, planOf } from './helpers/houses'

/** The house on the room's ground: the terrain hands what a blow takes from under the house to its destruction world (`onGroundLoss`), as the room does. */
function houseOnGround() {
  const world = createDestruction({ seed: 7 })
  const { house } = houseOf(planOf('single_storey_a', 1), { destruction: world })
  house.destruction.activate()
  const events: DestructionEvent[] = []
  world.on('*', (event: DestructionEvent) => events.push(event))
  const terrain = createTerrain({ bounds: [-20, -20, 30, 30], cellSize: 0.1, layout: { surface: 'dirt' }, onGroundLoss: (loss) => world.groundLoss(loss) })
  const settle = (): void => {
    for (let k = 0; k < 40; k++) {
      terrain.update(0.05)
      world.update(0.05)
    }
  }
  /** Parts the ground's loss reached: settled, cracked over a void, lost their support or fell. */
  const reached = (): string[] => [...new Set(events.filter((e) => e.type === 'subside' || e.type === 'collapse').map((e) => String((e as { part?: string }).part ?? '')))]
  return { house, world, terrain, events, settle, reached }
}

describe('the ground under the house is its support: a crater under a footing reaches the structure, one far away does nothing', () => {
  it('a crater under the corner pillar\'s footing takes its ground: the footing settles or loses its support, and what it carries feels it', () => {
    const { house, terrain, settle, reached } = houseOnGround()
    const pillar = house.structure.byId.get('column_0_0')!
    const x = (pillar.aabb[0] + pillar.aabb[2]) / 2, z = (pillar.aabb[1] + pillar.aabb[3]) / 2
    // a heavy charge in the ground at the corner, just outside the wall
    terrain.strike('explosive', { x: x - 0.4, z: z - 0.4, energy: 3e6 })
    expect(terrain.voidUnder(x, z, 0.4).fraction).toBeGreaterThan(0)
    settle()
    const hit = reached()
    expect(hit.length, 'parts the crater reached').toBeGreaterThan(0)
    // what it reached is at that corner, not across the house
    for (const id of hit) {
      const part = house.structure.byId.get(id)
      if (!part) continue
      const near = Math.max(0, part.aabb[0] - x, x - part.aabb[2]) + Math.max(0, part.aabb[1] - z, z - part.aabb[3])
      expect(near, id).toBeLessThan(6)
    }
  })

  it('a hole dug by shovel under the corner footing takes its ground: the structure there feels it', () => {
    const { house, terrain, settle, reached } = houseOnGround()
    const pillar = house.structure.byId.get('column_0_0')!
    const x = (pillar.aabb[0] + pillar.aabb[2]) / 2, z = (pillar.aabb[1] + pillar.aabb[3]) / 2
    // shovelfuls right under the corner, down past the footing's depth, the earth thrown aside
    for (let k = 0; k < 6; k++) for (const [dx, dz] of [[0, 0], [-0.3, 0], [0, -0.3], [-0.3, -0.3]] as const) terrain.dig({ x: x + dx, z: z + dz, dump: { x: x - 1.5, z: z - 1.5 } })
    settle()
    expect(reached().length).toBeGreaterThan(0)
  })

  it('a crater in the yard far from every footing reaches nothing', () => {
    const { terrain, settle, reached } = houseOnGround()
    terrain.strike('explosive', { x: -12, z: -12, energy: 3e6 })
    settle()
    expect(reached()).toEqual([])
  })
})
