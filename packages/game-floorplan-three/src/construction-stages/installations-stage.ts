import type * as THREE_NS from 'three'

import type { HouseRecord, Three } from '../kernel-types.js'
import { BoxBatch } from './box-batch.js'
import { PUBLIC_SIDEWALK } from '../lot/terrain.js'
import { SAND_BOX } from '../roof/gutters.js'
import { BURIED_Y, houseFootprint, routingPlanOf } from './installation-routes.js'
import type { RoutePoint } from './installation-routes.js'

/** What drains into the sewer, and the bore of its pipe (metres). */
const DRAIN_BORE: Readonly<Record<string, number>> = { flush: 0.1, shower: 0.05, tap: 0.05, tub: 0.05, machine: 0.05 }
/** Fall of a sewer run, metres per metre (NBR 8160: 1 % for 100 mm and up, 2 % under it). */
const FALL = { main: 0.01, branch: 0.02 } as const
const TRENCH = { width: 0.4, bed: 0.03, berm: { width: 0.12, height: 0.065 } } as const
/** A heap of dug earth on the ground: its top and its sides, no face under it (it lies on the ground, and a face there would share the ground's plane). */
function addHeap(batch: BoxBatch, [x0, z0, x1, z1]: Rect, h: number): void {
  batch.addQuad([[x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0]], [0, 1, 0])
  batch.addQuad([[x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0]], [0, 0, -1])
  batch.addQuad([[x1, 0, z1], [x0, 0, z1], [x0, h, z1], [x1, h, z1]], [0, 0, 1])
  batch.addQuad([[x0, 0, z1], [x0, 0, z0], [x0, h, z0], [x0, h, z1]], [-1, 0, 0])
  batch.addQuad([[x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]], [1, 0, 0])
}
/** The excavation's opening is drawn this little over the ground and over the compacted bed under the house. */
const OPENING_Y = 0.045
/** The excavation draws after every opaque thing (it opens what was drawn over it), its pipes and boxes after the excavation. */
// the hole and what is in it draw in the transparent pass, after the ground's own transparent layers (its marks and decals paint over the ground there): the
// opening first, then the earth faces, then the pipes and boxes in it
const ORDER = { opening: 900, earth: 901, inside: 902, lid: 903 } as const
/** The capped end of a fixture's drain waits just under the ground, in its pit, for the floor and the fixture. */
const RISER_TOP = -0.02
/** A box's lid stands this little over the ground: flush to the eye and the foot, never on the ground's plane. */
const LID_TOP = 0.009

type Rect = readonly [number, number, number, number]

interface SewerPiece {
  readonly points: readonly RoutePoint[]
  readonly bore: number
}

/**
 * The opening of an excavation: drawn after everything opaque and after the ground's own layers, where nothing nearer covers it, it marks its pixels in the
 * stencil. The hole's earth faces then draw only on those pixels, whatever the ground's depth there, and leave their own depth for the pipes in the hole.
 */
function openingMaterial(THREE: Three): THREE_NS.Material {
  return new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    depthTest: true,
    transparent: true,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
  })
}

/** The earth faces of the hole: only where the opening marked the stencil, over the ground's depth (each pixel of an open box sees one of its inner faces). */
function earthMaterial(THREE: Three, color: number): THREE_NS.Material {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.98,
    transparent: true,
    depthWrite: true,
    depthFunc: THREE.AlwaysDepth,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.EqualStencilFunc,
    stencilZPass: THREE.KeepStencilOp,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
  })
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
 * An excavation as one open hole in the ground: the union of its rectangles, each drawn as its opening (the depth mask), its floor and the walls of the union's
 * outline, with the dug earth heaped along the rim.
 */
function addExcavation(THREE: Three, parent: THREE_NS.Group, trenches: readonly Trench[], mats: { readonly earth: THREE_NS.Material; readonly heap: THREE_NS.Material }, site: { readonly solids: readonly Rect[]; readonly footprint: Rect }): void {
  const opening = new BoxBatch(), earth = new BoxBatch(), heap = new BoxBatch()
  const rects = trenches.map((t) => t.rect)
  const pits = trenches.filter((t) => t.pit).map((t) => t.rect)
  trenches.forEach(({ rect: r, bed, pit }, i) => {
    opening.add([r[0], OPENING_Y - 0.001, r[1], r[2], OPENING_Y, r[3]])
    // a trench's floor stops at the pits it reaches: the box's pit goes deeper, and a floor across it would cut through the box
    for (const f of pit ? [r] : rectMinus(r, pits)) earth.addQuad([[f[0], bed(f[0], f[1]), f[1]], [f[2], bed(f[2], f[1]), f[1]], [f[2], bed(f[2], f[3]), f[3]], [f[0], bed(f[0], f[3]), f[3]]], [0, 1, 0])
    const others = rects.filter((_, k) => k !== i)
    for (const e of openEdges(r, others, site.solids)) {
      const [ox, oz] = e.out
      // the hole's wall, looking into the hole
      earth.addQuad([[e.a[0], bed(e.a[0], e.a[2]), e.a[2]], [e.b[0], bed(e.b[0], e.b[2]), e.b[2]], [e.b[0], 0, e.b[2]], [e.a[0], 0, e.a[2]]], [-ox, 0, -oz])
      const x0 = Math.min(e.a[0], e.b[0]), x1 = Math.max(e.a[0], e.b[0]), z0 = Math.min(e.a[2], e.b[2]), z1 = Math.max(e.a[2], e.b[2])
      const w = TRENCH.berm.width, h = TRENCH.berm.height
      // the dug earth is heaped along the rim in the yard; inside the house the frame stands where it would go
      const [fx0, fz0, fx1, fz1] = site.footprint
      const inHouse = x1 > fx0 - 0.4 && x0 < fx1 + 0.4 && z1 > fz0 - 0.4 && z0 < fz1 + 0.4
      if (!inHouse) addHeap(heap, ox ? [ox > 0 ? x1 : x0 - w, z0, ox > 0 ? x1 + w : x0, z1] : [x0, oz > 0 ? z1 : z0 - w, x1, oz > 0 ? z1 + w : z0], h)
    }
  })
  const mask = opening.mesh(THREE, openingMaterial(THREE), 'excavation:opening')
  if (mask) {
    mask.renderOrder = ORDER.opening
    mask.castShadow = false
    mask.receiveShadow = false
    parent.add(mask)
  }
  const faces = earth.mesh(THREE, mats.earth, 'excavation:earth')
  if (faces) {
    faces.renderOrder = ORDER.earth
    faces.castShadow = false
    parent.add(faces)
  }
  const mound = heap.mesh(THREE, mats.heap, 'excavation:heap')
  if (mound) parent.add(mound)
}

/** A pipe: a cylinder per straight stretch, a fitting at each bend (an elbow's socket) so the stretches meet. */
function addPipe(THREE: Three, parent: THREE_NS.Group, points: readonly RoutePoint[], radius: number, material: THREE_NS.Material, renderOrder: number): void {
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!, b = points[i + 1]!
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const len = dir.length()
    if (len < 1e-3) continue
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 12), material)
    mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    mesh.quaternion.setFromUnitVectors(up, dir.normalize())
    mesh.renderOrder = renderOrder
    parent.add(mesh)
  }
  for (let i = 1; i + 1 < points.length; i++) {
    const p = points[i]!
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.25, 12, 8), material)
    elbow.position.set(p[0], p[1], p[2])
    elbow.renderOrder = renderOrder
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
  if (mesh) {
    mesh.renderOrder = ORDER.inside
    parent.add(mesh)
  }
  if (box.lid === false) return
  const lid = new BoxBatch()
  lid.add([u - size / 2, top, v - size / 2, u + size / 2, LID_TOP, v + size / 2])
  const cover = lid.mesh(THREE, mats.lid, 'sewer:lid')
  if (cover) {
    // over the trench's open earth, which draws over whatever is in the opening: the lid comes after it
    cover.renderOrder = ORDER.lid
    parent.add(cover)
  }
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
  /** A box's pit: the trenches that reach it have no floor of their own in it. */
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

/**
 * The rough-in stage the finished house does not draw: the sewer, laid in its open trenches under the ground (the water and the conduits are the house's own
 * runs, cut into the bare masonry at this stage and embedded later; see `installation-routes`).
 */
export function buildInstallationsStage(THREE: Three, plan: HouseRecord, rain: readonly RainDrain[] = []): THREE_NS.Group {
  const group = new THREE.Group()
  group.name = 'stage:4:installations'
  const plumbing = plan.utilities?.plumbing
  const drains: Drain[] = (plumbing?.points ?? [])
    .filter((p) => DRAIN_BORE[p.kind] !== undefined)
    .map((p) => ({ u: p.u, v: p.v, bore: DRAIN_BORE[p.kind]!, kind: p.kind }))
  if (!drains.length && !rain.length) return group
  // `transparent` only to draw in the hole's pass (see ORDER): fully opaque, writing depth
  const inHole = { transparent: true, opacity: 1, depthWrite: true } as const
  const mats = {
    pipe: new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.65, ...inHole }),
    rain: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.6, ...inHole }),
    earth: earthMaterial(THREE, 0x3a2716),
    heap: new THREE.MeshStandardMaterial({ color: 0x5a3e24, roughness: 0.95 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x7c7f82, roughness: 0.9, ...inHole }),
    lid: new THREE.MeshStandardMaterial({ color: 0x8d8f91, roughness: 0.92, ...inHole }),
  }
  const layout = drains.length ? sewerLayout(plan, drains) : { pieces: [], trenches: [], boxes: [] }
  const rainwater = rainLayout(plan, rain)
  const boxes = [...layout.boxes, ...rainwater.boxes]
  const parts = (plan as { structure?: { parts?: readonly { id: string; beamKind?: string; aabb: readonly number[] }[] } }).structure?.parts ?? []
  const solids = parts.filter((p) => p.beamKind === 'ground_beam' || /^(ground_beam_|footing_pier_)/.test(p.id)).map((p) => p.aabb as unknown as Rect)
  addExcavation(THREE, group, [...layout.trenches, ...rainwater.trenches, ...boxes.map(pitOf)], mats, { solids, footprint: houseFootprint(routingPlanOf(plan)) as Rect })
  for (const piece of layout.pieces) addPipe(THREE, group, piece.points, piece.bore / 2, mats.pipe, ORDER.inside)
  // the rainwater runs apart from the sewer, in a group of its own
  const rainGroup = new THREE.Group()
  rainGroup.name = 'rain_drains'
  for (const piece of rainwater.pieces) addPipe(THREE, rainGroup, piece.points, piece.bore / 2, mats.rain, ORDER.inside)
  group.add(rainGroup)
  // the yard's inspection boxes stay once the trench is filled: their lids flush with the ground, from the rough-in to the finished house
  const yard = new THREE.Group()
  yard.name = 'stage:4:sewer_boxes'
  group.userData.yardBoxes = yard
  for (const b of boxes) addSunkBox(THREE, b.yard ? yard : group, b, mats)
  group.userData.sewer = { pieces: layout.pieces, trenches: [...layout.trenches, ...layout.boxes.map(pitOf)].map((t) => t.rect), boxes: layout.boxes }
  group.userData.rain = { pieces: rainwater.pieces, trenches: [...rainwater.trenches, ...rainwater.boxes.map(pitOf)].map((t) => t.rect), boxes: rainwater.boxes }
  return group
}
