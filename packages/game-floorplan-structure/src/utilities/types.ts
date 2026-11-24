import type { LotPath, PlanAxis } from '@adatechnology/game-floorplan'
import type { Rect } from '../types'
import type { Point3 } from './electrical-types'

export type * from './electrical-types'

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
