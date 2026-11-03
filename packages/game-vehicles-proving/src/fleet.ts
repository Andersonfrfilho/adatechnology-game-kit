import type { DesignStats } from '@adatechnology/game-vehicles-driving'

import type { ProvingDomain, ProvingSubject } from './types'

/** Kilograms per cubic metre of the bounding box, by group: only used when the card has no mass. */
export const DEFAULT_DENSITY: Readonly<Record<string, number>> = { motorcycles: 90, cars: 88, suvs: 90, pickups: 95, vans: 80, heavy: 120, agricultural: 150, military: 260, water: 60, air: 40 }

/** What a catalogue knows of a vehicle: its design ratings, its measured size and its group (a content pack fills it; see `fleetProvingSubject` of game-vehicles-fleet). */
export interface VehicleCardData {
  stats: DesignStats
  dims: { length: number; width: number; height: number }
  /** Group of the catalogue (`cars`, `heavy`, `water`, `air`…): the class the ranges are read for, and the domain (water and air groups are not land). */
  group: string
  /** Kilograms. Estimated from the size and the group when absent. */
  mass?: number
  /** Metres between the axles and between the wheels, measured on the built vehicle. Estimated from the size when absent. */
  wheelbase?: number
  track?: number
  fourWheelDrive?: boolean
  /** Groups whose vehicles float or fly (default `water` and `air`). */
  domains?: Readonly<Record<string, ProvingDomain>>
}

const DEFAULT_DOMAINS: Readonly<Record<string, ProvingDomain>> = { water: 'water', air: 'air' }

/** A proving subject from what a catalogue knows of a vehicle. */
export function subjectFromCard(id: string, card: VehicleCardData): ProvingSubject {
  const { dims, group } = card
  const mass = card.mass ?? Math.round((DEFAULT_DENSITY[group] ?? 90) * dims.length * dims.width * dims.height)
  return {
    id,
    domain: (card.domains ?? DEFAULT_DOMAINS)[group] ?? 'land',
    category: group,
    stats: { acceleration: card.stats.acceleration, handling: card.stats.handling, maxSpeedKmh: card.stats.maxSpeedKmh },
    body: {
      mass,
      wheelbase: card.wheelbase ?? Math.round(dims.length * 0.6 * 100) / 100,
      track: card.track ?? Math.round(dims.width * 0.82 * 100) / 100,
      fourWheelDrive: !!card.fourWheelDrive,
    },
  }
}
