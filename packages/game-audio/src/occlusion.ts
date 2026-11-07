import type { Vec3 } from '@adatechnology/game-contracts'

/** One thing between the source and the listener: a material (and how thick), or a loss the host already knows. */
export type OcclusionHit = {
  readonly material?: string
  /** Metres along the path; scales the table's loss by the mass law (6 dB per doubling). Omit for the table's own thickness. */
  readonly thickness?: number
  /** Decibels this hit takes out, overriding the table. 0 is an open doorway. */
  readonly lossDb?: number
}

/** What lies between two points, nearest the source first. For a path around an edge or through an open door, return the hits of the best open path. */
export type OcclusionQuery = (from: Vec3, to: Vec3) => readonly OcclusionHit[]

/** Transmission loss of a material at a reference thickness (metres). */
export type MaterialTransmission = { readonly lossDb: number; readonly thickness: number }

/** Airborne transmission loss around 500 Hz (typical field values), by material at a reference thickness. A game patches it through `OcclusionSetup.materials`. */
export const TRANSMISSION_LOSS: Readonly<Record<string, MaterialTransmission>> = {
  open: { lossDb: 0, thickness: 1 },
  brick: { lossDb: 42, thickness: 0.12 },
  concrete: { lossDb: 48, thickness: 0.1 },
  stone: { lossDb: 52, thickness: 0.2 },
  mortar: { lossDb: 32, thickness: 0.02 },
  plaster: { lossDb: 30, thickness: 0.05 },
  drywall: { lossDb: 33, thickness: 0.1 },
  ceramic: { lossDb: 32, thickness: 0.01 },
  soil: { lossDb: 55, thickness: 0.5 },
  wood_soft: { lossDb: 22, thickness: 0.04 },
  wood_hard: { lossDb: 24, thickness: 0.04 },
  plywood: { lossDb: 20, thickness: 0.018 },
  mdf: { lossDb: 21, thickness: 0.018 },
  glass: { lossDb: 27, thickness: 0.004 },
  tempered_glass: { lossDb: 30, thickness: 0.006 },
  steel: { lossDb: 28, thickness: 0.002 },
  cast_iron: { lossDb: 42, thickness: 0.01 },
  aluminium: { lossDb: 24, thickness: 0.002 },
  copper: { lossDb: 28, thickness: 0.002 },
  plastic: { lossDb: 12, thickness: 0.003 },
  rubber: { lossDb: 15, thickness: 0.005 },
  leather: { lossDb: 5, thickness: 0.003 },
  fabric: { lossDb: 3, thickness: 0.005 },
  paper: { lossDb: 1, thickness: 0.001 },
  foam: { lossDb: 4, thickness: 0.05 },
  foliage: { lossDb: 6, thickness: 0.5 },
}

export type OcclusionSetup = {
  readonly query: OcclusionQuery
  /** Materials merged over `TRANSMISSION_LOSS`. */
  readonly materials?: Readonly<Record<string, MaterialTransmission>>
  /** Loss of a material the table does not know. Default 30. */
  readonly unknownLossDb?: number
  /** Ceiling of the summed loss: sound still gets around and through, it never drops to silence. Default 50. */
  readonly maxLossDb?: number
  /** Lowpass of a clear sound (Hz). Default 20000. */
  readonly openCutoff?: number
  /** Lowpass floor of an occluded sound (Hz). Default 250. */
  readonly minCutoff?: number
  /** Decibels of loss that close the lowpass by a factor of ten: highs lose more than lows. Default 30. */
  readonly cutoffDbPerDecade?: number
  /** Seconds between two queries of the same voice. Default 0.15. */
  readonly interval?: number
  /** Most queries per `update` (the frame budget). Default 3. */
  readonly budget?: number
  /** Seconds a change takes to settle (no clicks). Default 0.08. */
  readonly smoothing?: number
  /** A voice whose level behind the wall falls below this is not queried again. Default 0.002. */
  readonly audibleLevel?: number
}

export type OcclusionState = { readonly lossDb: number; readonly gain: number; readonly cutoff: number }

export const OCCLUSION_DEFAULTS = {
  unknownLossDb: 30,
  maxLossDb: 50,
  openCutoff: 20000,
  minCutoff: 250,
  cutoffDbPerDecade: 30,
  interval: 0.15,
  budget: 3,
  smoothing: 0.08,
  audibleLevel: 0.002,
} as const

const MASS_LAW_DB_PER_DOUBLING = 6.02

/** Loss of one hit: its own `lossDb`, else the material's, moved by the mass law when the thickness differs from the reference. */
export function hitLossDb(hit: OcclusionHit, setup: Pick<OcclusionSetup, 'materials' | 'unknownLossDb'> = {}): number {
  if (hit.lossDb !== undefined) return Math.max(0, hit.lossDb)
  const entry = hit.material === undefined ? undefined : (setup.materials?.[hit.material] ?? TRANSMISSION_LOSS[hit.material])
  if (!entry) return Math.max(0, setup.unknownLossDb ?? OCCLUSION_DEFAULTS.unknownLossDb)
  if (hit.thickness === undefined || hit.thickness <= 0 || entry.thickness <= 0) return entry.lossDb
  return Math.max(0, entry.lossDb + MASS_LAW_DB_PER_DOUBLING * Math.log2(hit.thickness / entry.thickness))
}

/** Every hit adds, up to `maxLossDb`. */
export function totalLossDb(hits: readonly OcclusionHit[], setup: Omit<OcclusionSetup, 'query'> = {}): number {
  let total = 0
  for (const hit of hits) total += hitLossDb(hit, setup)
  return Math.min(total, setup.maxLossDb ?? OCCLUSION_DEFAULTS.maxLossDb)
}

/** The linear gain and the lowpass (Hz) of a loss: `10^(-dB/20)`, and the cutoff closed by one decade per `cutoffDbPerDecade`. */
export function occlusionState(lossDb: number, setup: Omit<OcclusionSetup, 'query'> = {}): OcclusionState {
  const open = setup.openCutoff ?? OCCLUSION_DEFAULTS.openCutoff
  const floor = Math.min(open, setup.minCutoff ?? OCCLUSION_DEFAULTS.minCutoff)
  const perDecade = setup.cutoffDbPerDecade ?? OCCLUSION_DEFAULTS.cutoffDbPerDecade
  const loss = Math.max(0, lossDb)
  return { lossDb: loss, gain: 10 ** (-loss / 20), cutoff: Math.max(floor, open / 10 ** (loss / perDecade)) }
}
