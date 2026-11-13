import { describe, expect, it } from 'vitest'

import { snapSunShadow } from '../src/sun-shadow'

const OFFSET: [number, number, number] = [7, 13, 8]
const HALF = 16
const MAP = 1024
const TEXEL = (2 * HALF) / MAP

describe('the sun shadow frustum following the camera', () => {
  it('keeps the light at the same offset from the point it looks at', () => {
    const frame = snapSunShadow({ focus: [30.3, 0, -12.7], offset: OFFSET, half: HALF, mapSize: MAP })
    expect(frame.position.map((v, i) => v - frame.target[i]!)).toEqual(OFFSET)
  })

  it('stays within a texel of the focus, so the shadows near the player are inside it', () => {
    for (const focus of [[0, 0, 0], [31.37, 0, -4.21], [-120.5, 0, 77.77]] as const) {
      const frame = snapSunShadow({ focus: [...focus], offset: OFFSET, half: HALF, mapSize: MAP })
      expect(Math.hypot(frame.target[0] - focus[0], frame.target[1] - focus[1], frame.target[2] - focus[2])).toBeLessThanOrEqual(TEXEL * Math.SQRT2)
    }
  })

  it('puts the frustum centre on the texel grid of the light axes, so a shadow edge never swims', () => {
    const length = Math.hypot(...OFFSET)
    const toLight = OFFSET.map((v) => v / length) as [number, number, number]
    const right = [toLight[2], 0, -toLight[0]].map((v) => v / Math.hypot(toLight[2], toLight[0]))
    for (const x of [10, 10.013, 10.0291, 53.337, -8.9]) {
      const frame = snapSunShadow({ focus: [x, 0, 10], offset: OFFSET, half: HALF, mapSize: MAP })
      const along = frame.target[0] * right[0]! + frame.target[2] * right[2]!
      expect(Math.abs(along / TEXEL - Math.round(along / TEXEL))).toBeLessThan(1e-6)
    }
  })

  it('is the original sun when the camera is at the origin', () => {
    const frame = snapSunShadow({ focus: [0, 0, 0], offset: OFFSET, half: HALF, mapSize: MAP })
    expect(frame.position[0]).toBeCloseTo(7, 9)
    expect(frame.position[1]).toBeCloseTo(13, 9)
    expect(frame.target[2]).toBeCloseTo(0, 9)
  })
})
