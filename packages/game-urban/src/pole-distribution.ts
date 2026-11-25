import { DEFAULT_POLE_SLOTS } from './networks/slots'
import type { DistributionSpec } from './pole-specs'

/** The 11 m double-T concrete distribution pole (9.3 m above the ground): the lamp's arm in the street light band, the drum in the transformer band. */
export const DISTRIBUTION: DistributionSpec = {
  mast: { radiusTop: 0.12, radiusBottom: 0.22, height: 9.3, color: 0x8a8a84, segments: 4 },
  arm: { reach: 1, y: 6.7, width: 2, height: 0.1, depth: 0.1, color: 0x6a6a66 },
  lamp: { reach: 2, y: 6.55, width: 0.5, height: 0.16, depth: 0.3 },
  lens: { lit: 0xffa040, unlit: 0x3a3a3a },
  light: { color: 0xff9a40, intensity: 1.3, distance: 20, y: 6.4 },
  transformer: { offset: 0.45, y: 7.7, radius: 0.32, height: 1, color: 0x5a5e62, segments: 8 },
  slots: DEFAULT_POLE_SLOTS,
  crossarm: { reach: 0.3, width: 2, height: 0.1, depth: 0.09, color: 0x8c8c86 },
  insulators: { at: [-0.55, 0.35, 1.15], radius: 0.04, color: 0xd8d4c8 },
  bushings: { spread: 0.16, radius: 0.025, height: 0.14, color: 0xa8b0b8 },
  lowVoltage: { out: 0.2, color: 0x5e6064 },
  telecom: { out: 0.18, color: 0x5e6064 },
  guy: { reach: 3, color: 0x7a7c7e },
}
