import { describe, expect, it } from 'vitest'

import { create } from '../src'
import type { ObjectSpec } from '@adatechnology/game-interactables'
import { GameInteractables, GameInteractablesHousehold, planOf } from './support/plans'

const kit = { GameInteractables, GameInteractablesHousehold }

/** The specs the adapter adds, by entry id, with the pose it adds them at. */
function added(seed: number): { specs: Map<string, { spec: ObjectSpec; x: number; y: number; z: number; ry: number }>; planned: ReturnType<ReturnType<typeof create>['plan']> } {
  const adapter = create(kit)
  const r = planOf('single_storey_a', seed)
  const planned = adapter.plan(r, { seed: r.seed })
  const specs = new Map<string, { spec: ObjectSpec; x: number; y: number; z: number; ry: number }>()
  const world = { add: (id: string, spec: ObjectSpec, pose: { x: number; y: number; z: number; ry: number }) => specs.set(id, { spec, ...pose }), fitSweep: () => 1 }
  adapter.add(world as never, planned)
  return { specs, planned }
}

describe('the gas hose of a stove', () => {
  it('runs from behind the stove along the floor to the valve of its cylinder, never through the wall behind it', () => {
    let linked = 0
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { specs, planned } = added(seed)
      for (const stove of planned.items.filter((e) => e.type === 'stove')) {
        const placed = specs.get(stove.id)
        const hose = placed?.spec.wires?.find((w) => w.id === 'gas_hose')
        if (!placed || !hose?.points) continue
        const cylinder = planned.cylinders.find((b) => b.stove === stove.id)
        const entry = cylinder && planned.items.find((e) => e.id === cylinder.id)
        if (!entry) continue
        const valve = [entry.item.x ?? 0, entry.floorY + (entry.item.h ?? 0.47), entry.item.z ?? 0] as const
        linked++
        const end = hose.points[hose.points.length - 1]!
        // local back to world: the inverse of the adapter's rotation
        const wx = placed.x + Math.cos(placed.ry) * end[0]! + Math.sin(placed.ry) * end[2]!
        const wz = placed.z - Math.sin(placed.ry) * end[0]! + Math.cos(placed.ry) * end[2]!
        expect(Math.hypot(wx - valve[0], wz - valve[2]), `seed ${seed}`).toBeLessThan(0.01)
        expect(placed.y + end[1]!, `seed ${seed}`).toBeCloseTo(valve[1], 2)
      }
    }
    expect(linked).toBeGreaterThan(0)
  })

  it('of a stove with no cylinder stays in the gap it leaves to the wall', () => {
    const { STOVE_WALL_GAP } = GameInteractablesHousehold
    const { specs, planned } = added(3)
    for (const stove of planned.items.filter((e) => e.type === 'stove' && !planned.cylinders.some((b) => b.stove === e.id))) {
      const hose = specs.get(stove.id)?.spec.wires?.find((w) => w.id === 'gas_hose')
      const back = Math.min(...(hose?.points ?? []).map((p) => p[2]!))
      const depth = stove.item.d ?? 0.6
      expect(back, stove.id).toBeGreaterThanOrEqual(-depth / 2 - STOVE_WALL_GAP - 1e-6)
    }
  })
})
