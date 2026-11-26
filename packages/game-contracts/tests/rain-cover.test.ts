import { describe, expect, it } from 'vitest'

import { createFixedFootprintRainCover, createFootprintRainCover, createGridRainCover, createRainCover, rainCoverTopOf } from '../src'

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

describe('turned footprints', () => {
  it('a moving footprint answers where it is now and bumps the version only when told to', () => {
    const source = createFootprintRainCover()
    source.set([{ x: 10, z: 5, halfX: 2, halfZ: 1, yaw: 0, top: 1.4 }], [], true)
    const cover = createRainCover()
    cover.add(source)
    expect(cover.coverTopAt(11.5, 5.5)).toBe(1.4)
    expect(cover.coverTopAt(11.5, 6.5)).toBeUndefined()
    const version = cover.version()
    source.set([{ x: 10.3, z: 5, halfX: 2, halfZ: 1, yaw: Math.PI / 2, top: 1.4 }], [], false)
    expect(cover.version()).toBe(version)
    // turned a quarter: it is 2 m along z and 1 m along x now
    expect(cover.coverTopAt(10.3, 6.5)).toBe(1.4)
    expect(cover.coverTopAt(11.5, 5)).toBeUndefined()
    expect(source.bounds()[2]).toBeCloseTo(11.3, 5)
  })

  it('an opening lets the rain through its own rectangle only', () => {
    const source = createFootprintRainCover()
    source.set([{ x: 0, z: 0, halfX: 2, halfZ: 2, yaw: 0, top: 3 }], [{ x: 1, z: 0, halfX: 0.5, halfZ: 0.5, yaw: 0, top: 0 }], true)
    expect(source.coverTopAt(1, 0)).toBeUndefined()
    expect(source.coverTopAt(-1, 0)).toBe(3)
  })

  it('a fixed set of footprints is answered from a grid and the highest roof wins', () => {
    const source = createFixedFootprintRainCover([
      { x: 0, z: 0, halfX: 3, halfZ: 2, yaw: 0, top: 4 },
      { x: 0, z: 0, halfX: 1, halfZ: 1, yaw: Math.PI / 4, top: 6 },
    ])
    expect(source.coverTopAt(2.5, 1.5)).toBe(4)
    expect(source.coverTopAt(0.1, 0.1)).toBe(6)
    expect(source.coverTopAt(5, 0)).toBeUndefined()
    expect(createFixedFootprintRainCover([]).coverTopAt(0, 0)).toBeUndefined()
  })
})
