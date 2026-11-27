import { describe, expect, it } from 'vitest'

import { footRestHeight } from '../src/index'

describe('the height a round foot rests at', () => {
  it('is the ground height on flat ground', () => {
    expect(footRestHeight(() => 0.37, 4, -2, 0.3)).toBeCloseTo(0.37, 12)
  })

  it('on a sloped plane is the highest point of the disc less the sphere lift', () => {
    const slope = 0.2
    const rest = footRestHeight((x) => slope * x, 0, 0, 0.3)
    // the rim point at d = r has lift r; the best trade-off of d along the slope is found analytically: max over d of slope*d - (r - sqrt(r^2 - d^2))
    let best = 0
    for (let d = 0; d <= 0.3; d += 1e-5) best = Math.max(best, slope * d - (0.3 - Math.sqrt(0.09 - d * d)))
    expect(rest).toBeCloseTo(best, 3)
  })

  it('in a concave bowl is above its middle by the analytic value', () => {
    // a paraboloid h = k d^2 - depth: the foot touches the ring where k d^2 - (r - sqrt(r^2 - d^2)) is largest
    const k = 2.5
    const depth = 0.27
    const radius = 0.3
    const rest = footRestHeight((x, z) => k * (x * x + z * z) - depth, 0, 0, radius)
    let best = -Infinity
    for (let d = 0; d <= radius; d += 1e-5) best = Math.max(best, k * d * d - (radius - Math.sqrt(radius * radius - d * d)) - depth)
    expect(best).toBeGreaterThan(-depth)
    expect(rest).toBeCloseTo(best, 3)
  })
})
