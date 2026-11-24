import { describe, expect, it } from 'vitest'

import { DEFAULT_POLES } from '../../src'
import { DEFAULT_POLE_SLOTS, checkPoleSlots, slotsOfPole } from '../../src/networks'
import type { DistributionPoleDef, PoleSlots } from '../../src/networks'

const shift = (band: readonly [number, number], by: number): readonly [number, number] => [band[0] + by, band[1] + by]

const raise = (slots: PoleSlots, by: number, height: number, embedment: number): PoleSlots => ({
  height,
  embedment,
  bands: {
    mv: shift(slots.bands.mv, by),
    transformer: shift(slots.bands.transformer, by),
    lv: shift(slots.bands.lv, by),
    lighting: shift(slots.bands.lighting, by),
    telecom: shift(slots.bands.telecom, by),
  },
})

describe('pole slots', () => {
  it('fits the default bands of the 11 m pole above the ground, in order, apart by the gaps, the lamp below the low voltage', () => {
    expect(checkPoleSlots(DEFAULT_POLE_SLOTS)).toEqual([])
    expect(DEFAULT_POLE_SLOTS.height - DEFAULT_POLE_SLOTS.embedment).toBeCloseTo(9.3)
    expect(DEFAULT_POLE_SLOTS.bands.lighting[1]).toBeLessThan(DEFAULT_POLE_SLOTS.bands.lv[0])
  })

  it('every pole of the registry with bands fits them, and the registry ships at least one (the distribution pole)', () => {
    const withSlots = DEFAULT_POLES.filter((pole) => slotsOfPole(pole) !== undefined)
    expect(withSlots.map((pole) => pole.id)).toContain('concrete_distribution')
    for (const pole of withSlots) expect(checkPoleSlots(slotsOfPole(pole) as PoleSlots), pole.id).toEqual([])
  })

  it('draws the lamp of the distribution pole in the street light band and its mast up to the top above the ground', () => {
    const pole = DEFAULT_POLES.find((entry) => entry.id === 'concrete_distribution') as DistributionPoleDef
    const { mast, lamp, slots } = pole.spec
    expect(mast.height).toBeCloseTo(slots.height - slots.embedment, 6)
    expect(lamp.y).toBeGreaterThanOrEqual(slots.bands.lighting[0])
    expect(lamp.y + lamp.height).toBeLessThanOrEqual(slots.bands.lighting[1])
  })

  it('raises the bands of a 12 m pole by the extra height above the ground', () => {
    expect(checkPoleSlots(raise(DEFAULT_POLE_SLOTS, 0.9, 12, 1.8))).toEqual([])
  })

  it('refuses a band above the pole top', () => {
    const short: PoleSlots = { ...DEFAULT_POLE_SLOTS, height: 10 }
    expect(checkPoleSlots(short).map((violation) => [violation.code, violation.band])).toEqual([
      ['slot_out_of_pole', 'mv'],
      ['slot_out_of_pole', 'transformer'],
    ])
  })

  it('refuses a band under the ground and a band upside down', () => {
    const slots: PoleSlots = { ...DEFAULT_POLE_SLOTS, bands: { ...DEFAULT_POLE_SLOTS.bands, telecom: [-0.1, -0.2] } }
    expect(checkPoleSlots(slots).map((violation) => violation.code)).toEqual(['slot_inverted', 'slot_out_of_pole'])
  })

  it('refuses the lamp inside the low voltage band and telecom too close under the lamp', () => {
    const lamp: PoleSlots = { ...DEFAULT_POLE_SLOTS, bands: { ...DEFAULT_POLE_SLOTS.bands, lighting: [7, 7.2] } }
    expect(checkPoleSlots(lamp).map((violation) => [violation.code, violation.band])).toEqual([['slot_order', 'lighting']])
    const telecom: PoleSlots = { ...DEFAULT_POLE_SLOTS, bands: { ...DEFAULT_POLE_SLOTS.bands, telecom: [5.9, 6.3] } }
    expect(checkPoleSlots(telecom)[0]).toMatchObject({ code: 'slot_order', band: 'telecom', limit: 0.4 })
  })

  it('keeps the transformer 0.3 m under the crossarm', () => {
    const slots: PoleSlots = { ...DEFAULT_POLE_SLOTS, bands: { ...DEFAULT_POLE_SLOTS.bands, transformer: [7.8, 8.8] } }
    expect(checkPoleSlots(slots)[0]).toMatchObject({ code: 'slot_order', band: 'transformer' })
  })
})
