import type { PoleDef, PoleSlotBand, PoleSlots } from '../poles'

/** The bands from the top of the pole down. */
export const POLE_SLOT_ORDER: readonly PoleSlotBand[] = ['mv', 'transformer', 'lv', 'lighting', 'telecom']

/**
 * Least free gap between the top of a band and the bottom of the band above it, metres: the transformer drum 0.3 m under the crossarm,
 * the first telecom cable 0.4 m under the lamp. A band never enters the one above (gap 0 at least).
 */
export const POLE_SLOT_GAPS: Readonly<Record<Exclude<PoleSlotBand, 'mv'>, number>> = { transformer: 0.3, lv: 0, lighting: 0, telecom: 0.4 }

/** The 11 m double-T concrete pole, 1.7 m buried (9.3 m above the ground), with the bands of Brazilian distribution practice. */
export const DEFAULT_POLE_SLOTS: PoleSlots = {
  height: 11,
  embedment: 1.7,
  bands: { mv: [9, 9.25], transformer: [7.7, 8.7], lv: [7.1, 7.4], lighting: [6.5, 6.8], telecom: [5.7, 6.1] },
}

export type PoleSlotViolation = {
  readonly code: 'slot_out_of_pole' | 'slot_inverted' | 'slot_order'
  readonly band: PoleSlotBand
  readonly value: number
  readonly limit: number
}

/** Every band inside the pole above the ground, bottom under top, in order and apart by the least gaps. */
export function checkPoleSlots(slots: PoleSlots, gaps: Readonly<Record<Exclude<PoleSlotBand, 'mv'>, number>> = POLE_SLOT_GAPS): PoleSlotViolation[] {
  const violations: PoleSlotViolation[] = []
  const above = slots.height - slots.embedment
  for (const band of POLE_SLOT_ORDER) {
    const [bottom, top] = slots.bands[band]
    if (bottom > top) violations.push({ code: 'slot_inverted', band, value: bottom, limit: top })
    if (bottom < 0) violations.push({ code: 'slot_out_of_pole', band, value: bottom, limit: 0 })
    if (top > above) violations.push({ code: 'slot_out_of_pole', band, value: top, limit: above })
  }
  for (let index = 1; index < POLE_SLOT_ORDER.length; index++) {
    const band = POLE_SLOT_ORDER[index] as Exclude<PoleSlotBand, 'mv'>
    const upper = POLE_SLOT_ORDER[index - 1] as PoleSlotBand
    const gap = slots.bands[upper][0] - slots.bands[band][1]
    if (gap < gaps[band]) violations.push({ code: 'slot_order', band, value: gap, limit: gaps[band] })
  }
  return violations
}

const isPoleSlots = (value: unknown): value is PoleSlots =>
  typeof value === 'object' && value !== null && 'bands' in value && 'height' in value && 'embedment' in value

/** The slots a pole of the registry declares (a distribution pole), or none. */
export function slotsOfPole(pole: PoleDef): PoleSlots | undefined {
  const slots: unknown = 'slots' in pole.spec ? pole.spec.slots : undefined
  return isPoleSlots(slots) ? slots : undefined
}
