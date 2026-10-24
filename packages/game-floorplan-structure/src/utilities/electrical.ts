import type { Json, Rng } from './shared'
import { NO_SOCKET_ROOMS } from './shared'
import { addOutlets } from './electrical-outlets'
import { addConduits, addSwitches } from './electrical-circuits'
import { placeEntrance, placePanel } from './electrical-entrance'
import { wallPointsOf } from './wall-points'
import type { WallPoint } from './wall-points'

export type EnergyMode = 'grid' | 'tap' | 'offgrid'

/** What a template says about its energy (a shack taps the grid without a meter, a cabin may run off-grid on solar). */
export interface EnergyConfig {
  mode: EnergyMode
  solar?: boolean
}

export interface Electrical {
  mode: EnergyMode
  serviceEntrance: Json | null
  panel: Json | null
  outlets: Json[]
  switches: Json[]
  circuits: Json[]
  conduits: Json[]
  exposed: boolean
  outdoorLamps: Json[]
  source?: 'solar' | 'lamp'
}

export interface ElectricalContext {
  plan: Json
  items: Json[]
  rng: Rng
  energy?: EnergyConfig
}

/** Shared state of the steps that lay the installation out. */
export interface Layout {
  plan: Json
  items: Json[]
  rooms: Json[]
  electrical: Electrical
  pointsOf: Map<string, WallPoint[]>
}

export const keyOf = (room: Json): string => `${room.id}@${room.floor}`

const absolute = (plan: Json, floor: number, y: number): number => (plan.floors[floor] ? plan.floors[floor].y0 : 0) + y
export const heightOf = absolute

/**
 * The electrical installation: sockets for the appliances and by room size, the service entrance (pole, drop, meter, descent; a tap without meter for a shack),
 * the panel near the entrance, switches by the door latch, circuits and conduits. Items that plug in are annotated (`outlet`, `showerHeater`).
 */
export function planElectrical(context: ElectricalContext): Electrical {
  const { plan, items, rng, energy } = context
  const mode: EnergyMode = energy?.mode ?? 'grid'
  const electrical: Electrical = { mode, serviceEntrance: null, panel: null, outlets: [], switches: [], circuits: [], conduits: [], exposed: false, outdoorLamps: [] }
  electrical.exposed = plan.style === 'budget' ? rng() < 0.65 : plan.style === 'mid' ? rng() < 0.12 : false
  if (mode !== 'grid') electrical.exposed = true
  if (mode === 'offgrid') {
    electrical.source = energy?.solar ? 'solar' : 'lamp'
    return electrical
  }
  const rooms = plan.rooms.filter((room: Json) => !NO_SOCKET_ROOMS.includes(room.type) && !room.outdoor)
  const pointsOf = new Map<string, WallPoint[]>()
  for (const room of rooms) pointsOf.set(keyOf(room), wallPointsOf(plan, room, items))
  const layout: Layout = { plan, items, rooms, electrical, pointsOf }
  addOutlets(layout)
  placeEntrance(layout)
  placePanel(layout)
  addSwitches(layout)
  addConduits(layout)
  if (mode === 'tap' && electrical.serviceEntrance?.meter) {
    const entrance = electrical.serviceEntrance
    const meter = entrance.meter
    entrance.tap = true
    entrance.connection = { u: meter.u, v: meter.v, y: 2.6 }
    entrance.meter = null
  }
  return electrical
}
