import type { PlanAxis } from '@adatechnology/game-floorplan'
import type { LampType } from './lamp-types'

/** Who brings the street side of the service entrance (`ServiceEntrance.street`). */
export type ServiceStreet = 'own' | 'network'

/** A galvanised pipe up the facade from the meter box (`y0`) to its top (`y1`), crowned by a weatherhead bent toward the street; the drop is anchored just under it. */
export interface ServiceMast {
  u: number
  v: number
  y0: number
  y1: number
}

/** A point in the world: `[u, v, y]` (y is the absolute height). */
export type Point3 = [number, number, number]

/** Something fixed to the inner face of a wall of a room: a socket, a switch, the panel. */
export interface WallFixture {
  id: string
  room: string
  floor: number
  u: number
  v: number
  /** Height above the storey floor. */
  y: number
  /** Position along the wall. */
  c: number
  axis: PlanAxis
  pos: number
  frontU: number
  frontV: number
}

export interface Outlet extends WallFixture {
  type: string
  voltage: number
}

export interface LightSwitch extends WallFixture {
  door: string
  /** On the latch side of the door. */
  latchSide: boolean
  /** Lamp ids it turns on. */
  controls: string[]
}

export interface ElectricalPanel extends WallFixture {
  w: number
  h: number
  breakers: number
}

export interface ElectricMeter {
  id: string
  place: string
  u: number
  v: number
  y: number
  side: string
  w: number
  d: number
  h: number
}

/**
 * Pole, drop, meter, descent and the run to the panel; a tap has no meter and a bare connection instead. With the street's own poles (`streetPoles`) the pole is the house's entrance post
 * inside its lot, or `null` when the house has no front yard to stand it in (the meter is on the facade); the street's drop lands at `drop[0]` either way.
 */
export interface ServiceEntrance {
  /**
   * Who brings the street side: absent (`'own'`, the default) the house draws its service pole on the sidewalk and the two neighbouring poles with the grid between them;
   * `'network'` (`generate(..., { street: 'network' })`) the street's utility network does, and `pole` is the house's meter post (padrão), 6 m, inside the lot (`null` on a facade, where the drop lands on a mast up the facade, the descent, as high as on the post).
   */
  street?: ServiceStreet
  pole: { u: number; v: number; h: number } | null
  /** `street: 'network'` on a facade (no front yard): the mast (pontalete) up the facade that takes the drop; a house has this or `pole`, never both. */
  mast?: ServiceMast
  drop: Point3[]
  meter: ElectricMeter | null
  descent: Point3[]
  internalRun: Point3[] | null
  tap?: boolean
  connection?: { u: number; v: number; y: number }
}

export interface Circuit {
  id: string
  room: string
  floor: number
  outlets: string[]
  switches: string[]
  lamps: string[]
  exposed: boolean
  gauge_mm2: number
}

export interface Conduit {
  id: string
  circuit: string
  from: string
  to: string
  exposed: boolean
  diameter: number
  points: Point3[]
}

export interface OutdoorLamp {
  id: string
  u: number
  v: number
  y: number
  door: string
  switch: string | null
  /** The wall base the lamp is fixed to. */
  lamp: LampType
  /** Unit vector out of the wall the base stands on (away from the house). */
  frontU: number
  frontV: number
}
