import type { JointKind } from '@adatechnology/game-contracts'

import { round2 } from '../geometry'
import type { Opening, Rect, StructurePart, Support } from '../types'
import type { WallSplit } from './panels'

export interface CourseSpec {
  rowHeight: number
  /** Length of a unit along the wall; without it a course is one piece per stretch (a log). */
  unitLength?: number
  bond: 'running' | 'stack'
  /** Joint of a unit on the units under it. */
  joint: JointKind
  assembly: string
}

const MIN_UNIT = 0.02

interface Cell {
  from: number
  to: number
  row: number
  y0: number
  y1: number
}

function cutAt(from: number, to: number, openings: readonly Opening[], y0: number, y1: number): [number, number][] {
  let stretches: [number, number][] = [[from, to]]
  for (const opening of openings.filter((o) => o.y0 < y1 - MIN_UNIT && o.y1 > y0 + MIN_UNIT)) {
    stretches = stretches.flatMap(([a, b]): [number, number][] => {
      if (opening.to <= a || opening.from >= b) return [[a, b]]
      return [[a, Math.min(b, opening.from)], [Math.max(a, opening.to), b]].filter(([x, y]) => (y as number) - (x as number) > MIN_UNIT) as [number, number][]
    })
  }
  return stretches
}

function unitsOf(from: number, to: number, row: number, spec: CourseSpec): [number, number][] {
  const length = spec.unitLength
  if (!length) return [[from, to]]
  const offset = spec.bond === 'running' && row % 2 === 1 ? length / 2 : 0
  const cuts: number[] = [from]
  for (let at = from + (offset || length); at < to - MIN_UNIT; at += length) cuts.push(at)
  cuts.push(to)
  return cuts.slice(0, -1).map((start, k): [number, number] => [start, cuts[k + 1]!]).filter(([a, b]) => b - a > MIN_UNIT)
}

/**
 * Cuts a wall into courses of units (bricks laid in bond, or logs): each course is cut at the openings it meets, and each unit rests on the units of the course
 * below that it overlaps. A wall whose lowest course goes loses every course above it. The mass of the wall is shared among the units by volume.
 */
export function splitIntoCourses(wall: StructurePart, openings: readonly Opening[], spec: CourseSpec): WallSplit {
  const alongU = wall.aabb[2] - wall.aabb[0] >= wall.aabb[3] - wall.aabb[1]
  const from = alongU ? wall.aabb[0] : wall.aabb[1]
  const to = alongU ? wall.aabb[2] : wall.aabb[3]
  const cross: [number, number] = alongU ? [wall.aabb[1], wall.aabb[3]] : [wall.aabb[0], wall.aabb[2]]
  const rows = Math.max(1, Math.round((wall.y1 - wall.y0) / spec.rowHeight))
  const rowHeight = (wall.y1 - wall.y0) / rows
  const cells: Cell[] = []
  for (let row = 0; row < rows; row++) {
    const y0 = wall.y0 + row * rowHeight
    const y1 = wall.y0 + (row + 1) * rowHeight
    for (const [a, b] of cutAt(from, to, openings.filter((o) => o.wall === wall.id), y0, y1)) for (const [x0, x1] of unitsOf(a, b, row, spec)) cells.push({ from: x0, to: x1, row, y0, y1 })
  }
  const total = cells.reduce((sum, cell) => sum + (cell.to - cell.from) * (cell.y1 - cell.y0), 0)
  const box = (cell: Cell): Rect => (alongU ? [cell.from, cross[0], cell.to, cross[1]] : [cross[0], cell.from, cross[1], cell.to])
  const pieces = cells.map((cell, index): StructurePart => ({
    id: `${wall.id}_${spec.unitLength ? 'u' : 'log'}${cell.row}_${index}`, role: wall.role, material: wall.material, aabb: box(cell), y0: cell.y0, y1: cell.y1, floor: wall.floor,
    mass: round2(Math.max(0.1, (wall.mass * (cell.to - cell.from) * (cell.y1 - cell.y0)) / total)), host: wall.id, assembly: spec.assembly, unit: true,
  }))
  const internal: Support[] = []
  cells.forEach((cell, index) => {
    if (cell.row === 0) return
    const below = cells.map((other, k) => ({ other, k })).filter(({ other }) => other.row === cell.row - 1 && Math.min(other.to, cell.to) - Math.max(other.from, cell.from) > MIN_UNIT)
    for (const { k } of below) internal.push({ part: pieces[index]!.id, on: pieces[k]!.id, joint: spec.joint })
  })
  return { pieces, internal, base: pieces.filter((_, i) => cells[i]!.row === 0).map((p) => p.id), top: pieces.filter((_, i) => cells[i]!.row === rows - 1).map((p) => p.id) }
}
