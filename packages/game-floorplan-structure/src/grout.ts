import type { StructurePart } from './types'

/** Two grouted cores closer than this in plan are one cell grouted twice, metres (the cells of a block are a module, 15 or 20 cm, apart). */
export const SAME_CELL = 0.15
const TOLERANCE = 0.05

/** A grouted core of structural masonry: the wall whose `grout` lists it, where along that wall and where it stands in plan. */
export interface GroutCore {
  readonly wall: StructurePart
  readonly at: number
  readonly point: readonly [number, number]
}

const isAlongU = (part: StructurePart): boolean => part.aabb[2] - part.aabb[0] >= part.aabb[3] - part.aabb[1]
const lineOf = (part: StructurePart): number => (isAlongU(part) ? (part.aabb[1] + part.aabb[3]) / 2 : (part.aabb[0] + part.aabb[2]) / 2)

/** Every grouted core of `walls`, each once: a core at a corner or a junction is listed by the one wall that grouts it. */
export function groutCores(walls: readonly StructurePart[]): GroutCore[] {
  return walls.flatMap((wall) => (wall.grout ?? []).map((at): GroutCore => ({ wall, at, point: isAlongU(wall) ? [at, lineOf(wall)] : [lineOf(wall), at] })))
}

/**
 * The stations along `wall` of every grouted core in its line: its own, and the core a wall it meets grouts at their corner or junction (one cell of the
 * interlocked courses, grouted once, serves both walls).
 */
export function coresAlong(wall: StructurePart, walls: readonly StructurePart[]): number[] {
  const alongU = isAlongU(wall)
  const half = (alongU ? wall.aabb[3] - wall.aabb[1] : wall.aabb[2] - wall.aabb[0]) / 2
  const [from, to] = alongU ? [wall.aabb[0], wall.aabb[2]] : [wall.aabb[1], wall.aabb[3]]
  const line = lineOf(wall)
  const out = [...(wall.grout ?? [])]
  for (const core of groutCores(walls.filter((other) => other !== wall && other.floor === wall.floor))) {
    const [along, across] = alongU ? core.point : [core.point[1], core.point[0]]
    if (Math.abs(across - line) <= half + TOLERANCE && along >= from - TOLERANCE && along <= to + TOLERANCE) out.push(along)
  }
  return out.sort((a, b) => a - b)
}

/** Pairs of grouted cores of the same storey closer than `SAME_CELL`: one cell counted and drawn as two cores. */
export function doubledCores(walls: readonly StructurePart[]): [GroutCore, GroutCore][] {
  const cores = groutCores(walls)
  const out: [GroutCore, GroutCore][] = []
  cores.forEach((a, i) => {
    for (const b of cores.slice(i + 1)) if (a.wall.floor === b.wall.floor && Math.hypot(a.point[0] - b.point[0], a.point[1] - b.point[1]) < SAME_CELL) out.push([a, b])
  })
  return out
}
