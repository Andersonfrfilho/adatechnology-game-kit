import layoutData from './data/wheel-layouts.json'

/** One axle of a land vehicle in the model's frame (+x ahead): where it is, the distance between its outer wheels (0 for a single wheel) and the radius of its tyres, in metres. */
export interface FleetAxle {
  x: number
  track: number
  radius: number
  /** Tyres on the axle, twin wheels counted. */
  wheels: number
}

/** The two tracks of a tracked vehicle: the distance between their centre lines, the rearmost and foremost road wheel along x and the radius of a road wheel. */
export interface FleetTracks {
  gauge: number
  rearX: number
  frontX: number
  roadWheels: number
  radius: number
}

export type FleetWheelLayout = { readonly axles: readonly FleetAxle[]; readonly tracks?: undefined } | { readonly tracks: FleetTracks; readonly axles?: undefined }

const table = layoutData as Record<string, FleetWheelLayout>

/**
 * Where the wheels of a land model are, read from the model itself (`tests/wheel-layouts.test.ts` rebuilds the model and fails when this file is out of date).
 * Undefined for a boat, a plane or a helicopter.
 */
export const fleetWheelLayout = (id: string): FleetWheelLayout | undefined => table[id]
