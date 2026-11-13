import { describe, expect, it } from 'vitest'

import { SLAB_PANEL_DEFAULTS, buildStructure, slabThicknessFor } from '../src'
import { rectangularHouse } from './synthetic-plan'

/** NBR 6118 13.2.4.1: the least thickness of a slab that is not in cantilever, metres. */
const NBR_ROOF_MINIMUM = 0.07
const NBR_FLOOR_MINIMUM = 0.08

describe('one slab rule for the house and the outbuilding', () => {
  it('is a precast joist-and-block slab: 12 cm in all, 4 cm of it the topping over an 8 cm block', () => {
    expect(SLAB_PANEL_DEFAULTS.precastThickness).toBe(0.12)
    expect(SLAB_PANEL_DEFAULTS.toppingThickness).toBe(0.04)
    expect(SLAB_PANEL_DEFAULTS.precastThickness - SLAB_PANEL_DEFAULTS.toppingThickness).toBeCloseTo(0.08, 10)
  })

  it('keeps the minima of NBR 6118 13.2.4.1 below the precast slab', () => {
    expect(SLAB_PANEL_DEFAULTS.roofMinThickness).toBeGreaterThanOrEqual(NBR_ROOF_MINIMUM)
    expect(SLAB_PANEL_DEFAULTS.floorMinThickness).toBeGreaterThanOrEqual(NBR_FLOOR_MINIMUM)
    expect(SLAB_PANEL_DEFAULTS.precastThickness).toBeGreaterThanOrEqual(SLAB_PANEL_DEFAULTS.floorMinThickness)
  })

  it('the outbuilding (3.2 x 3.0 m, two ways: L/35 asks 9 cm) and a small room take the precast thickness, not 10', () => {
    expect(slabThicknessFor([{ short: 3.0, long: 3.2 }], true)).toBe(0.12)
    expect(slabThicknessFor([{ short: 2.0, long: 2.4 }], true)).toBe(0.12)
    expect(slabThicknessFor([{ short: 2.0, long: 2.4 }], false)).toBe(0.12)
  })

  it('a span that asks more by L/35 or L/25 gets what the span asks (house panels of 5 m)', () => {
    expect(slabThicknessFor([{ short: 5.0, long: 11 }], true)).toBe(0.2)
    expect(slabThicknessFor([{ short: 5.69, long: 5.99 }], true)).toBe(0.17)
    expect(slabThicknessFor([{ short: 3.0, long: 3.2 }, { short: 5.69, long: 5.99 }], true)).toBe(0.17)
  })

  it('the raw slabs of the structure (roof slab, ceiling slab under a tank) are cast at the same thickness', () => {
    const flat = buildStructure({ ...rectangularHouse({ width: 8, depth: 6, roof: 'slab' }), facade: { roof: 'slab' } })
    const roofSlab = flat.parts.find((p) => p.id === 'slab_top')
    expect(roofSlab).toBeDefined()
    expect(roofSlab!.y1 - roofSlab!.y0).toBeCloseTo(SLAB_PANEL_DEFAULTS.precastThickness, 10)
  })
})
