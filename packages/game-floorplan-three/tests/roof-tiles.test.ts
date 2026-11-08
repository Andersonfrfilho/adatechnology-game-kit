import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { houseOf, planOf } from './helpers/houses'

describe('a roof of clay tiles', () => {
  it('a blast that breaks it throws its tiles in handfuls, not in a few plates of the pane', () => {
    const world = createDestruction({ seed: 3 })
    const { house } = houseOf(planOf('casaA', 1), { destruction: world })
    const d = house.destruction
    d.activate()
    const events: DestructionEvent[] = []
    world.on('*', (e) => events.push(e))
    const roof = house.structure.byId.get('roof_a')!
    const point: [number, number, number] = [(roof.aabb[0] + roof.aabb[2]) / 2, roof.y1 + 0.3, (roof.aabb[1] + roof.aabb[3]) / 2]
    for (let i = 0; i < 6 && world.part(d.id!, 'roof_a')?.status !== 'broken'; i++) world.explode(point, 2e6, 8, 'test')
    const broke = events.find((e) => e.type === 'fracture' && e.part === 'roof_a')
    expect(broke?.type).toBe('fracture')
    const tiles = broke?.type === 'fracture' ? broke.fragments : []
    // a pane of 70 m² of tiles: well over a hundred pieces, each a handful of tiles (under half a square metre)
    expect(tiles.length).toBeGreaterThan(100)
    for (const f of tiles.filter((t) => t.material === 'ceramic')) expect(f.size[0] * f.size[1]).toBeLessThan(0.5)
  })
})
