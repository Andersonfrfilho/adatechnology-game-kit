import { describe, expect, it } from 'vitest'

import { DEFAULT_POLES } from '../../src'
import type { SingleArmSpec } from '../../src'
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

  // The registry gets its first distribution pole in T2.8b (spec 011 §10), which turns this into a sweep of DEFAULT_POLES.
  it('reads the slots of a distribution pole entry and none of the street lights shipped today', () => {
    const single = DEFAULT_POLES.find((pole) => pole.id === 'concrete_arm')?.spec as SingleArmSpec
    const distribution: DistributionPoleDef = { id: 'concrete_distribution', shape: 'distribution', spec: { ...single, slots: DEFAULT_POLE_SLOTS } }
    expect(slotsOfPole(distribution)).toBe(DEFAULT_POLE_SLOTS)
    expect(DEFAULT_POLES.map(slotsOfPole)).toEqual(DEFAULT_POLES.map(() => undefined))
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
