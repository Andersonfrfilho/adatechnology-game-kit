import { describe, expect, it } from 'vitest'

import { GAME_DEPTH_PRECISION, box, coincidentFaces, depthResolution, describeCoincidentFaces } from '../src'
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

describe('near mode (depth-buffer precision)', () => {
  const sheet = (z: number, up = true): number[] => (up ? [0, 0, z, 1, 0, z, 0, 1, z] : [0, 0, z, 0, 1, z, 1, 0, z])

  it('resolves about 1.07 mm at 30 m for the game camera', () => {
    expect(depthResolution()).toBeGreaterThan(0.00105)
    expect(depthResolution()).toBeLessThan(0.0011)
  })

  it('catches a 1 mm gap and ignores 3 mm', () => {
    const near = coincidentFaces([{ positions: sheet(0), label: 'a' }, { positions: sheet(0.001), label: 'b' }], { depth: GAME_DEPTH_PRECISION })
    expect(near).toHaveLength(1)
    expect(near[0]!.kind).toBe('coplanar')
    expect(coincidentFaces([{ positions: sheet(0), label: 'a' }, { positions: sheet(0.003), label: 'b' }], { depth: GAME_DEPTH_PRECISION })).toEqual([])
  })

  it('catches nearly parallel faces that cross under the resolution, not ones that part further', () => {
    const tilted = [0, 0, 0.0002, 1, 0, 0.0008, 0, 1, 0.0002]
    const steep = [0, 0, 0.0002, 1, 0, 0.02, 0, 1, 0.0002]
    expect(coincidentFaces([{ positions: sheet(0), label: 'a' }, { positions: tilted, label: 'b' }], { depth: GAME_DEPTH_PRECISION })).toHaveLength(1)
    expect(coincidentFaces([{ positions: sheet(0), label: 'a' }, { positions: steep, label: 'b' }], { depth: GAME_DEPTH_PRECISION })).toEqual([])
  })

  it('catches the two sides of a thin double-sided wall only when something draws both sides', () => {
    const wall = (doubleSided: boolean): ReturnType<typeof coincidentFaces> =>
      coincidentFaces([{ positions: sheet(0), label: 'outer', doubleSided }, { positions: sheet(0.0005, false), label: 'inner' }], { depth: GAME_DEPTH_PRECISION })
    expect(wall(false)).toEqual([])
    expect(wall(true)[0]!.kind).toBe('opposed')
  })
})

describe('near mode: faces that draw the same pixels', () => {
  const sheet = (z: number): number[] => [0, 0, z, 1, 0, z, 0, 1, z]
  const near = { depth: GAME_DEPTH_PRECISION }
  const grey = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
  const red = [1, 0, 0, 1, 0, 0, 1, 0, 0]

  it('passes two faces of one look and one colour, facing exactly alike: whichever wins the depth test, the pixel is the same', () => {
    expect(coincidentFaces([{ positions: sheet(0), label: 'a', look: 'plaster', colors: grey }, { positions: sheet(0), label: 'b', look: 'plaster', colors: grey }], near)).toEqual([])
  })

  it('still catches them in another colour, another look, without a look, or with another texture placement', () => {
    expect(coincidentFaces([{ positions: sheet(0), label: 'a', look: 'plaster', colors: grey }, { positions: sheet(0), label: 'b', look: 'plaster', colors: red }], near)).toHaveLength(1)
    expect(coincidentFaces([{ positions: sheet(0), label: 'a', look: 'plaster' }, { positions: sheet(0), label: 'b', look: 'wood' }], near)).toHaveLength(1)
    expect(coincidentFaces([{ positions: sheet(0), label: 'a' }, { positions: sheet(0), label: 'b' }], near)).toHaveLength(1)
    const uv = [0, 0, 1, 0, 0, 1], shifted = [0.5, 0, 1.5, 0, 0.5, 1]
    expect(coincidentFaces([{ positions: sheet(0), label: 'a', look: 'brick', uvs: uv }, { positions: sheet(0), label: 'b', look: 'brick', uvs: shifted }], near)).toHaveLength(1)
    expect(coincidentFaces([{ positions: sheet(0), label: 'a', look: 'brick', uvs: uv }, { positions: sheet(0), label: 'b', look: 'brick', uvs: uv }], near)).toEqual([])
  })
})
