import { describe, expect, it } from 'vitest'

import { rasterize } from '../src/raster'
import { signedArea, simplifyLoop, traceMask } from '../src/trace'

const maskOf = (rows: string[]): { mask: Uint8Array; width: number; height: number } => {
  const width = rows[0]?.length ?? 0
  const mask = new Uint8Array(width * rows.length)
  rows.forEach((row, y) => [...row].forEach((char, x) => (mask[y * width + x] = char === '#' ? 1 : 0)))
  return { mask, width, height: rows.length }
}

describe('traceMask', () => {
  it('traces a block as one clockwise loop with only its four corners', () => {
    const { mask, width, height } = maskOf(['....', '.##.', '.##.', '....'])
    const loops = traceMask(mask, width, height)
    expect(loops).toHaveLength(1)
    expect(loops[0]).toHaveLength(4)
    expect(signedArea(loops[0] ?? [])).toBe(8)
  })

  it('traces the hole of a ring as a second loop turning the other way', () => {
    const { mask, width, height } = maskOf(['#####', '#...#', '#...#', '#####'])
    const loops = traceMask(mask, width, height)
    expect(loops.map(signedArea).sort((a, b) => a - b)).toEqual([-12, 40])
  })

  it('keeps two cells that touch only at a corner apart', () => {
    const { mask, width, height } = maskOf(['#.', '.#'])
    expect(traceMask(mask, width, height)).toHaveLength(2)
  })

  it('gives the same loops on every run', () => {
    const { mask, width, height } = maskOf(['.##.#', '####.', '.#.##'])
    expect(JSON.stringify(traceMask(mask, width, height))).toBe(JSON.stringify(traceMask(mask, width, height)))
  })
})

describe('simplifyLoop', () => {
  it('flattens a staircase within the tolerance and keeps a square as it is', () => {
    const stairs = [[0, 0], [2, 0], [2, 1], [4, 1], [4, 2], [6, 2], [6, 10], [0, 10]] as const
    const simple = simplifyLoop(stairs, 1.1)
    expect(simple.length).toBeLessThan(stairs.length)
    const square = [[0, 0], [10, 0], [10, 10], [0, 10]] as const
    expect(simplifyLoop(square, 1)).toHaveLength(4)
  })
})

describe('rasterize', () => {
  it('lets the nearest triangle name the tone of a cell', () => {
    const far = [0, 0, 0, 8, 0, 0, 0, 8, 0, 1]
    const near = [0, 0, 1, 8, 0, 1, 0, 8, 1, 2]
    const raster = rasterize([...far, ...near], 8, 8)
    expect(raster.tone[0]).toBe(2)
    expect(raster.tone[7 * 8 + 7]).toBe(0)
  })
})
