import { describe, expect, it } from 'vitest'

import { createGridRainCover, createRainCover, rainCoverTopOf } from '../src'

const ROOF = { bounds: [0, 0, 10, 8] as const, top: 3 }

describe('rain cover', () => {
  it('has no cover over an open yard and the roof top under the roof', () => {
    const cover = createRainCover()
    expect(cover.isEmpty()).toBe(true)
    cover.add(createGridRainCover({ bounds: [-1, -1, 11, 9], coverTopAt: (x, z) => rainCoverTopOf([ROOF], [], x, z) }))
    expect(cover.isEmpty()).toBe(false)
    expect(cover.coverTopAt(5, 4)).toBe(3)
    expect(cover.coverTopAt(-0.9, 4)).toBeUndefined()
    expect(cover.coverTopAt(30, 4)).toBeUndefined()
  })

  it('lets rain through a hole and covers it again when the source is removed', () => {
    const cover = createRainCover()
    const holes = [{ x: 5, z: 4, radius: 0.8 }]
    const source = createGridRainCover({ bounds: [0, 0, 10, 8], coverTopAt: (x, z) => rainCoverTopOf([ROOF], holes, x, z) })
    const remove = cover.add(source)
    expect(cover.coverTopAt(5, 4)).toBeUndefined()
    expect(cover.coverTopAt(5.6, 4)).toBeUndefined()
    expect(cover.coverTopAt(7, 4)).toBe(3)
    remove()
    expect(cover.coverTopAt(7, 4)).toBeUndefined()
  })

  it('cuts the grid again and bumps the version when invalidated, and the highest cover wins', () => {
    const rects = [ROOF, { bounds: [0, 0, 10, 8] as const, top: 6 }]
    const source = createGridRainCover({ bounds: [0, 0, 10, 8], coverTopAt: (x, z) => rainCoverTopOf(rects, [], x, z) })
    expect(source.coverTopAt(2, 2)).toBe(6)
    const before = source.version()
    rects.pop()
    expect(source.coverTopAt(2, 2)).toBe(6)
    source.invalidate()
    expect(source.version()).toBe(before + 1)
    expect(source.coverTopAt(2, 2)).toBe(3)
  })
})
