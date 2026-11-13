import type * as THREE_NS from 'three'

import type { Aabb } from '../house/solids.js'
import type { RoofRect, Three } from '../kernel-types.js'
import { EAVE } from '../roof/eave.js'
import { BoxBatch } from './box-batch.js'

/** The timber of a tiled roof, top faces measured down from the tile plane (the clay tiles wave 3.2 cm around it). */
const TIMBER = {
  batten: { top: 0.04, width: 0.05, height: 0.012, spacing: 0.35 },
  rafter: { top: 0.065, width: 0.05, height: 0.06, spacing: 0.5 },
  purlin: { top: 0.125, width: 0.06, height: 0.12 },
  hip: { top: 0.065, width: 0.06, height: 0.14 },
  post: { side: 0.07, spacing: 2 },
} as const

type Vec = readonly [number, number, number]

/** Every piece stops this short of the tiles' edge (eave, gable verge, hip): the frame never shows past the cover. */
const EDGE = 0.04

/** A timber between two points of its top edge, `width` across and `height` down from it, its sides plumb. */
function addTimber(batch: BoxBatch, top0: Vec, top1: Vec, width: number, height: number): void {
  const dx = top1[0] - top0[0], dz = top1[2] - top0[2]
  const flat = Math.hypot(dx, dz)
  if (flat < 1e-4 && Math.abs(top1[1] - top0[1]) < 1e-4) return
  const sx = flat < 1e-4 ? width / 2 : (-dz / flat) * (width / 2)
  const sz = flat < 1e-4 ? 0 : (dx / flat) * (width / 2)
  const corner = (p: Vec, side: number, down: number): Vec => [p[0] + sx * side, p[1] - down, p[2] + sz * side]
  batch.addHexahedron([
    corner(top0, -1, height), corner(top0, 1, height), corner(top0, 1, 0), corner(top0, -1, 0),
    corner(top1, -1, height), corner(top1, 1, height), corner(top1, 1, 0), corner(top1, -1, 0),
  ])
}

/** Metres a timber stops short of what stands in the attic (the water tank): it is cut there, never run through it. */
const KEEP_OUT_GAP = 0.03

/**
 * The stretches of a timber's top edge from `top0` to `top1` (as fractions 0..1) that stay clear of the boxes in `keepOut`: the timber, `width` across and
 * `height` deep, is cut `KEEP_OUT_GAP` short of each box it would pass through.
 */
function clearStretches(top0: Vec, top1: Vec, width: number, height: number, keepOut: readonly Aabb[]): Array<readonly [number, number]> {
  let stretches: Array<readonly [number, number]> = [[0, 1]]
  const pad = width / 2 + KEEP_OUT_GAP
  for (const box of keepOut) {
    // the fractions where the top edge is inside the box grown by the timber's half width (sideways) and its depth (the timber hangs under its top edge)
    const lo = [box[0] - pad, box[1] - KEEP_OUT_GAP, box[2] - pad], hi = [box[3] + pad, box[4] + height + KEEP_OUT_GAP, box[5] + pad]
    let f0 = 0, f1 = 1
    for (let axis = 0; axis < 3 && f0 <= f1; axis++) {
      const d = top1[axis]! - top0[axis]!
      if (Math.abs(d) < 1e-9) { if (top0[axis]! < lo[axis]! || top0[axis]! > hi[axis]!) f1 = -1; continue }
      const a = (lo[axis]! - top0[axis]!) / d, b = (hi[axis]! - top0[axis]!) / d
      f0 = Math.max(f0, Math.min(a, b)); f1 = Math.min(f1, Math.max(a, b))
    }
    if (f0 > f1) continue
    stretches = stretches.flatMap(([s0, s1]): Array<readonly [number, number]> => (f1 <= s0 || f0 >= s1 ? [[s0, s1]] : [[s0, Math.min(s1, f0)] as const, [Math.max(s0, f1), s1] as const].filter(([u, v]) => v - u > 1e-6)))
  }
  return stretches
}

const along = (p0: Vec, p1: Vec, f: number): Vec => [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, p0[2] + (p1[2] - p0[2]) * f]

/** `addTimber` cut around what stands in the attic; `onCut` gets each end the cut made (where a purlin needs a post under it). */
function addTimberAround(batch: BoxBatch, top0: Vec, top1: Vec, width: number, height: number, keepOut: readonly Aabb[], onCut?: (end: Vec) => void): void {
  if (!keepOut.length) { addTimber(batch, top0, top1, width, height); return }
  const length = Math.hypot(top1[0] - top0[0], top1[1] - top0[1], top1[2] - top0[2])
  for (const [f0, f1] of clearStretches(top0, top1, width, height, keepOut)) {
    if ((f1 - f0) * length < 0.05) continue
    addTimber(batch, along(top0, top1, f0), along(top0, top1, f1), width, height)
    // (the post under a cut end stands inside the timber's end, not past it)
    const inset = TIMBER.post.side / 2 / Math.max(length, 1e-6)
    if (f0 > 0) onCut?.(along(top0, top1, Math.min(f1, f0 + inset)))
    if (f1 < 1) onCut?.(along(top0, top1, Math.max(f0, f1 - inset)))
  }
}

/** Whether a post of the frame at (x, z) would stand inside one of the boxes in `keepOut`. */
const postBlocked = (x: number, z: number, keepOut: readonly Aabb[]): boolean => keepOut.some((b) => x > b[0] - TIMBER.post.side / 2 - KEEP_OUT_GAP && x < b[3] + TIMBER.post.side / 2 + KEEP_OUT_GAP && z > b[2] - TIMBER.post.side / 2 - KEEP_OUT_GAP && z < b[5] + TIMBER.post.side / 2 + KEEP_OUT_GAP)

/** A plumb post from `y0` to `y1` at (x, z). */
function addPost(batch: BoxBatch, x: number, z: number, y0: number, y1: number): void {
  const h = TIMBER.post.side / 2
  if (y1 - y0 > 0.02) batch.add([x - h, y0, z - h, x + h, y1, z + h], true) // (its foot on the slab, hidden there)
}

/**
 * One slope of a roof cover, in its own terms: `s` runs from the eave up the slope (to `run`, the ridge), `t` along the eave (from `t0` to `t1`). A hipped slope
 * narrows by `s` at both ends (its hips); a gable slope keeps its width.
 */
interface Slope {
  readonly point: (s: number, t: number) => Vec
  readonly t0: number
  readonly t1: number
  readonly run: number
  readonly hipped: boolean
  /** How far up the slope the wall stands (the eave's overhang). */
  readonly wall: number
}

/** The four (hipped) or two (gable) slopes of a roof rectangle, as the renderer draws its tiles. */
function slopesOf(rect: Required<Pick<RoofRect, 'yb' | 'tp' | 'exterior' | 'rm' | 'alongX' | 'r'>> & { readonly gable: boolean }): Slope[] {
  const [x0, z0, x1, z1] = rect.exterior
  const { yb, tp, rm } = rect
  const height = (s: number): number => yb + tp * s
  const wallRun = (edge: number, wallEdge: number): number => Math.abs(wallEdge - edge)
  const [X0, Z0, X1, Z1] = rect.r
  const slopes: Slope[] = []
  const alongX = rect.alongX
  // slopes whose eave runs along x (they rise along z), then the ones whose eave runs along z
  const zSlopes = alongX || !rect.gable
  const xSlopes = !alongX || !rect.gable
  if (zSlopes) {
    slopes.push({ point: (s, t) => [t, height(s), z0 + s], t0: x0, t1: x1, run: rm, hipped: !rect.gable, wall: wallRun(z0, Z0) })
    slopes.push({ point: (s, t) => [t, height(s), z1 - s], t0: x0, t1: x1, run: rm, hipped: !rect.gable, wall: wallRun(z1, Z1) })
  }
  if (xSlopes) {
    slopes.push({ point: (s, t) => [x0 + s, height(s), t], t0: z0, t1: z1, run: rm, hipped: !rect.gable, wall: wallRun(x0, X0) })
    slopes.push({ point: (s, t) => [x1 - s, height(s), t], t0: z0, t1: z1, run: rm, hipped: !rect.gable, wall: wallRun(x1, X1) })
  }
  return slopes
}

const down = (p: Vec, by: number): Vec => [p[0], p[1] - by, p[2]]

/** Metres a timber's side keeps from the face of a solid of the house it runs past (a slab's edge and its render), and the step it moves by to get there. */
const SIDE_CLEAR = 0.002, SIDE_STEP = 0.003

/**
 * Where along the eave a timber of `width` between `a` and `b` (its top edge) stands so that neither side lies on the plane of a face of the house's solids it
 * passes (`solids`, boxes in the house's frame): `t` moved a few millimetres off such a plane.
 */
function clearOfSolids(t: number, width: number, a: Vec, b: Vec, axis: 0 | 2, solids: readonly Aabb[]): number {
  const other = axis === 0 ? 2 : 0, lo = Math.min(a[other], b[other]), hi = Math.max(a[other], b[other]), y0 = Math.min(a[1], b[1]) - 0.2, y1 = Math.max(a[1], b[1])
  for (const box of solids) {
    if (box[other] > hi || box[other + 3] < lo || box[1] > y1 || box[4] < y0 || box[axis] > t + width || box[axis + 3] < t - width) continue
    for (const face of [box[axis], box[axis + 3]]) for (const side of [t - width / 2, t + width / 2]) if (Math.abs(face - side) < SIDE_CLEAR) return t + (side <= face ? -SIDE_STEP : SIDE_STEP)
  }
  return t
}

/** Where the slope is at height `s`: the stretch of its eave line that is still roof (the hips eat `s` at each end of a hipped slope). */
function spanAt(slope: Slope, s: number): readonly [number, number] {
  return slope.hipped ? [slope.t0 + s + EDGE, slope.t1 - s - EDGE] : [slope.t0 + EDGE, slope.t1 - EDGE]
}

/** Slope's timber: battens across the rafters under the tiles, rafters from the eave to the ridge or the hip, purlins and the wall plate under them, posts on the slab. */
function frameSlope(slope: Slope, batches: { readonly timber: BoxBatch; readonly battens: BoxBatch }, slabTop: number, solids: readonly Aabb[], keepOut: readonly Aabb[]): void {
  const { batten, rafter, purlin } = TIMBER
  for (let s = batten.spacing / 2; s < slope.run - 0.12; s += batten.spacing) {
    const [a0, b0] = spanAt(slope, s)
    // a batten stops a little short of the ends of the purlins and the plate, so their end faces never meet
    const a = a0 + 0.015, b = b0 - 0.015
    if (b - a > 0.05) addTimberAround(batches.battens, down(slope.point(s, a), batten.top), down(slope.point(s, b), batten.top), batten.width, batten.height, keepOut)
  }
  const t0 = slope.t0 + EDGE, t1 = slope.t1 - EDGE
  const count = Math.max(1, Math.round((t1 - t0) / rafter.spacing))
  for (let i = 0; i <= count; i++) {
    const at = t0 + ((t1 - t0) * i) / count
    const end = slope.hipped ? Math.min(slope.run, at - slope.t0 - EDGE, slope.t1 - at - EDGE) : slope.run
    if (end < 0.1) continue
    const axis = slope.point(0, 1)[0] - slope.point(0, 0)[0] !== 0 ? 0 : 2
    const t = clearOfSolids(at, rafter.width, down(slope.point(EDGE, at), rafter.top), down(slope.point(end, at), rafter.top), axis, solids)
    addTimberAround(batches.timber, down(slope.point(EDGE, t), rafter.top), down(slope.point(end, t), rafter.top), rafter.width, rafter.height, keepOut)
  }
  // the wall plate (frechal) where the slope crosses the wall, and the purlins (terças) at a third and two thirds of the way to the ridge, each on posts
  const lines = [slope.wall, slope.wall + (slope.run - slope.wall) / 3, slope.wall + ((slope.run - slope.wall) * 2) / 3]
  lines.forEach((s, k) => {
    const [a, b] = spanAt(slope, s)
    if (b - a < 0.1) return
    const top = k === 0 ? rafter.top + rafter.height : purlin.top
    const p0 = down(slope.point(s, a), top), p1 = down(slope.point(s, b), top)
    // (a plate cut short by the slab stops 3 mm over the slab's plane: its bottom lay on the ceiling's)
    const depth = Math.min(purlin.height, p0[1] - slabTop - 0.003)
    if (depth < 0.02) return
    // (a purlin cut around the tank gets a post under each cut end)
    addTimberAround(batches.timber, p0, p1, purlin.width, depth, keepOut, k === 0 ? undefined : (end) => addPost(batches.timber, end[0], end[2], slabTop, end[1] - purlin.height))
    if (k === 0) return
    const posts = Math.max(1, Math.ceil((b - a) / TIMBER.post.spacing))
    for (let j = 0; j <= posts; j++) {
      const p = slope.point(s, a + 0.15 + ((b - a - 0.3) * j) / posts)
      if (!postBlocked(p[0], p[2], keepOut)) addPost(batches.timber, p[0], p[2], slabTop, p[1] - purlin.top - purlin.height)
    }
  })
}

/**
 * The timber frame of the tiled roofs the renderer drew (`shared.ctx.roofRects`): on the ceiling slab, posts carry the purlins and the ridge, the rafters run
 * from the eave to the ridge and the hips, and the battens cross them under the tiles. Every piece lies under the tile planes, so none of it shows through the
 * tiles, and none of it hangs inside the rooms.
 */
export function buildRoofFramingStage(THREE: Three, roofRects: readonly RoofRect[], material?: THREE_NS.Material, solids: readonly Aabb[] = [], keepOut: readonly Aabb[] = []): THREE_NS.Group {
  const group = new THREE.Group()
  group.name = 'stage:7:roof_framing'
  const timber = new BoxBatch(), battens = new BoxBatch()
  for (const rr of roofRects) {
    if (rr.slab || rr.yb === undefined || rr.tp === undefined || !rr.exterior || rr.rm === undefined || rr.alongX === undefined) continue
    const rect = { yb: rr.yb, tp: rr.tp, exterior: rr.exterior, rm: rr.rm, alongX: rr.alongX, r: rr.r, gable: !!rr.gable }
    const slabTop = rr.yb
    for (const slope of slopesOf(rect)) frameSlope(slope, { timber, battens }, slabTop, solids, keepOut)
    // ridge beam (cumeeira) on posts, and the hips (espigões) from each corner of the eave up to the ridge's ends
    const [x0, z0, x1, z1] = rr.exterior
    const ridgeY = rr.yb + rr.tp * rr.rm
    const xm = (x0 + x1) / 2, zm = (z0 + z1) / 2
    const ends: readonly [Vec, Vec] = rr.alongX
      ? [[rr.gable ? x0 + EDGE : x0 + rr.rm, ridgeY, zm], [rr.gable ? x1 - EDGE : x1 - rr.rm, ridgeY, zm]]
      : [[xm, ridgeY, rr.gable ? z0 + EDGE : z0 + rr.rm], [xm, ridgeY, rr.gable ? z1 - EDGE : z1 - rr.rm]]
    const ridgeTop = TIMBER.purlin.top
    addTimberAround(timber, down(ends[0], ridgeTop), down(ends[1], ridgeTop), TIMBER.purlin.width, TIMBER.purlin.height, keepOut, (end) => addPost(timber, end[0], end[2], slabTop, end[1] - TIMBER.purlin.height))
    const along = Math.hypot(ends[1][0] - ends[0][0], ends[1][2] - ends[0][2])
    const posts = Math.max(1, Math.ceil(along / TIMBER.post.spacing))
    for (let j = 0; j <= posts; j++) {
      const f = posts ? j / posts : 0
      const x = ends[0][0] + (ends[1][0] - ends[0][0]) * f, z = ends[0][2] + (ends[1][2] - ends[0][2]) * f
      const [X0, Z0, X1, Z1] = rr.r
      if (x < X0 + 0.1 || x > X1 - 0.1 || z < Z0 + 0.1 || z > Z1 - 0.1 || postBlocked(x, z, keepOut)) continue
      addPost(timber, x, z, slabTop, ridgeY - ridgeTop - TIMBER.purlin.height)
    }
    if (!rr.gable) {
      // the hip starts where its underside clears the soffit (it is deeper than the rafters): its end is cut inside the eave box, never out past the fascia
      // (set back e from both eaves, on the hip line, the tiles are e * tp over the eave)
      const clear = (TIMBER.hip.top + TIMBER.hip.height - EAVE.soffitTop) / Math.max(rr.tp, 1e-3)
      const e = Math.max(EDGE * 1.5, clear), h = rr.yb + rr.tp * e
      const corners: readonly Vec[] = [[x0 + e, h, z0 + e], [x1 - e, h, z0 + e], [x0 + e, h, z1 - e], [x1 - e, h, z1 - e]]
      for (const c of corners) {
        const end = Math.hypot(c[0] - ends[0][0], c[2] - ends[0][2]) <= Math.hypot(c[0] - ends[1][0], c[2] - ends[1][2]) ? ends[0] : ends[1]
        addTimberAround(timber, down(c, TIMBER.hip.top), down(end, TIMBER.hip.top), TIMBER.hip.width, TIMBER.hip.height, keepOut)
      }
    }
  }
  const wood = material ?? new THREE.MeshStandardMaterial({ color: 0xa87e4c, roughness: 0.82 })
  // one wood for every piece: where the covers of two roof rectangles meet at a valley their timbers cross, and the same wood shows the same whichever is drawn
  for (const mesh of [timber.mesh(THREE, wood, 'roof_framing:timber'), battens.mesh(THREE, wood, 'roof_framing:battens')]) if (mesh) group.add(mesh)
  return group
}
