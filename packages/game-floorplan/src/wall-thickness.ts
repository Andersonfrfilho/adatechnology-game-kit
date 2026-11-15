import { WALL_THICKNESS } from './constants'
import type { FloorplanOptions, Room, TemplateDef } from './types'

let active = WALL_THICKNESS

/** Thickness of the walls of the plan being laid (a template or an option may set it; the engine's default otherwise). */
export const wallThickness = (): number => active
/** Half of it: how far a wall reaches out of its centre line. */
export const wallMargin = (): number => active / 2

/** The wall thickness of a plan of `tpl` with `op`: the option wins over the template, which wins over the engine's default. */
export const wallThicknessFor = (tpl: TemplateDef, op: FloorplanOptions): number => op.wallThickness ?? tpl.wallThickness ?? WALL_THICKNESS

/** Runs `fn` with the walls `thickness` thick (generation is synchronous: the value is restored before anything else runs). */
export function withWallThickness<T>(thickness: number, fn: () => T): T {
  const previous = active
  active = thickness
  try {
    return fn()
  } finally {
    active = previous
  }
}

/** How far the walls reach into `room`: the house's walls for a room of the house, the lot's for an outdoor zone (bounded by the lot's walls and paths). */
export const roomMargin = (room: Pick<Room, 'outdoor'>): number => (room.outdoor ? WALL_THICKNESS / 2 : wallMargin())
