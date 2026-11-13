import type * as THREE_NS from 'three'
import { getAssembly } from '@adatechnology/game-destruction'
import { PLASTER_PER_FACE, coursingOf, getMasonryUnit } from '@adatechnology/game-floorplan-structure'
import type { StructurePart } from '@adatechnology/game-floorplan-structure'
import type { Three } from '../kernel-types.js'
import { BoxBatch } from './box-batch.js'
import { subtractRects, wallLineOf } from './wall-plane.js'
import type { WallRect } from './wall-plane.js'

export function addStageBox(
  THREE: Three,
  parent: THREE_NS.Group,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  mat: THREE_NS.Material,
  partId?: string,
): void {
  const sx = x1 - x0
  const sy = y1 - y0
  const sz = z1 - z0
  if (sx < 1e-4 || sy < 1e-4 || sz < 1e-4) return
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat)
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (partId) mesh.userData.structurePartId = partId
  parent.add(mesh)
}

/** The batches a masonry stage lays its units into, one per material. */
export type MasonryBatches = Readonly<Record<'brick' | 'block' | 'mortar' | 'wood' | 'log' | 'sheet' | 'drywall', BoxBatch>>

export function createMasonryBatches(): MasonryBatches {
  return { brick: new BoxBatch(), block: new BoxBatch(), mortar: new BoxBatch(), wood: new BoxBatch(), log: new BoxBatch(), sheet: new BoxBatch(), drywall: new BoxBatch() }
}

/** The meshes of the batches, one per material that got any unit, named by the stage and the material. */
export function masonryMeshes(THREE: Three, batches: MasonryBatches, mats: Readonly<Record<string, THREE_NS.Material>>, prefix: string): THREE_NS.Mesh[] {
  const out: THREE_NS.Mesh[] = []
  for (const [key, batch] of Object.entries(batches)) {
    const material = mats[key]
    const mesh = material ? batch.mesh(THREE, material, `${prefix}:${key}`) : null
    if (mesh) out.push(mesh)
  }
  return out
}

/** Running bond: courses counted from `courseBase`, joints at fixed spots along the wall's axis, so the pieces of one wall cut by its pillars and beams line up. */
interface Coursing {
  readonly courseH: number
  readonly unitLen: number
  readonly joint: number
  readonly courseBase: number
}

const MORTAR_INSET = 0.004
const UNIT_CLEARANCE = 0.005
/** The least of a unit laid on its own at a piece's end (a quarter brick): a shorter one goes with its neighbour. */
const MIN_PIECE = 0.06
/** The least stretch of wall worth laying at all. */
const MIN_SPAN = 0.02
/** How far past its own end a wall's masonry runs on to the face of what stands there (a pillar, a wall), metres. */
const BUTT_REACH = 0.03
/** How deep the render that wraps a wall's end over the corner pillar reaches into the wall's box, metres (no masonry in it). */
const END_RENDER = 0.02
/** How far a mortar fill stays off the faces round it, metres. */
const SLIVER_CLEAR = 0.0005
// the mortar bed stands a hair over what the wall rests on (a slab, a beam): its faces never lie on a pillar's foot or head
const MORTAR_LIFT = 0.009

function layUnits(rect: WallRect, coursing: Coursing, put: (a0: number, y0: number, a1: number, y1: number) => void): void {
  const { courseH, unitLen, joint, courseBase } = coursing
  const first = Math.floor((rect.y0 - courseBase) / courseH + 1e-6)
  for (let row = first; courseBase + row * courseH < rect.y1 - 1e-6; row++) {
    const ya = Math.max(rect.y0 + UNIT_CLEARANCE, courseBase + row * courseH + joint / 2)
    const yb = Math.min(rect.y1 - UNIT_CLEARANCE, courseBase + (row + 1) * courseH - joint / 2)
    if (yb - ya < 0.01) continue
    const offset = (((row % 2) + 2) % 2) * ((unitLen + joint) / 2)
    const pitch = unitLen + joint
    const units: [number, number][] = []
    for (let k = Math.floor((rect.a0 + offset) / pitch) - 1; k * pitch - offset < rect.a1; k++) {
      const s = k * pitch - offset
      const b0 = Math.max(rect.a0, s + joint / 2), b1 = Math.min(rect.a1, s + pitch - joint / 2)
      if (b1 - b0 > 1e-4) units.push([b0, b1])
    }
    if (!units.length) continue
    // the units at the piece's ends butt against what cuts it (a pillar, a jamb): the first and last run to it in every course, with no open joint
    // beside it, and a sliver of a unit is laid as part of its neighbour, never as a gap
    units[0]![0] = rect.a0
    units[units.length - 1]![1] = rect.a1
    if (units.length > 1 && units[0]![1] - units[0]![0] < MIN_PIECE) units.splice(0, 2, [rect.a0, units[1]![1]])
    if (units.length > 1 && units[units.length - 1]![1] - units[units.length - 1]![0] < MIN_PIECE) units.splice(units.length - 2, 2, [units[units.length - 2]![0], rect.a1])
    for (const [b0, b1] of units) put(b0, ya, b1, yb)
  }
}

/**
 * How wide a wall's bricks or blocks are across it: the unit of the catalog the wall is laid with, never wider than the wall less its render each side. A wall
 * drawn thicker than its units (an 18 cm wall of 14 cm blocks) takes the difference in render, not in fatter bricks.
 */
export function coreWidthOf(thickness: number, unitId?: string): number {
  const room = Math.max(0.09, thickness - 2 * PLASTER_PER_FACE)
  return unitId === undefined ? room : Math.min(room, getMasonryUnit(unitId).width)
}

/** Where and how one wall part is laid: what cuts it, the courses' base, the unit, and the centre line of its core when it is not the box's own. */
export interface MasonryLayout {
  /** What the wall's pillars, beams, lintels, foundation and the walls laid before it take out of it, in its plane. */
  readonly cuts: readonly WallRect[]
  readonly courseBase: number
  readonly unitId?: string | undefined
  /**
   * The centre line of the bricks across the wall: the line of the pillars standing in it (they are cast in the units' form). The structure keeps boxes to the
   * centimetre, so a 17 cm wall's box stands 5 mm off that line.
   */
  readonly coreLine?: number | undefined
  /** The chases cut in the wall's face for the runs embedded in it (a conduit, a pipe): the units there are laid thinner on that face by the chase's depth. */
  readonly chases?: readonly Chase[] | undefined
}

/**
 * A chase cut in one face of a wall for a run going up or down it, in the wall's plane: where along and how high, on which face (+1 the high side), and its
 * bottom (`back`: how far from the core's centre line the cut stops). Every layer laid there (units, the mortar behind them) is cut to it.
 */
export interface Chase {
  readonly a0: number
  readonly a1: number
  readonly y0: number
  readonly y1: number
  readonly side: 1 | -1
  readonly back: number
}

/**
 * How thick the mortar behind the units is, as a share of their width: thin enough that the bottom of a chase cut for a run in the wall never reaches it (a
 * 20 mm conduit or a 25 mm pipe set 14 mm under the face of a 14 cm unit leaves 5.5 cm of it to the centre line, the mortar 5.04).
 */
const MORTAR_BACKING = 0.72
/** How far inside a chase's edges the mortar is cut, metres: clear of the units' ends at the chase's edge (the side of a box 3 mm in from it faces the other way). */
const MORTAR_CHASE_INSET = 0.004
/** The mortar is cut only by a chase this much deeper than its face (a box): a run's shallow chase stops at it, as it always has. */
const DEEP_CHASE = 0.01
/** How far a chase's bottom keeps from the plane of the mortar behind the units, metres. */
const CHASE_CLEAR_OF_MORTAR = 0.005

/**
 * The bare wall of a structural part, laid unit by unit into the batches, in the pieces that are left once its pillars, beams, lintels, foundation and the walls
 * laid before it are taken out (`cuts`, in the wall's plane): the masonry fills the frame, it never runs through it.
 */
/**
 * Lays one wall part and returns the stretches it filled (its pieces and the slivers filled with mortar, in the wall's plane): what the next walls butt against,
 * the bricks as they are laid rather than the wall's box (a pillar may have taken part of it).
 */
export function buildMasonryPanel(batches: MasonryBatches, part: StructurePart, layout: MasonryLayout): readonly WallRect[] {
  const { cuts, courseBase, unitId } = layout
  const wall = { ...wallLineOf(part.aabb), ...(layout.coreLine === undefined ? {} : { line: layout.coreLine }) }
  const th = wall.thickness
  // the masonry runs on to what stands at its ends (a pillar a little narrower than the crossing wall, a wall already laid): each end reaches the face of a cut
  // up to `BUTT_REACH` past it; where nothing stands there, the wall keeps its own end
  const all = subtractRects({ a0: wall.a0 - BUTT_REACH, a1: wall.a1 + BUTT_REACH, y0: part.y0, y1: part.y1 }, cuts)
    .map((r) => ({ ...r, a0: r.a0 <= wall.a0 - BUTT_REACH + 1e-6 ? wall.a0 : r.a0, a1: r.a1 >= wall.a1 + BUTT_REACH - 1e-6 ? wall.a1 : r.a1 }))
    .filter((r) => r.a1 > r.a0 && r.y1 - r.y0 >= MIN_SPAN)
  const pieces = all.filter((r) => r.a1 - r.a0 >= MIN_SPAN)
  // a sliver beside a piece of the same courses (the subtraction cuts the free stretch where a lower cut ends, a ground beam's end) is that piece's: its units run
  // on over it to the pillar; a sliver with no piece beside it (between two cuts) is filled with mortar to their faces, never left open from the floor to the beam
  // (the fill stops a hair short of the faces round it, so it shares no plane with the concrete)
  // a sliver at the wall's very end lies past the pillar's outer face, in the render that wraps the corner: no masonry there
  const atEnd = (r: WallRect): boolean => r.a1 <= wall.a0 + END_RENDER || r.a0 >= wall.a1 - END_RENDER
  const slivers = all.filter((r) => r.a1 - r.a0 < MIN_SPAN && r.a1 - r.a0 > 2 * SLIVER_CLEAR && !atEnd(r)).filter((s) => {
    const beside = pieces.find((p) => (Math.abs(p.a0 - s.a1) < 1e-6 || Math.abs(p.a1 - s.a0) < 1e-6) && p.y0 >= s.y0 - 1e-6 && p.y1 <= s.y1 + 1e-6)
    if (!beside) return true
    if (Math.abs(beside.a0 - s.a1) < 1e-6) beside.a0 = s.a0
    else beside.a1 = s.a1
    return false
  })
  const laidRects: readonly WallRect[] = [...pieces, ...slivers]
  const box = (batch: BoxBatch, a0: number, y0: number, a1: number, y1: number, t: number, shift = 0): void =>
    batch.add(wall.alongU ? [a0, y0, wall.line + shift - t / 2, a1, y1, wall.line + shift + t / 2] : [wall.line + shift - t / 2, y0, a0, wall.line + shift + t / 2, y1, a1])
  /** A unit laid where the chases cross it thinner on their face, by their depth: the run lies in the cut, never in the brick. */
  const chased = (batch: BoxBatch, a0: number, y0: number, a1: number, y1: number, t: number, inset = 0): void => {
    // a chase cuts a unit only where it reaches into it: its bottom inside the unit's half thickness
    // a chase edge on the end of the mortar behind a wall piece's end unit (`MORTAR_INSET` in from it) would put the unit's split on that plane: the chase
    // grows past it
    const clearOfMortarEnd = (x: number, grow: 1 | -1): number => [a0 + MORTAR_INSET, a1 - MORTAR_INSET].reduce((at, end) => (Math.abs(at - end) < CHASE_CLEAR_OF_MORTAR ? end + grow * CHASE_CLEAR_OF_MORTAR : at), x)
    const crossing = (layout.chases ?? []).map((c) => (inset ? { ...c, a0: c.a0 + inset, a1: c.a1 - inset, y0: c.y0 + inset, y1: c.y1 - inset } : { ...c, a0: clearOfMortarEnd(c.a0, -1), a1: clearOfMortarEnd(c.a1, 1) })).filter((c) => c.a1 > a0 && c.a0 < a1 && c.y1 > y0 && c.y0 < y1 && c.back < t / 2 - (inset ? DEEP_CHASE : 0))
    if (!crossing.length) return box(batch, a0, y0, a1, y1, t)
    const cuts = [...new Set([a0, a1, ...crossing.flatMap((c) => [c.a0, c.a1]).filter((x) => x > a0 && x < a1)])].sort((p, q) => p - q)
    for (let k = 0; k + 1 < cuts.length; k++) {
      const p0 = cuts[k]!, p1 = cuts[k + 1]!, mid = (p0 + p1) / 2
      const here = crossing.filter((c) => c.a0 <= mid && c.a1 >= mid)
      if (!here.length) { box(batch, p0, y0, p1, y1, t); continue }
      // the unit is split at every chase's ends over its height; each band is cut by the deepest chase over it (a box's chase with a run's going up from it)
      const mortar = (coreWidthOf(th, layout.unitId) * MORTAR_BACKING) / 2
      const ys = [...new Set([y0, y1, ...here.flatMap((c) => [Math.max(y0, c.y0), Math.min(y1, c.y1)])])].sort((p, q) => p - q)
      for (let j = 0; j + 1 < ys.length; j++) {
        const q0 = ys[j]!, q1 = ys[j + 1]!
        if (q1 - q0 < 1e-4) continue
        const over = here.filter((c) => q0 >= c.y0 - 1e-6 && q1 <= c.y1 + 1e-6)
        if (!over.length) { box(batch, p0, q0, p1, q1, t); continue }
        const deep = over.reduce((m, c) => (c.back < m.back ? c : m))
        // the chase's bottom never on the plane of the mortar behind the units: near it, the cut goes on past it
        const back = Math.abs(deep.back - mortar) < CHASE_CLEAR_OF_MORTAR ? mortar - CHASE_CLEAR_OF_MORTAR : deep.back
        const depth = t / 2 - (back - inset) // the mortar a little deeper than the units: its bottom never on theirs
        box(batch, p0, q0, p1, q1, t - depth, -deep.side * depth / 2)
      }
    }
  }

  const asm = part.assembly ? getAssembly(part.assembly) : undefined
  if (part.assembly === 'wood_frame_wall' || part.material === 'wood_soft') {
    const studW = 0.045
    const spacing = (asm as { studs?: { spacing?: number } } | undefined)?.studs?.spacing ?? 0.4
    for (const r of pieces) {
      box(batches.wood, r.a0, r.y0, r.a1, Math.min(r.y1, r.y0 + 0.045), th * 0.9)
      box(batches.wood, r.a0, Math.max(r.y0, r.y1 - 0.045), r.a1, r.y1, th * 0.9)
      const n = Math.max(1, Math.round((r.a1 - r.a0) / spacing))
      for (let i = 0; i <= n; i++) {
        const s = r.a0 + ((r.a1 - r.a0 - studW) * i) / n
        box(batches.wood, s, r.y0 + 0.045, s + studW, r.y1 - 0.045, th * 0.9)
      }
    }
    return laidRects
  }
  if (part.assembly === 'log_wall') {
    const logD = 0.16
    for (const r of pieces) for (let y = r.y0; y < r.y1 - 1e-3; y += logD) box(batches.log, r.a0, y + 0.004, r.a1, Math.min(r.y1, y + logD - 0.004), th * 0.96)
    return laidRects
  }
  if (part.assembly === 'sheet_metal_shack' || part.material === 'steel') {
    for (const r of pieces) box(batches.sheet, r.a0, r.y0, r.a1, r.y1, Math.min(th, 0.025))
    return laidRects
  }
  if (part.assembly === 'drywall' || part.material === 'gypsum') {
    for (const r of pieces) box(batches.drywall, r.a0, r.y0, r.a1, r.y1, th * 0.85)
    return laidRects
  }

  const isBlock = part.assembly === 'concrete_block_wall' || part.material === 'concrete'
  // the bricks of a bare wall: the units of the catalog, within the finished wall less its render each side (`coreWidthOf`), the width of the bond beam and
  // lintels cast in it
  const coreTh = coreWidthOf(th, unitId)
  // a sliver is cut by the chases that cross it as a unit is (a box set in the wall beside a pillar), a little inside their edges: its ends never on the units'
  for (const r of slivers) chased(batches.mortar, r.a0 + SLIVER_CLEAR, r.y0 + SLIVER_CLEAR, r.a1 - SLIVER_CLEAR, r.y1 - SLIVER_CLEAR, coreTh * 0.98, MORTAR_CHASE_INSET)
  // laid as the structure lays it (`coursingOf`: the unit of the catalog, else the units of the wall's assembly the world breaks it into)
  const laid = coursingOf(unitId, getAssembly(part.assembly ?? (isBlock ? 'concrete_block_wall' : 'brick_wall_plastered'))?.units)!
  const coursing: Coursing = { courseH: laid.courseHeight, unitLen: laid.unitLength, joint: 0.012, courseBase }
  const unit = isBlock ? batches.block : batches.brick
  for (const r of pieces) {
    // the mortar behind the units shows in every joint; it is thinner than the units, so no face of it lies on theirs
    // inset from the piece's edges too: the units are cut flush with a jamb or a pillar, the mortar stays a little behind them
    box(batches.mortar, r.a0 + MORTAR_INSET, r.y0 + MORTAR_LIFT, r.a1 - MORTAR_INSET, r.y1 - MORTAR_LIFT, coreTh * MORTAR_BACKING)
    layUnits(r, coursing, (a0, y0, a1, y1) => chased(unit, a0, y0, a1, y1, coreTh))
  }
  return laidRects
}
