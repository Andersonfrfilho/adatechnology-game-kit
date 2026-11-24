import type { Vec3 } from './destruction'

/** Anthropometric measures of a standing/seated body derived from stature and lateral build (metres). */
export type BodyMeasures = {
  /** Standing stature from sole to top of skull (excluding hair/hat), in metres. */
  readonly heightMetres: number
  /** Lateral build multiplier (1.0 = reference adult). */
  readonly build: number
  /** Vertical distance from seat surface (H-point) to top of skull, in metres. */
  readonly seatedHeightMetres: number
  /** Vertical distance from seat surface (H-point) to eye level, in metres. */
  readonly seatedEyeHeightMetres: number
  /** Bideltoid shoulder width, in metres. */
  readonly shoulderWidthMetres: number
  /** Horizontal buttock-to-knee length (hip to front of knee), in metres. */
  readonly thighLengthMetres: number
  /** Vertical knee-to-sole length (popliteal/knee height), in metres. */
  readonly shinLengthMetres: number
}

/** Functional roles a vehicle seat can play. */
export const SEAT_ROLES = ['driver', 'front_passenger', 'rear', 'cargo', 'rider', 'pilot', 'crew'] as const

/** Functional role of a vehicle seat. */
export type SeatRole = (typeof SEAT_ROLES)[number]

/** Usable interior clearance of one seat in vehicle local coordinates (+x front, +y up, +z right), in metres. */
export type SeatSpace = {
  /** Stable seat identifier within the vehicle (e.g. 'driver', 'front_right', 'rear_left', 'rider'). */
  readonly id: string
  /** Functional role of the seat. */
  readonly role: SeatRole
  /** Seat hip point (H-point, cushion top centre) in vehicle local coordinates, in metres. */
  readonly hipPoint: Vec3
  /** Clear vertical height from hipPoint to headliner/roof (minimum of 5 rays). `Infinity` for open vehicles/bikes/boats. */
  readonly headroomMetres: number
  /** Clear longitudinal knee/leg space from hipPoint along seat facing direction to first obstruction. `Infinity` if open. */
  readonly legroomMetres: number
  /** Available lateral width at shoulder height for this seat, in metres. `Infinity` for open-sided seats. */
  readonly widthMetres: number
  /** Id of the door opening that serves this seat (matches `DoorOpening.id`); `undefined` for open entry. */
  readonly doorId?: string
}

/** Clear opening of a vehicle door or hatch, in metres. */
export type DoorOpening = {
  /** Matches the vehicle door zone id (e.g. 'door_front_left', 'hatch_commander'). */
  readonly id: string
  /** Clear horizontal opening width, in metres. `Infinity` if open entry. */
  readonly widthMetres: number
  /** Clear vertical opening height, in metres. `Infinity` if open entry. */
  readonly heightMetres: number
}

/** Canonical reasons a body cannot fit a seat/door pair (Spec 012 D2). */
export const FIT_REJECT_REASONS = ['head', 'legs', 'shoulders', 'door'] as const

/** Why a body does not fit a seat/door pair (binary with reason). */
export type FitRejectReason = (typeof FIT_REJECT_REASONS)[number]

/** Result of checking whether a body fits a seat (and optionally its access door). */
export type FitResult =
  | { readonly fits: true }
  | { readonly fits: false; readonly reason: FitRejectReason }
