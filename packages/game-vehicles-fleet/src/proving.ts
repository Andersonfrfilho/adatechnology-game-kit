// types only: the fleet does not pull the proving ground into its bundle; a game that certifies vehicles installs game-vehicles-proving itself
import type { ProvingSubject, VehicleCardData } from '@adatechnology/game-vehicles-proving'

type VehicleType = NonNullable<ProvingSubject['body']['type']>
type AxleDimensions = NonNullable<ProvingSubject['body']['axles']>[number]

import { fleetDims } from './dims'
import { fleetGroups } from './groups'
import { fleetStats } from './stats'
import { fleetWheelLayout } from './wheel-layouts'

/** Fleet vehicles that drive all their wheels (the cards say it; the stats file does not carry it). */
export const FLEET_FOUR_WHEEL_DRIVE: readonly string[] = ['light_4x4', 'troop_truck', 'apc_6x6', 'armored_car_6x6', 'battle_tank', 'monster_truck', 'midsize_pickup', 'large_suv', 'tractor', 'quad_bike']

const domainIsLand = (group: string): boolean => group !== 'water' && group !== 'air'

/** What the fleet builds each model as, when it is not a car: the drivetrain and the wheels of the ficha follow it (`semiSpecFromStats`). */
const FLEET_VEHICLE_TYPES: Readonly<Record<string, VehicleType>> = { bicycle: 'bicycle', tractor: 'tractor', battle_tank: 'tracked', quad_bike: 'car' }
/** Groups whose models are all of one type; the 6x6 vehicles of `military` are trucks. */
const GROUP_VEHICLE_TYPES: Readonly<Record<string, VehicleType>> = { motorcycles: 'motorcycle', heavy: 'truck' }
const MILITARY_TRUCKS: readonly string[] = ['troop_truck', 'apc_6x6', 'armored_car_6x6']

/** The type a fleet model is built as. */
export const fleetVehicleTypeOf = (id: string): VehicleType => FLEET_VEHICLE_TYPES[id] ?? (MILITARY_TRUCKS.includes(id) ? 'truck' : GROUP_VEHICLE_TYPES[fleetGroupOf(id) ?? ''] ?? 'car')

/** The fleet group of a vehicle id. */
export const fleetGroupOf = (id: string): string | undefined => (Object.entries(fleetGroups) as Array<[string, readonly string[]]>).find(([, ids]) => ids.includes(id))?.[0]

/**
 * A proving-ground subject (`game-vehicles-proving`) for a fleet vehicle: its card ratings, its measured size, its group and whether it drives all wheels. Pass the kit's mass
 * (`kit.find(id).mass`) and the measured axles when you have them. Null for an id the fleet does not have.
 */
export function fleetProvingSubject(id: string, options: Partial<Pick<VehicleCardData, 'mass' | 'wheelbase' | 'track' | 'fourWheelDrive'>> = {}): ProvingSubject | null {
  const stats = fleetStats(id)
  const dims = fleetDims(id)
  if (!stats || !dims) return null
  const group = fleetGroupOf(id) ?? 'cars'
  // the same mapping as `subjectFromCard` of game-vehicles-proving, the mass estimate at the density of its group when the kit's mass is not given
  const density: Record<string, number> = { motorcycles: 90, cars: 88, suvs: 90, pickups: 95, vans: 80, heavy: 120, agricultural: 150, military: 260, water: 60, air: 40 }
  const layout = fleetWheelLayout(id)
  const axles: readonly AxleDimensions[] | undefined = layout?.axles?.map((axle) => ({ x: axle.x, track: axle.track, radius: axle.radius }))
  // the model's own wheelbase and track (the first and the last axle, the front axle's outer wheels) over the estimate from the length, unless the caller measured them
  const modelWheelbase = axles ? Math.round((axles[0]!.x - axles[axles.length - 1]!.x) * 100) / 100 : undefined
  return {
    id,
    domain: group === 'water' ? 'water' : group === 'air' ? 'air' : 'land',
    category: group,
    stats: { acceleration: stats.acceleration, handling: stats.handling, maxSpeedKmh: stats.maxSpeedKmh },
    body: {
      mass: options.mass ?? Math.round((density[group] ?? 90) * dims.length * dims.width * dims.height),
      wheelbase: options.wheelbase ?? modelWheelbase ?? (layout?.tracks ? Math.round((layout.tracks.frontX - layout.tracks.rearX) * 100) / 100 : Math.round(dims.length * 0.6 * 100) / 100),
      track: options.track ?? axles?.[0]?.track ?? layout?.tracks?.gauge ?? Math.round(dims.width * 0.82 * 100) / 100,
      fourWheelDrive: options.fourWheelDrive ?? FLEET_FOUR_WHEEL_DRIVE.includes(id),
      ...(domainIsLand(group) ? { type: fleetVehicleTypeOf(id), ...(axles && !options.wheelbase ? { axles } : {}), ...(layout?.tracks ? { tracks: layout.tracks } : {}) } : {}),
    },
  }
}
