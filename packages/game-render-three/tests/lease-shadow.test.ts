import { describe, expect, it } from 'vitest'

import { createLightBudget } from '../src'
import { THREE, lightAt } from './helpers'

describe('shadow slots of a lease', () => {
  it('apply the shadow settings of the budget to the shadow slots only', () => {
    const budget = createLightBudget(THREE, new THREE.Scene(), { point: 3, spot: 0, pointShadows: 2, shadowSettings: { bias: -0.0012, normalBias: 0.05, near: 0.12 } })
    const shadowed = lightAt(budget.group, 0)
    expect(shadowed.castShadow).toBe(true)
    expect(shadowed.shadow.bias).toBe(-0.0012)
    expect(shadowed.shadow.normalBias).toBe(0.05)
    expect(shadowed.shadow.camera.near).toBeCloseTo(0.12)
    expect(lightAt(budget.group, 2).shadow.bias).toBe(0)
  })

  it('invalidateShadow marks one leased shadow map, or all of them, for a redraw', () => {
    const budget = createLightBudget(THREE, new THREE.Scene(), { point: 3, spot: 0, pointShadows: 2 })
    const lease = budget.lease({ owner: 'test', point: 3, shadows: 2 })!
    const [first, second] = [lightAt(budget.group, 0), lightAt(budget.group, 1)]
    first.shadow.needsUpdate = false
    second.shadow.needsUpdate = false
    lease.invalidateShadow(1)
    expect([first.shadow.needsUpdate, second.shadow.needsUpdate]).toEqual([false, true])
    first.shadow.needsUpdate = false
    second.shadow.needsUpdate = false
    lease.invalidateShadow()
    expect([first.shadow.needsUpdate, second.shadow.needsUpdate]).toEqual([true, true])
  })
})
