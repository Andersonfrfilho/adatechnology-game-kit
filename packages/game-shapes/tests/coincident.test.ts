import { describe, expect, it } from 'vitest'

import { box, coincidentFaces, describeCoincidentFaces } from '../src'
import type { CoincidentBatch } from '../src'

/** A box primitive moved to `at` (no rotation), as a world-space batch. */
function boxAt(size: readonly [number, number, number], at: readonly [number, number, number], label: string): CoincidentBatch {
  const buffers = box(size[0], size[1], size[2])
  const positions = Array.from(buffers.positions, (value, i) => value + at[i % 3]!)
  return { positions, indices: buffers.indices ?? undefined, label }
}

/** The same batch turned by `angle` around the vertical axis. */
function turned(batch: CoincidentBatch, angle: number): CoincidentBatch {
  const p = Array.from(batch.positions)
  const c = Math.cos(angle), s = Math.sin(angle)
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i]!, z = p[i + 2]!
    p[i] = c * x + s * z
    p[i + 2] = -s * x + c * z
  }
  return { ...batch, positions: p }
}

describe('coincidentFaces', () => {
  it('finds a lining whose front sits on the front of the block (the meter box)', () => {
    const hits = coincidentFaces([boxAt([0.4, 0.6, 0.2], [0, 0, 0], 'body'), boxAt([0.3, 0.5, 0.2], [0, 0, 0], 'lining')])
    expect(hits.some((h) => h.normal[2] === 1 && h.labelA === 'body' && h.labelB === 'lining')).toBe(true)
    expect(describeCoincidentFaces(hits)).toContain('body × lining')
  })

  it('finds faces 0.5 mm apart, even across a bucket edge', () => {
    const hits = coincidentFaces([boxAt([1, 1, 1], [0, 0, 0], 'a'), boxAt([1, 1, 1], [0.3, 0.3, 0.0005], 'b')])
    expect(hits.length).toBeGreaterThan(0)
  })

  it('finds a coincident face on a rotated piece', () => {
    const hits = coincidentFaces([turned(boxAt([1, 1, 1], [0, 0, 0], 'a'), 0.4), turned(boxAt([0.5, 0.5, 1], [0, 0, 0], 'b'), 0.4)])
    expect(hits.length).toBeGreaterThan(0)
  })

  it('finds triangles of one mesh drawn twice on the same plane', () => {
    const plate = boxAt([1, 0.02, 1], [0, 0, 0], 'floor')
    expect(coincidentFaces([plate, plate]).length).toBeGreaterThan(0)
  })

  it('accepts a detail standing out 2 mm and blocks that only touch', () => {
    const body = boxAt([0.4, 0.6, 0.2], [0, 0, 0], 'body')
    const proud = boxAt([0.3, 0.5, 0.2], [0, 0, 0.002], 'proud')
    const touching = boxAt([0.4, 0.6, 0.2], [0.4, 0, 0], 'neighbour')
    expect(coincidentFaces([body, proud, touching])).toEqual([])
  })

  it('accepts two faces on the same plane that do not overlap', () => {
    expect(coincidentFaces([boxAt([1, 1, 1], [0, 0, 0], 'a'), boxAt([1, 1, 1], [2, 0, 0], 'b')])).toEqual([])
  })

  it('ignores overlaps smaller than a square centimetre', () => {
    const hits = coincidentFaces([boxAt([1, 1, 1], [0, 0, 0], 'a'), boxAt([1, 1, 1], [0.995, 0.995, 0], 'b')])
    expect(hits).toEqual([])
  })
})
