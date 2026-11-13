import { describe, expect, it } from 'vitest'

import { createTerrain } from '../src'
import type { GroundExcavation } from '../src'

const ground = (excavations: readonly GroundExcavation[] = []) =>
  createTerrain({ bounds: [-5, -5, 5, 5], cellSize: 0.1, layout: { surface: 'dirt', excavations } })

const down = [0, -1, 0] as const

describe('excavation: a construction trench is a real hole in the ground', () => {
  // two trenches 0.4 m wide, 0.6 m deep, side by side with 1 m of ground between them
  const trenches: GroundExcavation[] = [
    { rect: [-2, -0.2, 2, 0.2], depth: 0.6 },
    { rect: [-2, 1.2, 2, 1.6], depth: 0.6 },
  ]

  it('a vertical ray in the trench reaches its bed', () => {
    const terrain = ground(trenches)
    const hit = terrain.raycast([0.03, 2, 0.04], down, 10)
    expect(hit).not.toBeNull()
    expect(hit!.point[1]).toBeCloseTo(-0.6, 2)
    // the ground beside it is untouched
    expect(terrain.raycast([0, 2, 0.7], down, 10)!.point[1]).toBeCloseTo(0, 3)
  })

  it('a grazing ray from outside meets the ground between the trenches, never the far trench through it', () => {
    const terrain = ground(trenches)
    // from inside the first trench, low, looking across at the second: the earth between them stops it
    const hit = terrain.raycast([0, -0.3, 0], [0, 0, 1], 5)
    expect(hit).not.toBeNull()
    expect(hit!.point[2]).toBeLessThan(0.35)
  })

  it('a bed that falls along the trench is dug to each end', () => {
    const terrain = ground([{ rect: [-2, -0.2, 2, 0.2], depth: 0.4, toDepth: 0.8, along: 'x' }])
    expect(terrain.heightAt(-2, 0)).toBeCloseTo(-0.4, 2)
    expect(terrain.heightAt(2, 0)).toBeCloseTo(-0.8, 2)
    expect(terrain.heightAt(0, 0)).toBeCloseTo(-0.6, 2)
  })

  it('after the backfill (a layout without the trench) the ray meets the ground again', () => {
    const terrain = ground(trenches)
    terrain.setLayout({ surface: 'dirt' })
    expect(terrain.raycast([0.03, 2, 0.04], down, 10)!.point[1]).toBeCloseTo(0, 3)
  })

  it('a planned dig is no ground loss, and a crater since is cleared with it', () => {
    const losses: unknown[] = []
    const terrain = createTerrain({ bounds: [-5, -5, 5, 5], cellSize: 0.1, layout: { surface: 'dirt', excavations: trenches }, onGroundLoss: (loss) => losses.push(loss) })
    expect(losses).toEqual([])
    expect(terrain.voidUnder(0, 0, 0.15).fraction).toBe(1)
  })
})
