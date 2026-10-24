import { GROUND } from '../types'
import type { Rect, StructurePart } from '../types'
import { round2, touches } from '../geometry'
import type { BuildContext, BuildWall } from './context'

const MAX_GAP_WITHIN_RUN = 3.2
const POST_SPACING = 2.4
const POST_SIDE = 0.05

interface Run {
  from: number
  to: number
  walls: BuildWall[]
}

const alongOf = (wall: BuildWall, pick: (a: number, b: number) => number): number => (wall.axis === 'u' ? pick(wall.u0, wall.u1) : pick(wall.v0, wall.v1))
const acrossOf = (wall: BuildWall): number => (wall.axis === 'u' ? wall.v0 : wall.u0)

/** Continuous runs of exterior wall on one line and height: a plate or bond beam runs along each. */
function runsOf(context: BuildContext, walls: readonly BuildWall[], floor: number): Run[][] {
  const lines = new Map<string, BuildWall[]>()
  for (const wall of walls) {
    if (!wall.exterior || wall.type !== 'wall') continue
    const top = round2(context.wallParts.get(wall.id)!.y1)
    const key = `${floor}|${wall.axis}|${acrossOf(wall).toFixed(2)}|${top.toFixed(2)}`
    lines.set(key, [...(lines.get(key) ?? []), wall])
  }
  return [...lines.values()].map((line) => {
    const sorted = line.slice().sort((a, b) => alongOf(a, Math.min) - alongOf(b, Math.min))
    const runs: Run[] = []
    for (const wall of sorted) {
      const from = alongOf(wall, Math.min)
      const to = alongOf(wall, Math.max)
      const last = runs[runs.length - 1]
      if (last && from - last.to <= MAX_GAP_WITHIN_RUN) {
        last.to = Math.max(last.to, to)
        last.walls.push(wall)
      } else runs.push({ from, to, walls: [wall] })
    }
    return runs
  })
}

/** Timber posts of a shack: the corner and every ~2.4 m carry the plate; the sheet walls only close. */
function addShackPosts(context: BuildContext, run: Run, plate: StructurePart, floor: number, index: number): StructurePart[] {
  const first = run.walls[0]!
  const across = acrossOf(first)
  const top = context.wallParts.get(first.id)!.y1
  const count = Math.max(1, Math.ceil((run.to - run.from) / POST_SPACING))
  const posts: StructurePart[] = []
  for (let k = 0; k <= count; k++) {
    const along = run.from + ((run.to - run.from) * k) / count
    const [u, v] = first.axis === 'u' ? [along, across] : [across, along]
    const half = 0.05 + POST_SIDE / 2
    const post = context.builder.add({ id: `post_${floor}_${index}_${k}`, role: 'column', material: 'wood_soft', aabb: [u - half, v - half, u + half, v + half], y0: context.level(floor), y1: top }, { floor })
    const base = context.baseOf(floor)
    if (base === GROUND || !base) context.builder.rest(post, GROUND, 'tie')
    else context.builder.rest(post, base, 'nail')
    context.builder.rest(plate, post, 'nail')
    posts.push(post)
  }
  return posts
}

export interface PlatesResult {
  plates: StructurePart[]
  pillars: StructurePart[]
}

function addPlates(context: BuildContext, walls: readonly BuildWall[], floor: number): PlatesResult {
  const { builder, system, construction } = context
  const plates: StructurePart[] = []
  const pillars: StructurePart[] = []
  let counter = 0
  for (const runs of runsOf(context, walls, floor)) {
    for (const run of runs) {
      const first = run.walls[0]!
      const half = (first.thickness ?? 0.15) / 2
      const across = acrossOf(first)
      const top = context.wallParts.get(first.id)!.y1
      const aabb: Rect = first.axis === 'u' ? [run.from - half, across - half, run.to + half, across + half] : [across - half, run.from - half, across + half, run.to + half]
      const material = context.isTimber ? construction.frame.timber : construction.frame.beams
      const plate = builder.add({ id: `plate_${floor}_${counter++}`, role: 'beam', material, aabb, y0: top, y1: top + system.plateThickness }, { floor, beamKind: context.isTimber ? 'plate' : 'bond_beam' })
      if (construction.system === 'improvised') pillars.push(...addShackPosts(context, run, plate, floor, counter))
      else for (const wall of run.walls) builder.rest(plate, context.wallParts.get(wall.id)!, system.joints.beam)
      plates.push(plate)
    }
  }
  return { plates, pillars }
}

function cornerPoints(walls: readonly BuildWall[]): [number, number][] {
  const ends = walls
    .filter((wall) => wall.exterior && wall.type === 'wall')
    .flatMap((wall): [number, number, string][] =>
      wall.axis === 'u'
        ? [[Math.min(wall.u0, wall.u1), wall.v0, 'u'], [Math.max(wall.u0, wall.u1), wall.v0, 'u']]
        : [[wall.u0, Math.min(wall.v0, wall.v1), 'v'], [wall.u0, Math.max(wall.v0, wall.v1), 'v']],
    )
  const points: [number, number][] = []
  for (const a of ends) {
    const joinsOtherAxis = ends.some((b) => b[2] !== a[2] && Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.12)
    if (joinsOtherAxis && !points.some((q) => Math.hypot(q[0] - a[0], q[1] - a[1]) < 0.12)) points.push([a[0], a[1]])
  }
  return points
}

/** Concrete corner pillars of a masonry storey where two exterior walls of different axes meet; they run up to the highest plate they touch. */
function addCornerPillars(context: BuildContext, walls: readonly BuildWall[], floor: number, plates: readonly StructurePart[]): StructurePart[] {
  const { builder } = context
  const topOfFloor = context.topOf(floor)
  return cornerPoints(walls).map(([u, v], k) => {
    const box: Rect = [u - 0.1, v - 0.1, u + 0.1, v + 0.1]
    const top = Math.max(topOfFloor, ...plates.filter((plate) => touches(plate.aabb, box, 0.05)).map((plate) => plate.y0))
    const pillar = builder.add({ id: `column_${floor}_${k}`, role: 'column', material: context.construction.frame.pillars, aabb: box, y0: context.level(floor), y1: top }, { floor })
    const base = context.baseOf(floor)
    builder.rest(pillar, base === GROUND || !base ? GROUND : base, 'rebar')
    for (const plate of plates.filter((p) => touches(p.aabb, pillar.aabb, 0.05))) builder.rest(plate, pillar, 'rebar')
    return pillar
  })
}

/** Plates (bond beams) over the exterior walls of a storey and, in masonry, the corner pillars; records what carries the storey above. */
export function addPlatesAndPillars(context: BuildContext, floor: number): void {
  const walls = context.walls.filter((wall) => wall.floor === floor)
  const { plates, pillars } = addPlates(context, walls, floor)
  if (context.construction.system === 'masonry') pillars.push(...addCornerPillars(context, walls, floor, plates))
  context.pillars.set(floor, pillars)
  context.plates.set(floor, plates)
  const innerBearing = walls.filter((wall) => wall.role === 'wall' && !wall.exterior).map((wall) => context.wallParts.get(wall.id)!)
  context.carriers.set(floor, [...plates, ...pillars, ...innerBearing])
}
