import type { CabinCategory } from '@adatechnology/game-vehicles'

import type { FleetVehicleId } from './groups'
import { fleetGroupOf } from './proving'

const CABIN_OVERRIDES: Readonly<Partial<Record<FleetVehicleId, CabinCategory>>> = {
  school_bus: 'bus',
  city_bus: 'bus',
  light_4x4: 'military_light',
  troop_truck: 'truck',
  apc_6x6: 'military_armored',
  armored_car_6x6: 'military_armored',
  battle_tank: 'military_armored',
  transport_helicopter: 'aircraft_enclosed',
  light_attack_turboprop: 'aircraft_enclosed',
  attack_helicopter: 'aircraft_enclosed',
  fishing_boat: 'boat_cabin',
  patrol_boat: 'boat_cabin',
}

/** Returns the R6 cabin clearance category for a fleet vehicle id (Spec 012 R6). */
export function fleetCabinCategoryOf(id: FleetVehicleId): CabinCategory {
  const override = CABIN_OVERRIDES[id]
  if (override !== undefined) return override
  const group = fleetGroupOf(id)
  switch (group) {
    case 'cars':
      return 'passenger_car'
    case 'suvs':
    case 'pickups':
      return 'suv_pickup'
    case 'vans':
      return 'van'
    case 'heavy':
      return 'truck'
    case 'agricultural':
      return 'agricultural'
    case 'air':
      return 'aircraft_enclosed'
    case 'motorcycles':
    case 'water':
      return 'open_vehicle'
    case 'military':
      return 'military_armored'
    default:
      return 'passenger_car'
  }
}
