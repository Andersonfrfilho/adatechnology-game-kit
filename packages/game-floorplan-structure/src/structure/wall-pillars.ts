import { GROUND } from '../types'
import type { Rect, StructurePart } from '../types'
import { touches } from '../geometry'
import type { BuildContext, BuildWall } from './context'

/**
 * Most a masonry wall runs between two of its concrete pillars, metres. Confined masonry (alvenaria confinada / de vedação with a concrete frame) puts a pillar
 * every 3 to 5 m, at the corners, where walls meet and beside the openings; 4 m is the middle of that range.
 */
export const WALL_PILLAR_SPACING = 4
/** Side of a wall pillar, metres: 0.2 x 0.2 m, as the corner pillars (NBR 6118 asks at least 19 cm for a pillar). */
export const WALL_PILLAR_SIDE = 0.2
/** Two pillars closer than this along a wall are one (the corner pillar or a jamb pillar already stands there). */
const MERGE_DISTANCE = 0.45
const HALF = WALL_PILLAR_SIDE / 2
const TOLERANCE = 0.03

interface Stretch {
  wall: BuildWall
  from: number
  to: number
}

const alongRange = (wall: BuildWall): [number, number] => (wall.axis === 'u' ? [Math.min(wall.u0, wall.u1), Math.max(wall.u0, wall.u1)] : [Math.min(wall.v0, wall.v1), Math.max(wall.v0, wall.v1)])
const acrossOf = (wall: BuildWall): number => (wall.axis === 'u' ? wall.v0 : wall.u0)

/** The solid stretches of a wall: the wall cut at its windows (a door is already a gap between two walls). */
function stretchesOf(context: BuildContext, wall: BuildWall): Stretch[] {
  const [low, high] = alongRange(wall)
  const windows = (context.source.windows ?? [])
    .filter((w) => w.floor === wall.floor && w.axis === wall.axis && Math.abs(w.pos - acrossOf(wall)) <= TOLERANCE && w.at + w.width / 2 > low && w.at - w.width / 2 < high)
    .map((w): [number, number] => [w.at - w.width / 2, w.at + w.width / 2])
    .sort((a, b) => a[0] - b[0])
  const out: Stretch[] = []
  let cursor = low
  for (const [from, to] of windows) {
    if (from - cursor > TOLERANCE) out.push({ wall, from: cursor, to: from })
    cursor = Math.max(cursor, to)
  }
  if (high - cursor > TOLERANCE) out.push({ wall, from: cursor, to: high })
  return out
}

/** Where another wall meets this one inside its length (a T): the along coordinates of the meeting points. */
function junctionsOf(context: BuildContext, wall: BuildWall): number[] {
  const [low, high] = alongRange(wall)
  const line = acrossOf(wall)
  const out: number[] = []
  for (const other of context.walls) {
    if (other === wall || other.floor !== wall.floor || other.axis === wall.axis || other.type !== 'wall') continue
    const at = acrossOf(other)
    const [a, b] = alongRange(other)
    const meets = Math.abs(a - line) <= (wall.thickness ?? 0.15) / 2 + TOLERANCE || Math.abs(b - line) <= (wall.thickness ?? 0.15) / 2 + TOLERANCE
    if (meets && at > low + HALF && at < high - HALF) out.push(at)
  }
  return out
}

/**
 * Centres of the pillars of a stretch: at each end (inside the stretch, flush with it), at the walls that meet it, and in between so that no span passes
 * `spacing`. A short pier still gets one at each end (a door jamb beside a corner keeps its own pillar; `addWallPillars` drops the one a pillar already
 * stands near); one too short for two gets one in its middle, and one too short for a pillar none.
 */
export function pillarStations(from: number, to: number, junctions: readonly number[], spacing: number): number[] {
  const length = to - from
  if (length < WALL_PILLAR_SIDE - 1e-6) return []
  if (length < 2 * WALL_PILLAR_SIDE) return [(from + to) / 2]
  if (length < WALL_PILLAR_SIDE + MERGE_DISTANCE) return [from + HALF, to - HALF]
  const fixed = [from + HALF, ...junctions.filter((at) => at > from + HALF + MERGE_DISTANCE && at < to - HALF - MERGE_DISTANCE), to - HALF].sort((a, b) => a - b)
  const out: number[] = []
  fixed.forEach((at, k) => {
    out.push(at)
    const next = fixed[k + 1]
    if (next === undefined) return
    const spans = Math.ceil((next - at) / spacing - 1e-6)
    for (let s = 1; s < spans; s++) out.push(at + ((next - at) * s) / spans)
  })
  return out
}

/**
 * Concrete pillars along the exterior masonry walls of a storey, besides the corner pillars: at the free ends and door jambs, beside the windows, where an
 * inner wall meets them and at most every `spacing` metres. Each is as deep as the wall's centre line (0.2 x 0.2 m, so it sits in the wall under the
 * plaster), rests on what the storey rests on and carries the bond beam over it, so the bond beam stands on the pillars when the bricks under it go.
 */
export function addWallPillars(context: BuildContext, walls: readonly BuildWall[], floor: number, plates: readonly StructurePart[], taken: readonly StructurePart[], spacing: number): StructurePart[] {
  const { builder } = context
  const pillars: StructurePart[] = []
  const placed: [number, number][] = taken.map((p) => [(p.aabb[0] + p.aabb[2]) / 2, (p.aabb[1] + p.aabb[3]) / 2])
  const base = context.baseOf(floor)
  for (const wall of walls) {
    if (!wall.exterior || wall.type !== 'wall') continue
    const top = context.wallParts.get(wall.id)!.y1
    const across = acrossOf(wall)
    const junctions = junctionsOf(context, wall)
    for (const stretch of stretchesOf(context, wall)) {
      // a pillar already standing at an end of the stretch (a corner, the end of the next wall) is where the spacing counts from
      const standing = (end: number): number | undefined => placed.map(([pu, pv]) => (wall.axis === 'u' ? [pu, pv] : [pv, pu]) as [number, number]).find(([a, c]) => Math.abs(c - across) <= TOLERANCE && Math.abs(a - end) < MERGE_DISTANCE + HALF)?.[0]
      const first = standing(stretch.from)
      const last = standing(stretch.to)
      const from = first === undefined ? stretch.from : Math.min(stretch.from, first - HALF)
      const to = last === undefined ? stretch.to : Math.max(stretch.to, last + HALF)
      for (const along of pillarStations(from, to, junctions, spacing)) {
        const [u, v] = wall.axis === 'u' ? [along, across] : [across, along]
        // a pillar near the end of a stretch only stands for it when it is near the end itself (a short pier keeps its jamb pillar)
        const end = Math.abs(along - stretch.from) < Math.abs(along - stretch.to) ? stretch.from : stretch.to
        const endPoint = wall.axis === 'u' ? [end, across] : [across, end]
        const isEnd = Math.abs(along - end) <= HALF + TOLERANCE
        if (placed.some(([pu, pv]) => Math.hypot(pu - u, pv - v) < MERGE_DISTANCE && (!isEnd || Math.hypot(pu - endPoint[0]!, pv - endPoint[1]!) < MERGE_DISTANCE))) continue
        placed.push([u, v])
        const box: Rect = [u - HALF, v - HALF, u + HALF, v + HALF]
        const pillar = builder.add({ id: `wall_column_${floor}_${pillars.length}`, role: 'column', material: context.construction.frame.pillars, aabb: box, y0: context.level(floor), y1: top }, { floor })
        builder.rest(pillar, base === GROUND || !base ? GROUND : base, 'rebar')
        for (const plate of plates.filter((p) => touches(p.aabb, box, 0.01))) builder.rest(plate, pillar, 'rebar')
        pillars.push(pillar)
      }
    }
  }
  return pillars
}
