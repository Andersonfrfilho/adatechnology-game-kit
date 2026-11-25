import { describe, expect, it } from 'vitest'

import { createPlayer } from '../src/index'

describe('player height & collider (Spec 012 R3 / T2.4)', () => {
  it('defaults to 1.80 m and scales standing/crouched collider height and radius proportionally', () => {
    const p140 = createPlayer({ heightMetres: 1.4 })
    const p180 = createPlayer()
    const p210 = createPlayer({ heightMetres: 2.1 })

    expect(p180.heightMetres).toBe(1.8)
    expect(p140.collider().heightMetres).toBeCloseTo(1.4, 6)
    expect(p180.collider().heightMetres).toBeCloseTo(1.8, 6)
    expect(p210.collider().heightMetres).toBeCloseTo(2.1, 6)

    expect(p140.collider().radiusMetres).toBeLessThan(p180.collider().radiusMetres)
    expect(p210.collider().radiusMetres).toBeGreaterThan(p180.collider().radiusMetres)

    p180.update(1 / 60, { pressed: { crouch: true } })
    expect(p180.state.crouch).toBe(true)
    expect(p180.collider().heightMetres).toBeCloseTo(1.8 * 0.65, 6)
  })

  it('rejects out-of-range heights', () => {
    expect(() => createPlayer({ heightMetres: 0.2 })).toThrow(RangeError)
    expect(() => createPlayer({ heightMetres: 4.5 })).toThrow(RangeError)
  })
})
