import dimsData from './data/dims.json'
import type { FleetVehicleId } from './groups'

/** Length, width and height of a vehicle in metres, as the team measured the full-detail build in the output frame (front = length). */
export interface FleetDims {
  length: number
  width: number
  height: number
}

const table = dimsData as Record<string, FleetDims>

/** The measured size of a fleet vehicle (Frota Leve `DIMS`). The data lives in `data/dims.json`, written by `tools/vehicles-catalog`. */
export const fleetDims = (id: FleetVehicleId | string): FleetDims | undefined => table[id]

/** Every measured size by vehicle id. */
export const allFleetDims = (): Readonly<Record<string, FleetDims>> => table
