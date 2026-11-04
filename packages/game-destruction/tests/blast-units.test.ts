import { describe, expect, it } from 'vitest'

import { unitGrid, unsupportedCells } from '../src/breach'
import type { Vec3 } from '../src'
import { ofType, wallWorld } from './wall-helpers'

// a 2.4 x 2.1 m wall of 23 x 7.5 cm bricks in running bond, thin along z
const DIMS: Vec3 = [2.4, 2.1, 0.11]
const grid = unitGrid(DIMS, 2, { size: [0.23, 0.075, 0.11], bond: 'running' }, 4096)
const inside = (i: number, x0: number, x1: number, y1: number): boolean => grid[i]!.center[0] > x0 && grid[i]!.center[0] < x1 && grid[i]!.center[1] < y1

describe('a blast on a wall of units', () => {
  it('a whole wall stands on its bottom course', () => {
    expect(unsupportedCells(grid, 2, DIMS, () => true)).toEqual([])
  })

  it('over a hole in the middle the courses step in by half a brick and the triangle over it comes down', () => {
    // a hole 0.9 m wide through the bottom 0.6 m
    const loose = unsupportedCells(grid, 2, DIMS, (i) => !inside(i, -0.45, 0.45, -1.05 + 0.6))
    expect(loose.length).toBeGreaterThan(0)
    const top = Math.max(...loose.map((i) => grid[i]!.center[1]))
    // half of 0.9 m at 11.5 cm a course of 7.5 cm: about four courses, never past the hole's width
    expect(top - (-1.05 + 0.6)).toBeLessThan(0.45)
    for (const i of loose) expect(Math.abs(grid[i]!.center[0])).toBeLessThan(0.45)
  })

  it('at the free end of the wall all that hangs over the hole comes down', () => {
    // a hole the last 0.3 m of the wall, through the bottom 0.6 m: nothing holds the end of the courses over it, they step out by half a brick
    const loose = unsupportedCells(grid, 2, DIMS, (i) => !inside(i, 0.9, 1.3, -1.05 + 0.6))
    expect(loose.some((i) => grid[i]!.center[0] > 1.1 && grid[i]!.center[1] > -0.45 && grid[i]!.center[1] < -0.35)).toBe(true)
    expect(loose.every((i) => grid[i]!.center[0] > 0.9 && grid[i]!.center[1] < -0.45 + 0.3)).toBe(true)
  })

  it('a grenade beside a plastered brick wall knocks units out around it, does not open its joints, and the wall stands', () => {
    const w = wallWorld('brick_wall_plastered')
    w.world.explode([0.3, 0.5, 0.4], 200000, 15)
    const chip = ofType(w.events, 'chip').find((e) => e.units)
    expect(chip?.units?.length).toBeGreaterThan(20)
    expect(ofType(w.events, 'fracture')).toEqual([])
    expect(ofType(w.events, 'stage').map((e) => e.stage)).toEqual([1])
    const wall = w.world.part(w.objectId, 'wall')!
    expect(wall.chipped?.length).toBe(chip!.units!.length)
    expect(wall.status).toBe('damaged')
  })

  it('a cast concrete wall still opens as one breach', () => {
    const w = wallWorld('reinforced_concrete')
    w.world.explode([0, 1, 0.12], 345600, 18)
    expect(ofType(w.events, 'chip').filter((e) => e.units)).toEqual([])
    expect(ofType(w.events, 'stage').map((e) => e.stage)).toEqual([1, 2])
  })
})
