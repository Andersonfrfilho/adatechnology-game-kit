import { createDestruction } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { toDestructibleSpec } from '../src'
import type { StructuredResult } from '../src'
import { engine } from './support'

/** The middle of a window in the plan, a point 2 m outside its wall and the direction into the house. */
function aimAtWindow(result: StructuredResult, index: number): { from: [number, number, number]; to: [number, number, number]; wall: string } {
  const opening = result.structure.openings.filter((o) => o.kind === 'window')[index]!
  const wall = result.structure.parts.find((p) => p.id === opening.wall)!
  const [u0, v0, u1, v1] = wall.aabb
  const alongU = u1 - u0 >= v1 - v0
  const middle = (opening.from + opening.to) / 2
  const y = (opening.y0 + opening.y1) / 2
  const at: [number, number, number] = alongU ? [middle, y, (v0 + v1) / 2] : [(u0 + u1) / 2, y, middle]
  const from: [number, number, number] = alongU ? [at[0], y, at[2] + 2] : [at[0] + 2, y, at[2]]
  return { from, to: [at[0] - from[0], 0, at[2] - from[2]], wall: wall.id }
}

describe('coarse walls have their windows open', () => {
  for (const template of ['single_storey_a', 'townhouse', 'mansion']) {
    it(`${template}: a ray through each window does not stop at its wall, one beside it does`, () => {
      const result = engine.generate(template, { seed: 1 }) as StructuredResult
      const spec = toDestructibleSpec(result.structure, { wallDetail: 'coarse' })
      const world = createDestruction({ seed: 1 })
      world.add(spec, { id: 'house', position: [10, 0, 8], rotation: [0, 1, 0, 0] })
      const windows = result.structure.openings.filter((o) => o.kind === 'window')
      expect(windows.length).toBeGreaterThan(0)
      // the house is turned half round at (10, 0, 8): a plan point (u, y, v) is (10 - u, y, 8 - v) in the world
      const world3 = (p: [number, number, number]): [number, number, number] => [10 - p[0], p[1], 8 - p[2]]
      for (let i = 0; i < windows.length; i++) {
        const aim = aimAtWindow(result, i)
        const hit = world.raycast(world3(aim.from), [-aim.to[0], 0, -aim.to[2]])
        expect(hit?.part, `${windows[i]!.id}`).not.toBe(aim.wall)
      }
      const first = aimAtWindow(result, 0)
      const beside = windows[0]!.y0 - 0.5
      const below = world.raycast(world3([first.from[0], beside, first.from[2]]), [-first.to[0], 0, -first.to[2]])
      expect(below?.part).toBe(first.wall)
    })
  }
})
