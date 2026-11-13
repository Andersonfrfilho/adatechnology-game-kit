import { SAME_CELL } from '../grout'
import { getMasonryUnit, moduleOf } from '../masonry-units'
import type { BuildContext, BuildWall } from './context'
import { acrossOf, alongRange, junctionsOf, stretchesOf } from './wall-pillars'
import type { Stretch } from './wall-pillars'

/** Most metres between two grouted cores of a structural masonry wall (NBR 16868: 1.2 to 2 m in houses; the middle of that). */
export const GROUT_SPACING = 1.6
const TOLERANCE = 0.03
const DEFAULT_THICKNESS = 0.15

/** Where the end `end` of `wall` meets another wall across it (a corner, or a T on the other's side): that wall's line, or nothing (a free end). */
function meetingAt(context: BuildContext, wall: BuildWall, end: number): number | undefined {
  const line = acrossOf(wall)
  const half = (wall.thickness ?? DEFAULT_THICKNESS) / 2
  for (const other of context.walls) {
    if (other === wall || other.floor !== wall.floor || other.axis === wall.axis || other.type !== 'wall') continue
    const [a, b] = alongRange(other)
    if (Math.abs(acrossOf(other) - end) <= (other.thickness ?? DEFAULT_THICKNESS) / 2 + TOLERANCE && line >= a - half - TOLERANCE && line <= b + half + TOLERANCE) return acrossOf(other)
  }
  return undefined
}

/**
 * The cores of one solid stretch of a wall: at an end that meets another wall, in the cell where their lines cross (the one cell both walls' interlocked
 * courses share); at a free end or beside a window, in the first cell inside the masonry (half a module in from the jamb); at the walls that meet it inside
 * its length, and in between so that no span passes `GROUT_SPACING`.
 */
function groutStations(context: BuildContext, stretch: Stretch, cell: number): number[] {
  const { wall } = stretch
  const [low, high] = alongRange(wall)
  const atStart = Math.abs(stretch.from - low) < TOLERANCE ? meetingAt(context, wall, low) : undefined
  const atEnd = Math.abs(stretch.to - high) < TOLERANCE ? meetingAt(context, wall, high) : undefined
  const first = atStart ?? stretch.from + cell / 2
  const last = atEnd ?? stretch.to - cell / 2
  if (last - first < SAME_CELL) return [atStart ?? atEnd ?? (stretch.from + stretch.to) / 2]
  const fixed = [first, ...junctionsOf(context, wall).filter((at) => at > first + SAME_CELL && at < last - SAME_CELL), last]
  const out: number[] = []
  fixed.forEach((at, k) => {
    out.push(at)
    const next = fixed[k + 1]
    if (next === undefined) return
    const spans = Math.ceil((next - at) / GROUT_SPACING - 1e-6)
    for (let s = 1; s < spans; s++) out.push(at + ((next - at) * s) / spans)
  })
  return out
}

/**
 * Structural masonry (NBR 16868): the vertical cores of the units grouted with a bar, at each corner and junction, at each free end and beside each window,
 * and at most every `GROUT_SPACING` metres. They go on the wall part (`grout`); a corner or junction core is grouted once, by the first wall that reaches it.
 */
export function addGroutCores(context: BuildContext, walls: readonly BuildWall[]): void {
  const unit = context.construction.walls.unit
  const cell = unit === undefined ? context.pillar.across : moduleOf(getMasonryUnit(unit))
  const placed: [number, number][] = []
  for (const wall of walls) {
    if (wall.type !== 'wall') continue
    const part = context.wallParts.get(wall.id)
    if (!part) continue
    const across = acrossOf(wall)
    const at = new Set<number>()
    for (const stretch of stretchesOf(context, wall)) {
      for (const along of groutStations(context, stretch, cell)) {
        const point: [number, number] = wall.axis === 'u' ? [along, across] : [across, along]
        if (placed.some(([u, v]) => Math.hypot(u - point[0], v - point[1]) < SAME_CELL)) continue
        placed.push(point)
        at.add(Math.round(along * 100) / 100)
      }
    }
    part.grout = [...at].sort((a, b) => a - b)
  }
}
