import { describe, expect, it } from 'vitest'

import { DISTRIBUTION, distributionHardwareOf, poleHeightsOf } from '../../src/networks'

const full = distributionHardwareOf(DISTRIBUTION, { mv: true, transformer: true, lamp: true, cables: 5, cableGap: 0.1 })
const { bands } = DISTRIBUTION.slots
const within = (y: number, band: readonly [number, number]): boolean => y >= band[0] - 1e-9 && y <= band[1] + 1e-9

describe('the hardware of the distribution pole sits in its bands (R1)', () => {
  it('the phases rest on the insulators\' tops at the top of the medium voltage band, the crossarm at its bottom', () => {
    expect(full.attachments.mv.length).toBe(3)
    for (const point of full.attachments.mv) expect(point[1]).toBeCloseTo(bands.mv[1], 9)
    expect(full.boxes.find((box) => box.role === 'crossarm')!.y).toBe(bands.mv[0])
  })

  it('the low voltage clamp, the telecom clamps and the lamp each in their own band, the lamp under the low voltage', () => {
    expect(within(full.attachments.lv[1], bands.lv)).toBe(true)
    expect(full.attachments.lv[1]).toBe(poleHeightsOf(DISTRIBUTION.slots).lv)
    expect(full.attachments.telecom.length).toBe(5)
    for (const point of full.attachments.telecom) expect(within(point[1], bands.telecom)).toBe(true)
    const lamp = full.boxes.find((box) => box.role === 'lamp')!
    expect(lamp.y + lamp.height).toBeLessThan(bands.lv[0])
    expect(full.lens!.y + full.lens!.height).toBeLessThan(lamp.y)
  })

  it('the transformer tank hangs in its band, under the crossarm, its bushings 0.3 m or more clear of it', () => {
    const [tank] = full.cylinders
    expect(tank!.y).toBeGreaterThanOrEqual(bands.transformer[0])
    expect(tank!.y + tank!.height).toBeLessThanOrEqual(bands.transformer[1])
    for (const point of full.attachments.transformer!.mv) expect(point[1]).toBeLessThan(bands.mv[0])
  })

  it('a pole with no medium voltage, transformer or lamp has none of their hardware', () => {
    const bare = distributionHardwareOf(DISTRIBUTION, { mv: false, transformer: false, lamp: false, cables: 0, cableGap: 0.1 })
    expect(bare.boxes.map((box) => box.role)).toEqual(['lv_clamp'])
    expect(bare.cylinders).toEqual([])
    expect(bare.lens).toBeUndefined()
  })
})
