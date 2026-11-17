import { describe, expect, it } from 'vitest'

import { createTerrain } from '@adatechnology/game-terrain'

import { GROUND_CELL, buildGroundTile, readGround } from '../src/engine-ground'
import type { GroundGrid, GroundRect } from '../src/engine-ground'

/**
 * Spec 008 B6: a tile reads its samples through the host's grid reader (`GroundGrid`, the terrain's `heightGrid`) in one pass, not a `groundAt` call each. The grid answers
 * what `groundAt` answers to the bit, and the tile asks it for the same points, so the samples, and the tile made of them, are the same as the reads one by one.
 */
const SIZE = 2
const COUNT = (() => {
  const n = Math.round(SIZE / GROUND_CELL)
  return (n + 1) * (n + 1) + n * n + 2 * n * (n + 1)
})()

const cratered = () => {
  const terrain = createTerrain({ bounds: [-6, -6, 6, 6], cellSize: 0.1, layout: { surface: 'dirt' }, baseHeight: (x, z) => 0.05 * Math.sin(3 * x + z) })
  terrain.strike('explosive', { x: 0.37, z: -0.21, energy: 4e6 })
  terrain.strike('explosive', { x: 3.9, z: 4.1, energy: 1.5e6 })
  for (let k = 0; k < 4; k++) terrain.dig({ x: -2.43, z: 1.2, depth: 0.2 })
  const groundAt = (x: number, z: number): number => terrain.heightAt(x, z)
  const grid: GroundGrid = (xs, zs, out) => terrain.heightGrid(xs, zs, out)
  return { terrain, groundAt, grid }
}

const same = (a: Float64Array, b: Float64Array): boolean => a.length === b.length && a.every((v, i) => Object.is(v, b[i]))

describe('engine ground read through the host grid reader', () => {
  it('a whole tile reads the same samples, and makes the same tile, over a crater, a dug hole and across the terrain edge', () => {
    const { terrain, groundAt, grid } = cratered()
    expect(terrain.heightRange(-1, 1, -1, 1)!.low).toBeLessThan(-0.2)
    for (const [x0, z0] of [[0, -2], [-2, -2], [-4, 0], [4, 4], [6, -2], [-8, -8]] as const) {
      let calls = 0
      const counted = (x: number, z: number): number => {
        calls++
        return groundAt(x, z)
      }
      const one = buildGroundTile(groundAt, x0, z0, SIZE, true)
      const bulk = buildGroundTile(counted, x0, z0, SIZE, true, grid)
      expect(same(one.samples!, bulk.samples!)).toBe(true)
      expect(bulk.level).toBe(one.level)
      expect([...bulk.heights]).toEqual([...one.heights])
      expect([...bulk.collision]).toEqual([...one.collision])
      expect(bulk.boxes).toEqual(one.boxes)
      expect(bulk.solid).toEqual(one.solid)
      // the samples came from the grid: what is left of the calls is the solid's ring past the tile's edges
      const ringOnly = buildGroundTile(groundAt, x0, z0, SIZE, true).solid.ring.length / 3
      expect(calls).toBe(ringOnly)
    }
  })

  it('a marked rectangle reads again the same samples one by one or through the grid, and says the same about what changed', () => {
    const { terrain, groundAt, grid } = cratered()
    let seed = 11
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const x0 = 0, z0 = -2
    const held = new Float64Array(COUNT)
    readGround(groundAt, held, x0, z0, SIZE)
    terrain.strike('explosive', { x: 1.2, z: -0.6, energy: 8e5 })
    for (let k = 0; k < 30; k++) {
      const minX = x0 - 0.3 + random() * 2.4, minZ = z0 - 0.3 + random() * 2.4
      const rect: GroundRect = { minX, maxX: minX + random() * 1.5, minZ, maxZ: minZ + random() * 1.5 }
      const one = held.slice()
      const bulk = held.slice()
      const changedOne = readGround(groundAt, one, x0, z0, SIZE, rect)
      const changedBulk = readGround(groundAt, bulk, x0, z0, SIZE, rect, grid)
      expect(changedBulk).toBe(changedOne)
      expect(same(bulk, one)).toBe(true)
    }
  })

  it('a rectangle past the tile reads nothing, with or without the grid', () => {
    const { groundAt, grid } = cratered()
    const held = new Float64Array(COUNT)
    let asked = 0
    const counting: GroundGrid = (xs, zs, out) => {
      asked++
      grid(xs, zs, out)
    }
    expect(readGround(groundAt, held, 0, 0, SIZE, { minX: 10, maxX: 11, minZ: 10, maxZ: 11 }, counting)).toBe(false)
    expect(asked).toBe(0)
  })
})
