import type { Plan, ResultItem, Room } from '@adatechnology/game-floorplan'
import type { Rng } from './shared'
import type { Circuit, Conduit, ElectricalPanel, LightSwitch, OutdoorLamp, Outlet, ServiceEntrance, ServiceStreet } from './types'
import { NO_SOCKET_ROOMS } from './shared'
import { addOutlets } from './electrical-outlets'
import { addConduits, addSwitches } from './electrical-circuits'
import { placeEntrance, placePanel } from './electrical-entrance'
import { lightPointsOf } from './lamp-types'
import type { LightPoint } from './lamp-types'
import { wallPointsOf } from './wall-points'
import type { WallPoint } from './wall-points'
import { networkStreetOf } from './electrical-types'

export type EnergyMode = 'grid' | 'tap' | 'offgrid'

/** What a template says about its energy (a shack taps the grid without a meter, a cabin may run off-grid on solar). */
export interface EnergyConfig {
  mode: EnergyMode
  solar?: boolean
}

export interface Electrical {
  mode: EnergyMode
  serviceEntrance: ServiceEntrance | null
  panel: ElectricalPanel | null
  outlets: Outlet[]
  switches: LightSwitch[]
  circuits: Circuit[]
  conduits: Conduit[]
  exposed: boolean
  outdoorLamps: OutdoorLamp[]
  lightPoints: LightPoint[]
  source?: 'solar' | 'lamp'
}

export interface ElectricalContext {
  plan: Plan
  items: ResultItem[]
  rng: Rng
  energy?: EnergyConfig
  /** Ids of the rooms that are outbuildings (lit by a batten). */
  outbuildingIds?: readonly string[]
  /** The Visor de casas 3D's installation as it was (`visorSections`): a shop's pole 3 m from its facade, even on a lot. */
  visor?: boolean
  /** The street brings its own poles (a city draws them): the house's entrance post stands inside its lot, and the street's drop lands on it (or on the facade's meter). */
  streetPoles?: boolean
  /** `'network'`: the street's utility network brings the poles and the drop; the entrance is the meter post (padrão) inside the lot (`ServiceEntrance.street`). */
  street?: ServiceStreet
}

/** Shared state of the steps that lay the installation out. */
export interface Layout {
  plan: Plan
  items: ResultItem[]
  rooms: Room[]
  electrical: Electrical
  pointsOf: Map<string, WallPoint[]>
  visor?: boolean
  streetPoles?: boolean
  street?: ServiceStreet
}

export const keyOf = (room: Room): string => `${room.id}@${room.floor}`

const absolute = (plan: Plan, floor: number, y: number): number => (plan.floors[floor] ? plan.floors[floor].y0 : 0) + y
export const heightOf = absolute

/**
 * The electrical installation: sockets for the appliances and by room size, the service entrance (pole, drop, meter, descent; a tap without meter for a shack),
 * the panel near the entrance, switches by the door latch, circuits and conduits. Items that plug in are annotated (`outlet`, `showerHeater`).
 */
export function planElectrical(context: ElectricalContext): Electrical {
  const { plan, items, rng, energy, outbuildingIds = [] } = context
  const mode: EnergyMode = energy?.mode ?? 'grid'
  const electrical: Electrical = { mode, serviceEntrance: null, panel: null, outlets: [], switches: [], circuits: [], conduits: [], exposed: false, outdoorLamps: [], lightPoints: lightPointsOf(plan, items, outbuildingIds) }
  electrical.exposed = plan.style === 'budget' ? rng() < 0.65 : plan.style === 'mid' ? rng() < 0.12 : false
  if (mode !== 'grid') electrical.exposed = true
  if (mode === 'offgrid') {
    electrical.source = energy?.solar ? 'solar' : 'lamp'
    return electrical
  }
  const rooms = plan.rooms.filter((room) => !NO_SOCKET_ROOMS.includes(room.type) && !room.outdoor)
  const pointsOf = new Map<string, WallPoint[]>()
  for (const room of rooms) pointsOf.set(keyOf(room), wallPointsOf(plan, room, items))
  const layout: Layout = { plan, items, rooms, electrical, pointsOf, ...(context.visor ? { visor: true } : {}), ...(context.streetPoles ? { streetPoles: true } : {}), ...(networkStreetOf(context.street) ? { street: networkStreetOf(context.street) } : {}) }
  addOutlets(layout)
  placeEntrance(layout)
  placePanel(layout)
  addSwitches(layout)
  addConduits(layout)
  const entrance = electrical.serviceEntrance
  const meter = entrance?.meter
  if (mode === 'tap' && entrance && meter) {
    entrance.tap = true
    entrance.connection = { u: meter.u, v: meter.v, y: 2.6 }
    entrance.meter = null
  }
  return electrical
}
