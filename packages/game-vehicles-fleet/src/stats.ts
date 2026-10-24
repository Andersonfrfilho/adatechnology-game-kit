import cardsPtBr from './data/cards.pt-BR.json'
import statsData from './data/stats.json'
import type { FleetVehicleId } from './groups'

/** The design ratings of a vehicle in the Frota document: six 0-10 ratings, the radius its noise carries and its top speed. */
export interface FleetStats {
  speed: number
  acceleration: number
  handling: number
  toughness: number
  load: number
  consumption: number
  /** Metres the engine noise carries. */
  noiseRadius: number
  maxSpeedKmh: number
}

/** The texts of a vehicle's design card (the team wrote them in Brazilian Portuguese). */
export interface FleetCard {
  name: string
  kind: string
  description: string
  inspiredBy: string
  seats: string
  tank: string
  efficiency: string
  fuel: string
  autonomy: string
  tags: string[]
}

const stats = statsData as Record<string, FleetStats>
const cards = cardsPtBr as Record<string, FleetCard>

/** Design ratings by vehicle id (data in `data/stats.json`, written by `tools/vehicles-catalog`). */
export const fleetStats = (id: FleetVehicleId | string): FleetStats | undefined => stats[id]

/** The design card in Brazilian Portuguese; other languages are not translated yet. */
export const fleetCard = (id: FleetVehicleId | string): FleetCard | undefined => cards[id]
