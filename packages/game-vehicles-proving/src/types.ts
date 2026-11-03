import type { BodyDimensions, DesignStats, SemiInput, SemiSimSpec, SemiState } from '@adatechnology/game-vehicles-driving'

/** Where a vehicle moves: on the ground, on water or in the air. Each domain has its own rooms. */
export type ProvingDomain = 'land' | 'water' | 'air'

/** The vehicle under test: what the runner needs to drive it, with no three.js. */
export interface ProvingSubject {
  /** Id in the catalogue (`compact_hatch`). */
  id: string
  domain: ProvingDomain
  /** Class the ranges are read for (`cars`, `heavy`, `motorcycles`…). Unknown classes use `default`. */
  category: string
  /** Design ratings from the vehicle's card: acceleration and handling 0-10, top speed in km/h. */
  stats: DesignStats
  body: BodyDimensions
  /** Overrides of the semi-simulation spec built from the stats (a game that has measured its own car). */
  spec?: Partial<SemiSimSpec>
}

/** Accepted band of a measured value; a missing side is open. */
export interface ProvingRange {
  min?: number
  max?: number
}

/** pass: inside the range or signed off; fail: outside or refused; pending: not run yet, its room is not built, or nobody looked yet. */
export type ProvingVerdict = 'pass' | 'fail' | 'pending'

export interface ProvingResult {
  test: string
  kind: ProvingTestKind
  verdict: ProvingVerdict
  /** The measured number (null for a visual check or a test that did not finish). */
  value: number | null
  unit: string
  range: ProvingRange
  /** Why it is pending or failed, or what the number means for this vehicle (target speed lowered for a slow vehicle). */
  note?: string
  /** Samples of the run, [seconds, value], for a chart. */
  trace?: Array<[number, number]>
  /** Who signed a visual check off, and the print that proves it. */
  signedBy?: string
  evidence?: string
}

/**
 * measured: run on the semi-simulation driver and compared with a range.
 * visual: a person looks at it in the test room and signs it off with a print (animations, cameras, mirrors).
 * room: needs a room of a later phase (terrain, wind tunnel, crash test); pending until that room reports a result.
 */
export type ProvingTestKind = 'measured' | 'visual' | 'room'

/** What a measured test asks of the driver every step, and what it reads back. */
export interface ProvingProcedure {
  /** Surface under the wheels for the whole run (default `dry_asphalt`). */
  surface?: string
  /** The run stops here whatever happens. */
  maxSeconds: number
  /** Speed (km/h) the run aims for, when it has one; `memo.target` holds it during the run. */
  target?(subject: ProvingSubject): number
  input(state: SemiState, time: number, memo: ProvingMemo): SemiInput
  /** The number drawn on the chart this step. */
  sample(state: SemiState, time: number, memo: ProvingMemo): number
  finished(state: SemiState, time: number, memo: ProvingMemo): boolean
  value(state: SemiState, time: number, memo: ProvingMemo): number | null
}

/** Bookkeeping of one run, shared by the procedure's functions. */
export interface ProvingMemo {
  target: number
  subject: ProvingSubject
  [key: string]: unknown
}

export interface ProvingTest {
  /** snake_case id. */
  id: string
  kind: ProvingTestKind
  /** Domains it applies to. */
  domains: readonly ProvingDomain[]
  unit: string
  /** Measured tests only. */
  procedure?: ProvingProcedure
  /** The accepted band for this subject (measured tests). */
  range?(subject: ProvingSubject): ProvingRange
  /** Room tests: false while the room is not built, so the test stays pending. */
  available?: boolean
}

export interface ProvingCertificate {
  vehicle: string
  domain: ProvingDomain
  category: string
  /** approved: every test passed. rejected: at least one failed. pending: none failed, some not done. */
  status: 'approved' | 'rejected' | 'pending'
  results: ProvingResult[]
}
