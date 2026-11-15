import type { LotPath, PlanAxis } from '@adatechnology/game-floorplan'
import type { Rect } from '../types'
import type { LampType } from './lamp-types'

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

/** Pole, drop, meter, descent and the run to the panel; a tap has no meter and a bare connection instead. */
export interface ServiceEntrance {
  pole: { u: number; v: number; h: number }
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

export interface PlumbingPoint {
  id: string
  kind: string
  item: string
  room: string | null
  floor: number
  u: number
  v: number
  y: number
  flowLpm: number | undefined
  run: string | null
}

export interface PlumbingRun {
  id: string
  from: string
  /** A point, a room, or `ceiling`. */
  to: string | null
  points: Point3[]
  diameter: number
  exposed: string
}

export interface Plumbing {
  tank: 'water_tank' | null
  capacityL: number
  points: PlumbingPoint[]
  visibleRuns: PlumbingRun[]
}

export interface SolarPanel {
  id: string
  u: number
  v: number
  w: number
  d: number
  length: number
}

export interface Inverter {
  id: string
  u: number
  v: number
  y: number
  side: string
  w: number
  d: number
  h: number
  outdoor: boolean
  link: string
}

export interface Solar {
  type: 'slab_rack' | 'roof'
  orientation: string
  north: 'front' | 'back'
  slopeSide: 'front' | 'back' | null
  tilt: number
  area: number[]
  areaM2: number
  count: number
  floor: number
  y: number
  panels: SolarPanel[]
  inverter: Inverter | null
}

/** A door or a window in the wall of an outbuilding. */
export interface OutbuildingOpening {
  id: string
  axis: PlanAxis
  pos: number
  at: number
  u: number
  v: number
  width: number
  side: string
  height?: number
  exterior?: boolean
  y0?: number
  y1?: number
  /** Swing area of a door. */
  zone?: Rect
}

export interface OutbuildingWall {
  axis: PlanAxis
  u0: number
  v0: number
  u1: number
  v1: number
  thickness: number
  h: number
  side: string
}

export interface OutbuildingItem {
  type: string
  category: string
  u: number
  v: number
  w: number
  d: number
  h: number
  ry: number
  frontU: number
  frontV: number
  aabb: Rect
}

export interface Outbuilding {
  id: string
  type: 'outbuilding'
  use: string
  floor: number
  aabb: Rect
  interior: Rect[]
  ceiling: number
  thickness: number
  front: [number, number]
  walls: OutbuildingWall[]
  doors: OutbuildingOpening[]
  windows: OutbuildingOpening[]
  items: OutbuildingItem[]
}

export type { LotPath }
