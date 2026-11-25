import type { PartStyle } from './types'

/** The pole that carries the lamp: a tapered cylinder. */
export type MastSpec = { radiusTop: number; radiusBottom: number; height: number; color: number; segments?: number; style?: PartStyle }
/** A bar or a box of the pole, placed by its base `y`. `reach` is how far from the mast its centre sits. */
export type BarSpec = { reach: number; y: number; width: number; height: number; depth: number; color: number }
/** The box of a lamp head: its colour is the lens, lit or unlit. */
export type LampSpec = { reach: number; y: number; width: number; height: number; depth: number }
/** Colour of the lamp lens when the lamp is on (it glows) and when it is off. */
export type LensSpec = { lit: number; unlit: number }
/** The real light a lamp that is on may get from the budget. `reach` moves it along the arm. */
export type LampLightSpec = { color: number; intensity: number; distance: number; y: number; reach?: number; z?: number }

/** Double arm with two LED heads (the avenue pole of the downtown pattern). */
export type DoubleArmSpec = { mast: MastSpec; arm: BarSpec; lamp: LampSpec; lens: LensSpec; light: LampLightSpec }
/** Concrete pole with one arm and a sodium lamp, with an optional transformer drum. */
export type SingleArmSpec = {
  mast: MastSpec
  arm: BarSpec
  lamp: LampSpec
  lens: LensSpec
  light: LampLightSpec
  transformer: { offset: number; y: number; radius: number; height: number; color: number; segments: number }
}
/** The bands of a distribution pole, top down: medium voltage, transformer, low voltage, street light, telecom. */
export type PoleSlotBand = 'mv' | 'transformer' | 'lv' | 'lighting' | 'telecom'
/**
 * Where each network is fixed on a distribution pole: `[bottom, top]` in metres over the ground. `height` is the whole pole and
 * `embedment` what is buried of it (`postEmbedment(height)` of game-destruction), so the bands fit in `height - embedment`.
 */
export type PoleSlots = { readonly height: number; readonly embedment: number; readonly bands: Readonly<Record<PoleSlotBand, readonly [number, number]>> }
/**
 * A distribution pole: the single arm pole plus the bands its networks are fixed at and the hardware that fixes them (`distributionHardwareOf`):
 * the crossarm (`reach` its centre toward the road) with its pin insulators (`at` along it), the transformer's bushings (`spread` apart on its lid),
 * the low-voltage cable's clamp and the telecom clamps `out` on the field side, and the guy wire (`reach` from the mast to its anchor).
 */
export type DistributionSpec = SingleArmSpec & {
  readonly slots: PoleSlots
  readonly crossarm: { readonly reach: number; readonly width: number; readonly height: number; readonly depth: number; readonly color: number }
  readonly insulators: { readonly at: readonly number[]; readonly radius: number; readonly color: number }
  readonly bushings: { readonly spread: number; readonly radius: number; readonly height: number; readonly color: number }
  readonly lowVoltage: { readonly out: number; readonly color: number }
  readonly telecom: { readonly out: number; readonly color: number }
  readonly guy: { readonly reach: number; readonly color: number }
}
/** A registry entry of a distribution pole: the `distribution` shape reads a `DistributionSpec`. */
export type DistributionPoleDef = PoleDef & { shape: 'distribution'; spec: DistributionSpec }

export type PoleDef = {
  id: string
  /** Key of the shape builder that reads `spec`. */
  shape: string
  spec: object
}
