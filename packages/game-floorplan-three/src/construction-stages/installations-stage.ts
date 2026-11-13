import type * as THREE_NS from 'three'
import type { GroundExcavation } from '@adatechnology/game-contracts'

import type { HouseRecord, Three } from '../kernel-types.js'
import { BoxBatch } from './box-batch.js'
import { PUBLIC_SIDEWALK } from '../lot/terrain.js'
import { SAND_BOX } from '../roof/gutters.js'
import { BURIED_Y, FEED_EXIT_Y, FEED_Y, houseFootprint, routingPlanOf } from './installation-routes.js'
import type { RoutePoint } from './installation-routes.js'

/** What drains into the sewer, and the bore of its pipe (metres). */
const DRAIN_BORE: Readonly<Record<string, number>> = { flush: 0.1, shower: 0.05, tap: 0.05, tub: 0.05, machine: 0.05 }
/** Fall of a sewer run, metres per metre (NBR 8160: 1 % for 100 mm and up, 2 % under it). */
const FALL = { main: 0.01, branch: 0.02 } as const
const TRENCH = { width: 0.4, bed: 0.03, berm: { width: 0.45, height: 0.2, crest: 0.12 } } as const
/** How far the spoil heaps stand off a trench's edge, metres: past the ground's cell the trench wall slopes in (`game-terrain` digs by its cells). */
const SPOIL_CLEAR = 0.12

/** How long one shovelful's hump of a heap runs, metres, and how much its height varies from one to the next. */
const HUMP = { length: 0.7, vary: 0.25, overlap: 0.25 } as const

/**
 * A heap laid as the shovel leaves it: humps one after another along it, each its own height (the same every time for the same place), running into each other.
 * One surface for the whole heap (the highest hump over each point), never two humps crossing: two slopes crossing at a shallow angle flicker along the seam.
 */
function addHumps(batch: BoxBatch, rect: Rect): void {
  const alongX = rect[2] - rect[0] >= rect[3] - rect[1]
  const from = alongX ? rect[0] : rect[1], to = alongX ? rect[2] : rect[3]
  const count = Math.max(1, Math.round((to - from) / HUMP.length)), step = (to - from) / count
  const humps = Array.from({ length: count }, (_, k) => {
    const a = Math.max(from, from + k * step - (k > 0 ? HUMP.overlap / 2 : 0)), b = Math.min(to, from + (k + 1) * step + (k < count - 1 ? HUMP.overlap / 2 : 0))
    // a height of its own from where it lies: a hash of its place, not a random draw
    const seed = Math.sin((rect[0] + rect[1]) * 12.9898 + (from + k * step) * 78.233) * 43758.5453
    return { a: a - from, b: b - from, h: TRENCH.berm.height * (1 + HUMP.vary * (2 * (seed - Math.floor(seed)) - 1)) }
  })
  const rise = (s: number): number => Math.max(0, ...humps.map(({ a, b, h }) => (s <= a || s >= b ? 0 : (h + MOUND_SINK) * Math.pow(Math.sin((Math.PI * (s - a)) / (b - a)), 0.6))))
  addHeap(batch, rect, rise, count)
}

/** A face of four corners, wound and lit as it faces (its normal from its corners). */
function addFacet(batch: BoxBatch, corners: readonly (readonly [number, number, number])[]): void {
  const [a, b, , d] = corners as [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]]
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
  const n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!]
  const length = Math.hypot(n[0]!, n[1]!, n[2]!) || 1
  batch.addQuad(corners, [n[0]! / length, n[1]! / length, n[2]! / length])
}

/** How many facets a mound has along and across. */
const MOUND_GRID = { along: 8, across: 5 } as const
/** How far a mound's edge and ends sink under the ground, metres: the toe crosses the ground's plane at a slope instead of lying on it. */
const MOUND_SINK = 0.04

/**
 * A mound of dug earth: highest along its middle, falling off into the ground at its edges and ends as loose earth does (a bell across and along, its toe a few
 * centimetres under the surface so no face lies on the ground's plane); no face under it.
 */
function addHeap(batch: BoxBatch, [x0, z0, x1, z1]: Rect, rise: (s: number) => number, humps: number): void {
  const alongX = x1 - x0 >= z1 - z0
  const width = alongX ? z1 - z0 : x1 - x0, length = alongX ? x1 - x0 : z1 - z0
  const at = (s: number, t: number): [number, number, number] => {
    const y = rise(s) * Math.pow(Math.max(0, Math.sin((Math.PI * t) / width)), 0.8) - MOUND_SINK
    return alongX ? [x0 + s, y, z0 + t] : [x0 + t, y, z0 + s]
  }
  const along = MOUND_GRID.along * humps, { across } = MOUND_GRID
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < across; j++) {
      const s0 = (length * i) / along, s1 = (length * (i + 1)) / along, t0 = (width * j) / across, t1 = (width * (j + 1)) / across
      const quad = [at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t1)]
      // wound to look up and out of the mound
      const e1 = [quad[1]![0] - quad[0]![0], quad[1]![1] - quad[0]![1], quad[1]![2] - quad[0]![2]], e2 = [quad[3]![0] - quad[0]![0], quad[3]![1] - quad[0]![1], quad[3]![2] - quad[0]![2]]
      const up = e1[2]! * e2[0]! - e1[0]! * e2[2]!
      addFacet(batch, up >= 0 ? quad : [quad[0]!, quad[3]!, quad[2]!, quad[1]!])
    }
  }
}
/** The capped end of a fixture's drain waits just under the ground, in its pit, for the floor and the fixture. */
const RISER_TOP = -0.02
/** A box's lid stands this little over the ground: flush to the eye and the foot, never on the ground's plane. */
const LID_TOP = 0.009

type Rect = readonly [number, number, number, number]

interface SewerPiece {
  readonly points: readonly RoutePoint[]
  readonly bore: number
}

/** The stretches of a rectangle's edge that no other rectangle covers: where the excavation has a wall. */
function openEdges(rect: Rect, others: readonly Rect[], solids: readonly Rect[] = []): { readonly a: RoutePoint; readonly b: RoutePoint; readonly out: readonly [number, number] }[] {
  const [x0, z0, x1, z1] = rect
  const edges: { fixed: number; alongX: boolean; from: number; to: number; out: [number, number] }[] = [
    { fixed: z0, alongX: true, from: x0, to: x1, out: [0, -1] },
    { fixed: z1, alongX: true, from: x0, to: x1, out: [0, 1] },
    { fixed: x0, alongX: false, from: z0, to: z1, out: [-1, 0] },
    { fixed: x1, alongX: false, from: z0, to: z1, out: [1, 0] },
  ]
  const result: { a: RoutePoint; b: RoutePoint; out: [number, number] }[] = []
  for (const e of edges) {
    let spans: [number, number][] = [[e.from, e.to]]
    for (const o of others) {
      const across0 = e.alongX ? o[1] : o[0], across1 = e.alongX ? o[3] : o[2]
      // the other opening covers this edge only where the edge runs inside it (its face is then open ground on both sides)
      if (e.fixed <= across0 + 1e-6 || e.fixed >= across1 - 1e-6) continue
      const c0 = e.alongX ? o[0] : o[1], c1 = e.alongX ? o[2] : o[3]
      spans = spans.flatMap(([s0, s1]): [number, number][] => {
        if (c1 <= s0 || c0 >= s1) return [[s0, s1]]
        return ([[s0, Math.max(s0, c0)], [Math.min(s1, c1), s1]] as [number, number][]).filter(([a, b]) => b - a > 1e-4)
      })
    }
    // where a buried beam or footing runs along the edge, its own face is the hole's wall there
    for (const o of solids) {
      const across0 = e.alongX ? o[1] : o[0], across1 = e.alongX ? o[3] : o[2]
      if (e.fixed < across0 - 0.02 || e.fixed > across1 + 0.02) continue
      const c0 = e.alongX ? o[0] : o[1], c1 = e.alongX ? o[2] : o[3]
      spans = spans.flatMap(([s0, s1]): [number, number][] => (c1 <= s0 || c0 >= s1 ? [[s0, s1]] : ([[s0, Math.max(s0, c0)], [Math.min(s1, c1), s1]] as [number, number][]).filter(([a, b]) => b - a > 1e-4)))
    }
    for (const [s0, s1] of spans) {
      result.push(e.alongX ? { a: [s0, 0, e.fixed], b: [s1, 0, e.fixed], out: e.out } : { a: [e.fixed, 0, s0], b: [e.fixed, 0, s1], out: e.out })
    }
  }
  return result
}

/**
 * The dug earth of the excavation, heaped along the rim of each trench and pit in the yard. The hole itself is the ground's (`GroundExcavation`, dug by the
 * host's terrain): this draws nothing of it, only the spoil on the ground beside it.
 */
function addSpoil(THREE: Three, parent: THREE_NS.Group, trenches: readonly Trench[], material: THREE_NS.Material, site: { readonly solids: readonly Rect[]; readonly footprint: Rect; readonly buildings: readonly Rect[] }): void {
  const heap = new BoxBatch()
  const rects = trenches.map((t) => t.rect)
  // the heaps already laid: a piece of another edge's heap is cut off them, so no two heaps lie one through the other
  const laid: Rect[] = []
  trenches.forEach(({ rect: r }, i) => {
    const others = rects.filter((_, k) => k !== i)
    for (const e of openEdges(r, others, site.solids)) {
      const [ox, oz] = e.out
      const x0 = Math.min(e.a[0], e.b[0]), x1 = Math.max(e.a[0], e.b[0]), z0 = Math.min(e.a[2], e.b[2]), z1 = Math.max(e.a[2], e.b[2])
      const w = TRENCH.berm.width
      // past the cell the ground's wall slopes in, never where a building stands (the house, an outbuilding): its frame and foundation are there
      const heapAt: Rect = ox ? [ox > 0 ? x1 + SPOIL_CLEAR : x0 - SPOIL_CLEAR - w, z0, ox > 0 ? x1 + SPOIL_CLEAR + w : x0 - SPOIL_CLEAR, z1] : [x0, oz > 0 ? z1 + SPOIL_CLEAR : z0 - SPOIL_CLEAR - w, x1, oz > 0 ? z1 + SPOIL_CLEAR + w : z0 - SPOIL_CLEAR]
      const onBuilding = [site.footprint, ...site.buildings].some(([bx0, bz0, bx1, bz1]) => heapAt[2] > bx0 - 0.4 && heapAt[0] < bx1 + 0.4 && heapAt[3] > bz0 - 0.4 && heapAt[1] < bz1 + 0.4)
      // never over a hole: the pieces of the heap off every trench and pit (with the slope of its edge) are heaped, a sliver of one is not
      if (!onBuilding) for (const piece of rectMinus(heapAt, [...rects.map((t) => [t[0] - SPOIL_CLEAR, t[1] - SPOIL_CLEAR, t[2] + SPOIL_CLEAR, t[3] + SPOIL_CLEAR] as Rect), ...laid])) {
        if (Math.min(piece[2] - piece[0], piece[3] - piece[1]) < TRENCH.berm.crest * 2) continue
        addHumps(heap, piece)
        laid.push(piece)
      }
    }
  })
  const mound = heap.mesh(THREE, material, 'excavation:heap')
  if (mound) parent.add(mound)
}

/** A trench or pit as the ground has it dug: its rectangle and the depth of its bed under the surface at each end of its length. */
function excavationOf(t: Trench): GroundExcavation {
  const [x0, z0, x1, z1] = t.rect
  const alongX = x1 - x0 >= z1 - z0
  const midX = (x0 + x1) / 2, midZ = (z0 + z1) / 2
  const near = alongX ? -t.bed(x0, midZ) : -t.bed(midX, z0), far = alongX ? -t.bed(x1, midZ) : -t.bed(midX, z1)
  return Math.abs(far - near) < 1e-4 ? { rect: t.rect, depth: near } : { rect: t.rect, depth: near, toDepth: far, along: alongX ? 'x' : 'z' }
}

/** A pipe: a cylinder per straight stretch, a fitting at each bend (an elbow's socket) so the stretches meet. */
function addPipe(THREE: Three, parent: THREE_NS.Group, points: readonly RoutePoint[], radius: number, material: THREE_NS.Material): void {
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!, b = points[i + 1]!
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const len = dir.length()
    if (len < 1e-3) continue
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 12), material)
    mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    mesh.quaternion.setFromUnitVectors(up, dir.normalize())
    parent.add(mesh)
  }
  for (let i = 1; i + 1 < points.length; i++) {
    const p = points[i]!
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.25, 12, 8), material)
    elbow.position.set(p[0], p[1], p[2])
    parent.add(elbow)
  }
}

/**
 * A sewer box (inspection, grease or floor drain) set in the ground: its walls down to its floor, its concrete lid on top, flush with the ground (9 mm over, clear of the compacted bed under the house at 6 mm,
 * it, never on its plane). The trench reaches its sides; nothing is dug round it.
 */
function addSunkBox(THREE: Three, parent: THREE_NS.Group, box: SunkBox, mats: { readonly concrete: THREE_NS.Material; readonly lid: THREE_NS.Material }): void {
  const { u, v, size, bottom } = box
  const body = new BoxBatch()
  const wall = 0.05
  const top = -0.004
  body.add([u - size / 2, bottom, v - size / 2, u + size / 2, bottom + wall, v + size / 2])
  body.add([u - size / 2, bottom, v - size / 2, u - size / 2 + wall, top, v + size / 2])
  body.add([u + size / 2 - wall, bottom, v - size / 2, u + size / 2, top, v + size / 2])
  body.add([u - size / 2 + wall, bottom, v - size / 2, u + size / 2 - wall, top, v - size / 2 + wall])
  body.add([u - size / 2 + wall, bottom, v + size / 2 - wall, u + size / 2 - wall, top, v + size / 2])
  const mesh = body.mesh(THREE, mats.concrete, 'sewer:box')
  if (mesh) parent.add(mesh)
  if (box.lid === false) return
  const lid = new BoxBatch()
  lid.add([u - size / 2, top, v - size / 2, u + size / 2, LID_TOP, v + size / 2])
  const cover = lid.mesh(THREE, mats.lid, 'sewer:lid')
  if (cover) parent.add(cover)
}

interface Drain {
  readonly u: number
  readonly v: number
  readonly bore: number
  readonly kind: string
}

/** The sewer runs of the plan's drains: each fixture down into the ground, a branch with its fall to the collector, the collector to the street. */
/** A stretch of trench: its plan rectangle and its bed, which falls with the pipe laid on it (from `high` at one end of its length to `low` at the other). */
interface Trench {
  readonly rect: Rect
  readonly bed: (x: number, z: number) => number
  /** A box's pit, dug to the box's floor round it. */
  readonly pit?: true
}

/** Working room dug round a sewer box on each side, metres: the box stands in its own pit, its walls clear of the earth until the backfill. */
const PIT_MARGIN = 0.15

/** `r` less the rectangles `holes` (each cut leaves up to four pieces). */
function rectMinus(r: Rect, holes: readonly Rect[]): Rect[] {
  let pieces: Rect[] = [r]
  for (const h of holes) {
    pieces = pieces.flatMap((p): Rect[] => {
      if (h[0] >= p[2] || h[2] <= p[0] || h[1] >= p[3] || h[3] <= p[1]) return [p]
      const out: Rect[] = []
      if (h[0] > p[0]) out.push([p[0], p[1], h[0], p[3]])
      if (h[2] < p[2]) out.push([h[2], p[1], p[2], p[3]])
      const x0 = Math.max(p[0], h[0]), x1 = Math.min(p[2], h[2])
      if (h[1] > p[1]) out.push([x0, p[1], x1, h[1]])
      if (h[3] < p[3]) out.push([x0, h[3], x1, p[3]])
      return out
    })
  }
  return pieces
}

/** A trench along a straight run from (a) to (b), its bed `under` the run's line (the pipe lies on it). */
function trenchAlong(a: RoutePoint, b: RoutePoint, halfWidth: number, under: number): Trench {
  const rect: Rect = [Math.min(a[0], b[0]) - halfWidth, Math.min(a[2], b[2]) - halfWidth, Math.max(a[0], b[0]) + halfWidth, Math.max(a[2], b[2]) + halfWidth]
  const alongX = Math.abs(b[0] - a[0]) >= Math.abs(b[2] - a[2])
  const from = alongX ? a[0] : a[2], to = alongX ? b[0] : b[2]
  const bed = (x: number, z: number): number => {
    const t = Math.abs(to - from) < 1e-6 ? 0 : Math.max(0, Math.min(1, ((alongX ? x : z) - from) / (to - from)))
    return a[1] + (b[1] - a[1]) * t - under
  }
  return { rect, bed }
}

/** A box set in the ground: its centre, side, floor; a yard box stays after the backfill; a sand box is open (its grate is set with the sidewalk). */
interface SunkBox {
  readonly u: number
  readonly v: number
  readonly size: number
  readonly bottom: number
  readonly yard: boolean
  readonly lid?: false
}

/** Each box is set in a pit of its own, dug to its floor: its walls stand clear in it, never through the trench's earth. */
const pitOf = (b: SunkBox): Trench => {
  const half = b.size / 2 + PIT_MARGIN
  return { rect: [b.u - half, b.v - half, b.u + half, b.v + half], bed: () => b.bottom, pit: true }
}

/** A sand box at the foot of a downpipe (the gutters drew it): where it is in plan. */
export interface RainDrain {
  readonly x: number
  readonly z: number
}

/** The rainwater pipe (NBR 10844): its fall (0.5 % the least), how deep it leaves the sand box, its bore. */
const RAIN = { fall: 0.01, cover: 0.3, bore: 0.1 } as const

/**
 * The rainwater of the roof, never in the sewer (NBR 10844 and the sewer's operator): from each sand box a pipe of its own falls to the front of the lot and on
 * under the public sidewalk to the kerb, where it lets out into the street's gutter.
 */
function rainLayout(plan: HouseRecord, drains: readonly RainDrain[]): { pieces: SewerPiece[]; trenches: Trench[]; boxes: SunkBox[] } {
  const footprint = houseFootprint(routingPlanOf(plan))
  const kerb = (plan.lot?.rect?.[1] ?? footprint[1] - 1.5) - PUBLIC_SIDEWALK
  const pieces: SewerPiece[] = [], trenches: Trench[] = [], boxes: SunkBox[] = []
  for (const d of drains) {
    const run: RoutePoint[] = [[d.x, -RAIN.cover, d.z], [d.x, -RAIN.cover - RAIN.fall * Math.max(0, d.z - kerb), kerb]]
    pieces.push({ points: run, bore: RAIN.bore })
    trenches.push(trenchAlong(run[0]!, run[1]!, TRENCH.width / 2, RAIN.bore / 2 + TRENCH.bed))
    boxes.push({ u: d.x, v: d.z, size: SAND_BOX.side, bottom: -SAND_BOX.depth, yard: false, lid: false })
  }
  return { pieces, trenches, boxes }
}

/** The sewer runs of the plan's drains: each fixture down into the ground, a branch with its fall to the collector, the collector to the street. */
function sewerLayout(plan: HouseRecord, drains: readonly Drain[]): { pieces: SewerPiece[]; trenches: Trench[]; boxes: SunkBox[] } {
  const footprint = houseFootprint(routingPlanOf(plan))
  const main = drains.find((d) => d.kind === 'flush') ?? drains[0]!
  const collectorU = main.u
  const frontV = Math.min(footprint[1] - 1.2, (plan.lot?.rect?.[1] ?? footprint[1] - 1.8) + 0.6)
  const pieces: SewerPiece[] = []
  const trenches: Trench[] = []
  const boxes: SunkBox[] = []
  const w = TRENCH.width / 2
  const start = BURIED_Y + 0.1
  let deepest = start
  let farV = -Infinity
  for (const d of drains) {
    const length = Math.abs(d.u - collectorU)
    const end = start - FALL.branch * length
    deepest = Math.min(deepest, end)
    const branch: RoutePoint[] = [[d.u, RISER_TOP, d.v], [d.u, start, d.v], [collectorU, end, d.v]]
    pieces.push({ points: branch, bore: d.bore })
    trenches.push(trenchAlong(branch[1]!, branch[2]!, w, d.bore / 2 + TRENCH.bed))
    if (d.kind === 'shower' || d.kind === 'tap') boxes.push({ u: d.u, v: d.v, size: 0.25, bottom: start - 0.12, yard: false })
    farV = Math.max(farV, d.v)
  }
  const collectorTop = deepest - 0.02
  const collectorEnd = collectorTop - FALL.main * (farV - frontV)
  const collector: RoutePoint[] = [[collectorU, collectorTop, farV], [collectorU, collectorEnd, frontV]]
  pieces.push({ points: collector, bore: 0.1 })
  trenches.push(trenchAlong(collector[0]!, collector[1]!, w, 0.05 + TRENCH.bed))
  const collectorAt = (v: number): number => collectorTop + ((collectorEnd - collectorTop) * (farV - v)) / (farV - frontV)
  // the building's inspection box where the collector leaves the house, the street's at the front of the lot
  for (const v of [footprint[1] - 0.75, frontV]) boxes.push({ u: collectorU, v, size: 0.6, bottom: collectorAt(v) - 0.12, yard: true })
  return { pieces, trenches, boxes }
}

/** The plan's drains that go to the sewer, with the bore of each. */
function drainsOf(plan: HouseRecord): Drain[] {
  return (plan.utilities?.plumbing?.points ?? []).filter((p) => DRAIN_BORE[p.kind] !== undefined).map((p) => ({ u: p.u, v: p.v, bore: DRAIN_BORE[p.kind]!, kind: p.kind }))
}

/** The sewer's buried stretches (points [u, y, v]): what a feed laid later keeps clear of (`RoutingPlan.buried`). */
export function buriedSewerOf(plan: HouseRecord): { readonly a: RoutePoint; readonly b: RoutePoint }[] {
  const drains = drainsOf(plan)
  if (!drains.length) return []
  return sewerLayout(plan, drains).pieces.flatMap((piece) => piece.points.slice(1).map((b, i) => ({ a: piece.points[i]!, b })))
}

/** The electrical feed's trench (NBR 5410): narrow, its bed a sand layer under the conduit; the warning tape laid in the backfill this far over the conduit. */
const FEED = { width: 0.3, bed: 0.05, tape: { over: 0.3, width: 0.1, thickness: 0.002 }, box: { side: 0.3, floor: 0.1 } } as const

/** The buried stretches of the plan's conduits (plan points [u, v, y]): where each goes along under the ground, and where it comes up into a ground box. */
function feedLayout(plan: HouseRecord): { readonly runs: { readonly a: RoutePoint; readonly b: RoutePoint }[]; readonly trenches: Trench[]; readonly boxes: SunkBox[] } {
  const conduits = plan.utilities?.electrical?.conduits ?? []
  const runs: { a: RoutePoint; b: RoutePoint }[] = [], trenches: Trench[] = [], boxes: SunkBox[] = []
  const seen = new Set<string>()
  for (const c of conduits) {
    const points = c.points.map((p): RoutePoint => [p[0]!, p[2]!, p[1]!])
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i]!, b = points[i + 1]!
      if (a[1] <= FEED_Y + 1e-6 && b[1] <= FEED_Y + 1e-6) {
        runs.push({ a, b })
        trenches.push(trenchAlong(a, b, FEED.width / 2, FEED.bed))
        continue
      }
      // where it goes down from the wall's foot to the feed's depth stands a ground box
      const vertical = Math.hypot(a[0] - b[0], a[2] - b[2]) < 1e-3
      const spans = Math.min(a[1], b[1]) <= FEED_Y + 1e-6 && Math.max(a[1], b[1]) >= FEED_EXIT_Y - 1e-6
      const key = `${a[0].toFixed(3)}:${a[2].toFixed(3)}`
      if (!vertical || !spans || seen.has(key)) continue
      seen.add(key)
      boxes.push({ u: a[0], v: a[2], size: FEED.box.side, bottom: FEED_Y - FEED.box.floor, yard: true })
    }
  }
  return { runs, trenches, boxes }
}

/** The warning tape over a buried feed, laid in the backfill: a strip along each run. */
function addWarningTape(THREE: Three, parent: THREE_NS.Group, runs: readonly { readonly a: RoutePoint; readonly b: RoutePoint }[]): void {
  const tape = new BoxBatch()
  const { over, width, thickness } = FEED.tape
  for (const { a, b } of runs) {
    const y = Math.max(a[1], b[1]) + over
    const alongX = Math.abs(b[0] - a[0]) >= Math.abs(b[2] - a[2])
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[2], b[2]), z1 = Math.max(a[2], b[2])
    tape.add(alongX ? [x0, y, (z0 + z1) / 2 - width / 2, x1, y + thickness, (z0 + z1) / 2 + width / 2] : [(x0 + x1) / 2 - width / 2, y, z0, (x0 + x1) / 2 + width / 2, y + thickness, z1])
  }
  const mesh = tape.mesh(THREE, new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.7 }), 'feed:warning_tape')
  if (mesh) parent.add(mesh)
}

/**
 * The rough-in stage the finished house does not draw: the sewer, laid in its open trenches under the ground (the water and the conduits are the house's own
 * runs, cut into the bare masonry at this stage and embedded later; see `installation-routes`).
 */
export function buildInstallationsStage(THREE: Three, plan: HouseRecord, rain: readonly RainDrain[] = []): THREE_NS.Group {
  const group = new THREE.Group()
  group.name = 'stage:4:installations'
  const drains = drainsOf(plan)
  const feeds = feedLayout(plan)
  if (!drains.length && !rain.length && !feeds.runs.length) return group
  const mats = {
    pipe: new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.65 }),
    rain: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.6 }),
    // loose earth, the colour of the soil the trench is dug in, a shade lighter (dry, broken up)
    heap: new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x7c7f82, roughness: 0.9 }),
    lid: new THREE.MeshStandardMaterial({ color: 0x8d8f91, roughness: 0.92 }),
  }
  const layout = drains.length ? sewerLayout(plan, drains) : { pieces: [], trenches: [], boxes: [] }
  const rainwater = rainLayout(plan, rain)
  const boxes = [...layout.boxes, ...rainwater.boxes, ...feeds.boxes]
  const parts = (plan as { structure?: { parts?: readonly { id: string; beamKind?: string; aabb: readonly number[] }[] } }).structure?.parts ?? []
  const solids = parts.filter((p) => p.beamKind === 'ground_beam' || /^(ground_beam_|footing_pier_)/.test(p.id)).map((p) => p.aabb as unknown as Rect)
  // the electrical feed has a trench of its own, apart from the sewer's and the rain's
  const dug = [...layout.trenches, ...rainwater.trenches, ...feeds.trenches, ...boxes.map(pitOf)]
  addSpoil(THREE, group, dug, mats.heap, { solids, footprint: houseFootprint(routingPlanOf(plan)) as Rect, buildings: (plan.outbuildings ?? []).map((o) => o.aabb as unknown as Rect) })
  // the trenches and pits themselves are the ground's: the house hands them to the host's terrain (`House.excavations`), which digs them for real
  group.userData.excavations = dug.map(excavationOf)
  for (const piece of layout.pieces) addPipe(THREE, group, piece.points, piece.bore / 2, mats.pipe)
  // the rainwater runs apart from the sewer, in a group of its own
  const rainGroup = new THREE.Group()
  rainGroup.name = 'rain_drains'
  for (const piece of rainwater.pieces) addPipe(THREE, rainGroup, piece.points, piece.bore / 2, mats.rain)
  group.add(rainGroup)
  addWarningTape(THREE, group, feeds.runs)
  // the yard's inspection boxes stay once the trench is filled: their lids flush with the ground, from the rough-in to the finished house
  const yard = new THREE.Group()
  yard.name = 'stage:4:sewer_boxes'
  group.userData.yardBoxes = yard
  for (const b of boxes) addSunkBox(THREE, b.yard ? yard : group, b, mats)
  group.userData.sewer = { pieces: layout.pieces, trenches: [...layout.trenches, ...layout.boxes.map(pitOf)].map((t) => t.rect), boxes: layout.boxes }
  group.userData.feeds = { runs: feeds.runs, trenches: [...feeds.trenches, ...feeds.boxes.map(pitOf)].map((t) => t.rect), boxes: feeds.boxes }
  group.userData.rain = { pieces: rainwater.pieces, trenches: [...rainwater.trenches, ...rainwater.boxes.map(pitOf)].map((t) => t.rect), boxes: rainwater.boxes }
  return group
}
