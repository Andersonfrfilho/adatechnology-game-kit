import type { JointKind } from '@adatechnology/game-contracts'

import { densityOf } from '../density'
import { round2, touches } from '../geometry'
import { CONSTRUCTION_SYSTEMS } from '../registry'
import { GROUND } from '../types'
import type { Rect, PlanStructure, StructurePart, Support } from '../types'
import type { PartsAndSupports } from '../wall-detail/apply'
import { layoutPanels, linesOf, runsOf, shareInside } from './layout'
import type { Cut } from './layout'
import { getMasonryUnit, pillarSectionOf } from '../masonry-units'
import { pillarBox } from '../structure/context'
import type { PillarSection } from '../structure/context'
import type { SlabPanelOptions } from './options'

const SLAB_ID = /^slab_(\d+|top.*|ceiling|base)$/
const PLAN_TOLERANCE = 0.05
/** Metres a support may end below the bottom of what it holds and still hold it (walls end under the bond beam, pillars at the slab). */
const BELOW = 0.35
const UP = 0.15
/** A beam needs a support this close to each of its ends. */
const END_REACH = 0.35
const EPS = 1e-6
/** Wall left between a pillar and the end of the wall it stands in, metres. */
const JAMB_CLEAR = 0.02

type Interval = [number, number]

const ceilTo = (value: number, step: number): number => Math.ceil(value / step - 1e-9) * step
const isConcreteSlab = (part: StructurePart, material: string): boolean => part.role === 'slab' && part.material === material && SLAB_ID.test(part.id)
const isBondBeam = (part: StructurePart, material: string): boolean => part.role === 'beam' && part.beamKind === 'bond_beam' && part.material === material

function merged(intervals: readonly Interval[]): Interval[] {
  const out: Interval[] = []
  for (const [a, b] of intervals.slice().sort((x, y) => x[0] - y[0])) {
    const last = out[out.length - 1]
    if (last && a <= last[1] + EPS) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

/**
 * The span the destruction world measures for a beam from `0` to `length` held at `supports`: twice the farthest any point is from its nearest support
 * (two supports `g` apart give `g`; a beam hanging `e` past its last support gives `2e`). `at` is where a new support helps the most.
 */
export function beamSpan(length: number, supports: readonly Interval[]): { span: number; at: number; lo: number; hi: number } {
  const gaps = gapsOf(length, supports)
  if (!gaps.length) return { span: 0, at: length / 2, lo: 0, hi: length }
  return gaps.reduce((a, b) => (b.span > a.span ? b : a))
}

/** Every stretch of the beam that no support holds, with the span it makes (a hanging end counts twice its length) and its middle (`at`). */
function gapsOf(length: number, supports: readonly Interval[]): Array<{ span: number; at: number; lo: number; hi: number }> {
  const held = merged(supports.map(([a, b]): Interval => [Math.max(0, a), Math.min(length, b)]).filter(([a, b]) => b > a))
  if (!held.length) return [{ span: Infinity, at: length / 2, lo: 0, hi: length }]
  const out: Array<{ span: number; at: number; lo: number; hi: number }> = []
  const lead = held[0]![0]
  if (lead > 0) out.push({ span: 2 * lead, at: 0, lo: 0, hi: lead })
  const trail = length - held[held.length - 1]![1]
  if (trail > 0) out.push({ span: 2 * trail, at: length, lo: length - trail, hi: length })
  for (let k = 1; k < held.length; k++) {
    const lo = held[k - 1]![1]
    const hi = held[k]![0]
    if (hi > lo) out.push({ span: hi - lo, at: (lo + hi) / 2, lo, hi })
  }
  return out
}

/** A beam as a line in the plan: it runs along `dir` at the coordinate `at` of the other axis, from `from` to `to`. */
interface Line {
  dir: 'u' | 'v'
  at: number
  from: number
  to: number
}

const lineOf = (aabb: Rect, dir: 'u' | 'v'): Line => (dir === 'u' ? { dir, at: (aabb[1] + aabb[3]) / 2, from: aabb[0], to: aabb[2] } : { dir, at: (aabb[0] + aabb[2]) / 2, from: aabb[1], to: aabb[3] })
const pointOf = (line: Line, s: number): [number, number] => (line.dir === 'u' ? [line.from + s, line.at] : [line.at, line.from + s])

/** Where `box` holds a beam of `line` and `width`: the stretch of the beam (from its start), or undefined when it does not touch. */
function holds(line: Line, width: number, box: Rect): Interval | undefined {
  const [across0, across1, along0, along1] = line.dir === 'u' ? [box[1], box[3], box[0], box[2]] : [box[0], box[2], box[1], box[3]]
  if (across0 >= line.at + width / 2 + PLAN_TOLERANCE || across1 <= line.at - width / 2 - PLAN_TOLERANCE) return undefined
  const a = Math.max(along0 - PLAN_TOLERANCE, line.from)
  const b = Math.min(along1 + PLAN_TOLERANCE, line.to)
  return b > a ? [a - line.from, b - line.from] : undefined
}

/** What can hold a beam from below: a pillar or a bearing wall, with how many steps it is from the ground (the destruction world only rests a part on the nearest-to-ground of its supports). */
interface Prop {
  box: Rect
  dist: number
  part?: StructurePart
}

interface Spot {
  u: number
  v: number
  /** The pillar's long side runs along u (in a wall along u), else along v. */
  alongU?: boolean
}

interface Context {
  structure: PlanStructure
  options: SlabPanelOptions
  beamMaterial: string
  pillarMaterial: string
  joint: JointKind
  wallThickness: number
  parts: StructurePart[]
  supports: Support[]
  panelsOf: Map<string, StructurePart[]>
  pillars: number
  groundBase: string
  /** Section of the pillars it adds: the walls' masonry unit's, else `columnSide` square. */
  section: PillarSection
  /** The distances of the last call to `distancesOf`, kept while no part or support is added (a tower asks for them once per bond beam and per slab). */
  distCache?: { parts: number; supports: number; map: Map<string, number> }
}

const boxOfSpot = (spot: Spot, section: PillarSection): Rect => pillarBox(section, spot.u, spot.v, spot.alongU ?? true)

/** Steps from the ground of every part, the way the destruction world counts them: through the supports that carry, and not through a partition. */
function distancesOf(context: Context): Map<string, number> {
  const cache = context.distCache
  if (cache && cache.parts === context.parts.length && cache.supports === context.supports.length) return cache.map
  const map = distances(context.parts, context.supports)
  context.distCache = { parts: context.parts.length, supports: context.supports.length, map }
  return map
}

function distances(parts: readonly StructurePart[], supports: readonly Support[]): Map<string, number> {
  const byId = new Map(parts.map((p) => [p.id, p]))
  const carrying = new Map<string, string[]>()
  for (const s of supports) {
    if (s.bears === false || !byId.has(s.part) || (s.on !== GROUND && !byId.has(s.on))) continue
    const list = carrying.get(s.on)
    if (list) list.push(s.part)
    else carrying.set(s.on, [s.part])
  }
  const dist = new Map<string, number>([[GROUND, 0]])
  const queue = [GROUND]
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]!
    if (current !== GROUND && byId.get(current)?.role === 'partition') continue
    for (const above of carrying.get(current) ?? []) {
      if (dist.has(above) || byId.get(above)?.role === 'none') continue
      dist.set(above, dist.get(current)! + 1)
      queue.push(above)
    }
  }
  return dist
}

/** Pillars and bearing walls that end where `y0` is (under a beam or a bond beam at that height). */
function propsUnder(context: Context, dist: ReadonlyMap<string, number>, y0: number, y1: number, floor: number): Prop[] {
  return context.parts
    .filter((q) => (q.role === 'column' || q.role === 'wall') && q.floor === floor && dist.has(q.id) && q.y0 < y0 - PLAN_TOLERANCE && q.y1 >= y0 - BELOW && q.y1 <= y1 + UP)
    .map((q) => ({ box: q.aabb, dist: dist.get(q.id)!, part: q }))
}

/** What holds the beam: of the props that touch it only the ones nearest to the ground do (the world rests a part on those). */
function heldBy(line: Line, width: number, props: readonly Prop[]): { intervals: Interval[]; used: Prop[] } {
  const touching = props.map((prop) => ({ prop, interval: holds(line, width, prop.box) })).filter((x): x is { prop: Prop; interval: Interval } => x.interval !== undefined)
  if (!touching.length) return { intervals: [], used: [] }
  const nearest = Math.min(...touching.map((x) => x.prop.dist))
  const used = touching.filter((x) => x.prop.dist === nearest)
  return { intervals: used.map((x) => x.interval), used: used.map((x) => x.prop) }
}

/**
 * Finds where a beam (or bond beam) needs pillars so that it never goes more than `maxSpan` without a support (and, for a beam, so that each end is
 * held). `spots` collects the pillars, which then hold the beams after it; `dist` is how far from the ground a pillar is. A pillar between the ends stands
 * only inside `allowed` (the stretches of the beam a wall hides, openings left out): where no wall can take one the beam spans the gap and is made deeper.
 */
function pillarsFor(
  line: Line, width: number, props: readonly Prop[], spots: Array<Spot & { dist: number }>,
  context: { dist: number; options: SlabPanelOptions; section: PillarSection; ends: boolean; allowed: readonly Interval[]; snap: (spot: Spot) => Spot },
): Interval[] {
  const { options, ends, allowed } = context
  const length = line.to - line.from
  const side = context.section.along
  const all = (): Prop[] => [...props, ...spots.map((spot) => ({ box: boxOfSpot(spot, context.section), dist: spot.dist }))]
  const place = (at: number, lo: number, hi: number): number | undefined => {
    let best: number | undefined
    let gap = Infinity
    for (const [a, b] of allowed) {
      const from = Math.max(a + side / 2, lo + 0.2)
      const to = Math.min(b - side / 2, hi - 0.2)
      if (to < from) continue
      const clamped = Math.min(to, Math.max(from, at))
      if (Math.abs(clamped - at) < gap) {
        gap = Math.abs(clamped - at)
        best = clamped
      }
    }
    return best
  }
  let held = heldBy(line, width, all()).intervals
  for (let guard = 0; guard < 64; guard++) {
    let at: number | undefined
    // an end is held by a pillar in the wall within reach of it (beside a window there, not in it), or at the end itself where no wall is
    if (ends && !held.some(([a]) => a <= END_REACH)) at = place(0, -0.2, END_REACH + 0.2) ?? 0
    else if (ends && !held.some(([, b]) => b >= length - END_REACH)) at = place(length, length - END_REACH - 0.2, length + 0.2) ?? length
    else {
      const wide = gapsOf(length, held).filter((g) => g.span > options.maxSpan + 1e-3).sort((a, b) => b.span - a.span)
      for (const g of wide) {
        at = place(g.at, g.lo, g.hi)
        if (at !== undefined) break
      }
      if (at === undefined) break
    }
    const [u, v] = pointOf(line, at)
    const spot = { ...context.snap({ u: round2(u), v: round2(v), alongU: line.dir === 'u' }), dist: context.dist }
    if (spots.some((other) => Math.hypot(other.u - spot.u, other.v - spot.v) < 0.15)) break
    spots.push(spot)
    held = heldBy(line, width, all()).intervals
  }
  return held
}

/** The stretches of `line` (from its start) that a wall of `floor` hides, with the openings of the walls left out: where a pillar of that storey can stand. */
function wallStretches(context: Context, line: Line, floor: number, top: number): Interval[] {
  const out: Interval[] = []
  for (const wall of context.parts) {
    if ((wall.role !== 'wall' && wall.role !== 'partition') || wall.floor !== floor || wall.y1 < top - 1 || wall.y0 > top) continue
    const padded = holds(line, 0.02, wall.aabb)
    if (!padded) continue
    // `holds` pads the wall by the plan tolerance: a pillar stands in the wall itself, never in the doorway past its end
    // (and a little of the wall is left past the pillar at a jamb: their ends on one plane)
    const along: Interval = [padded[0] + (padded[0] > 0 ? PLAN_TOLERANCE + JAMB_CLEAR : 0), padded[1] - (padded[1] < line.to - line.from ? PLAN_TOLERANCE + JAMB_CLEAR : 0)]
    if (along[1] <= along[0]) continue
    const alongU = wall.aabb[2] - wall.aabb[0] >= wall.aabb[3] - wall.aabb[1]
    const openings = context.structure.openings.filter((o) => o.wall === wall.id)
    if ((line.dir === 'u') === alongU) {
      // the wall runs with the beam: all of it but its openings
      let pieces: Interval[] = [along]
      for (const o of openings) {
        const a = o.from - line.from - JAMB_CLEAR
        const b = o.to - line.from + JAMB_CLEAR
        pieces = pieces.flatMap(([x, y]): Interval[] => (b <= x || a >= y ? [[x, y]] : ([[x, a], [b, y]] as Interval[]).filter(([p, q]) => q > p)))
      }
      out.push(...pieces)
    } else if (!openings.some((o) => line.at > o.from - 0.1 && line.at < o.to + 0.1)) out.push(along)
  }
  // a wall of another storey that rises into this one (the top of a lower wall under a terrace) takes its place: no pillar stands in it
  const bottom = context.structure.levels[floor] ?? 0
  const half = context.section.along / 2
  const taken = context.parts
    .filter((w) => (w.role === 'wall' || w.role === 'partition') && w.floor !== floor && w.y1 > bottom + 0.05 && w.y0 < top - 0.05)
    .map((w) => holds(line, 0.02, w.aabb))
    .filter((x): x is Interval => x !== undefined)
    .map(([a, b]): Interval => [a - half, b + half])
  return taken.reduce((pieces, [a, b]) => pieces.flatMap(([x, y]): Interval[] => (b <= x || a >= y ? [[x, y]] : ([[x, a], [b, y]] as Interval[]).filter(([p, q]) => q > p))), merged(out))
}

/**
 * `spot` on the centre line of the walls of `floor` it stands in (at a junction, of both): a pillar off it shares a face with the wall's beam. Outside any
 * wall it stays as it is.
 */
function snapToWall(context: Context, floor: number, spot: Spot): Spot {
  let { u, v, alongU } = spot
  for (const w of context.parts) {
    if ((w.role !== 'wall' && w.role !== 'partition') || w.floor !== floor) continue
    if (spot.u < w.aabb[0] - PLAN_TOLERANCE || spot.u > w.aabb[2] + PLAN_TOLERANCE || spot.v < w.aabb[1] - PLAN_TOLERANCE || spot.v > w.aabb[3] + PLAN_TOLERANCE) continue
    alongU = w.aabb[2] - w.aabb[0] >= w.aabb[3] - w.aabb[1]
    if (alongU) v = round2((w.aabb[1] + w.aabb[3]) / 2)
    else u = round2((w.aabb[0] + w.aabb[2]) / 2)
  }
  return { u, v, alongU }
}

/** The section of the pillars a slab adds: the one the walls' masonry unit casts (`pillarSectionOf`), else `columnSide` square. */
function sectionOf(structure: PlanStructure, options: SlabPanelOptions): PillarSection {
  const unit = structure.construction.walls.unit
  return typeof unit === 'string' ? pillarSectionOf(getMasonryUnit(unit)) : { across: options.columnSide, along: options.columnSide }
}

/** The parts of `a` that are also in `b`. */
const intersect = (a: readonly Interval[], b: readonly Interval[]): Interval[] =>
  a.flatMap(([x, y]) => b.map(([p, q]): Interval => [Math.max(x, p), Math.min(y, q)])).filter(([x, y]) => y > x)

const make = (draft: Omit<StructurePart, 'mass'>): StructurePart => {
  const [u0, v0, u1, v1] = draft.aabb
  const volume = Math.max(0, (u1 - u0) * (v1 - v0) * (draft.y1 - draft.y0))
  return { ...draft, aabb: draft.aabb.map(round2) as Rect, y0: round2(draft.y0), y1: round2(draft.y1), mass: Math.max(1, Math.round(volume * densityOf(draft.material))) }
}

const rest = (context: Context, on: StructurePart | string, below: StructurePart, joint: JointKind = context.joint): void => {
  context.supports.push({ part: below.id, on: typeof on === 'string' ? on : on.id, joint })
}

const distance = (a: Rect, b: Rect): number => Math.hypot(Math.max(a[0] - b[2], b[0] - a[2], 0), Math.max(a[1] - b[3], b[1] - a[3], 0))

/** The panels of `slab` that `box` touches (the nearest one when none does). */
function panelsUnder(context: Context, slab: string, box: Rect): StructurePart[] {
  const panels = context.panelsOf.get(slab) ?? []
  const touching = panels.filter((panel) => touches(panel.aabb, box, PLAN_TOLERANCE))
  return touching.length ? touching : panels.slice().sort((a, b) => distance(a.aabb, box) - distance(b.aabb, box)).slice(0, 1)
}

/** The pillar at `spot` from `bottom` to `top`, on the ground or on the slab of the storey below. */
function addPillar(context: Context, spot: Spot, bottom: number, top: number, floor: number, below: string | undefined, slab: string): StructurePart {
  const pillar = make({
    id: `pillar_${floor}_${context.pillars++}`, role: 'column', material: context.pillarMaterial, floor, slab, aabb: boxOfSpot(spot, context.section), y0: bottom, y1: top,
  })
  context.parts.push(pillar)
  if (below && context.panelsOf.has(below)) for (const panel of panelsUnder(context, below, pillar.aabb)) rest(context, panel, pillar, 'rebar')
  else rest(context, context.groundBase, pillar, 'rebar')
  return pillar
}

/** The storey under a slab: its floor, the slab it stands on (none: the ground) and the height its pillars start at. */
function storeyUnder(context: Context, slab: StructurePart): { floor: number; below: string | undefined; bottom: number } {
  const levels = context.structure.levels
  const match = /^slab_(\d+)$/.exec(slab.id)
  const floor = match && Number(match[1]) >= 1 ? Number(match[1]) - 1 : slab.id === 'slab_base' ? 0 : slab.floor
  return { floor, below: slab.id === 'slab_base' || floor < 1 ? undefined : `slab_${floor}`, bottom: slab.id === 'slab_base' ? 0 : (levels[floor] ?? 0) }
}

/** Steps from the ground of a pillar that stands under `slab`. */
function pillarDist(context: Context, dist: ReadonlyMap<string, number>, storey: { below: string | undefined }): number {
  if (storey.below && context.panelsOf.has(storey.below)) return Math.min(...context.panelsOf.get(storey.below)!.map((p) => dist.get(p.id) ?? 99)) + 1
  return (dist.get(context.groundBase) ?? 0) + 1
}

/** Where a pillar can stand on the slab `below`: on its beams and on the bond beams at its level. */
function groundOf(context: Context, below: string): Rect[] {
  const panels = context.panelsOf.get(below) ?? []
  const level = panels[0]?.y1
  if (level === undefined) return []
  return context.parts.filter((q) => q.role === 'beam' && (q.slab === below || (q.beamKind === 'bond_beam' && Math.abs(q.y1 - level) < 0.4))).map((q) => q.aabb)
}

/** Thickness of the panels of a slab: what the most demanding of them asks (its short side over the ratio of how it spans), not under the minimum of the use. */
function thicknessOf(leaves: readonly Rect[], roof: boolean, options: SlabPanelOptions): number {
  const asked = Math.max(...leaves.map((leaf) => {
    const short = Math.min(leaf[2] - leaf[0], leaf[3] - leaf[1])
    const long = Math.max(leaf[2] - leaf[0], leaf[3] - leaf[1])
    return short / (long >= 2 * short ? options.oneWayThicknessRatio : options.thicknessRatio)
  }))
  return Math.max(roof ? options.roofMinThickness : options.floorMinThickness, ceilTo(asked, 0.01))
}

const restThickness = (slab: StructurePart, thickness: number, roof: boolean): void => {
  if (roof) slab.y1 = round2(slab.y0 + thickness)
  else slab.y0 = round2(slab.y1 - thickness)
  slab.mass = Math.max(1, Math.round((slab.aabb[2] - slab.aabb[0]) * (slab.aabb[3] - slab.aabb[1]) * (slab.y1 - slab.y0) * densityOf(slab.material)))
}

/** Cuts one slab into panels, adds the beams under their edges and the pillars those need; re-points what rested on the slab. */
function cutSlab(context: Context, slab: StructurePart, wallBoxes: readonly Rect[]): void {
  const { options } = context
  const roof = slab.cover === true
  const layout = layoutPanels(slab.aabb, linesOf(wallBoxes), options)
  const footprint = slab.footprint ?? [slab.aabb]
  const kept = layout.leaves.filter((leaf) => shareInside(leaf, footprint) >= options.footprintShare)
  const leaves = kept.length ? kept : [slab.aabb]
  const thickness = thicknessOf(leaves, roof, options)
  if (leaves.length === 1 && layout.cuts.length === 0) {
    restThickness(slab, thickness, roof)
    context.panelsOf.set(slab.id, [slab])
    return
  }
  const own = context.supports.filter((s) => s.part === slab.id && s.bears !== false)
  const resting = context.supports.filter((s) => s.on === slab.id)
  context.supports = context.supports.filter((s) => s.part !== slab.id && s.on !== slab.id)
  const [y0, y1] = roof ? [slab.y0, slab.y0 + thickness] : [slab.y1 - thickness, slab.y1]
  const panels = leaves.map((leaf, k) =>
    make({
      id: `${slab.id}_p${k}`, role: 'slab', material: slab.material, aabb: leaf, y0, y1, floor: slab.floor, ...(slab.cover ? { cover: true } : {}), slab: slab.id,
      ...(slab.footprint ? { footprint: slab.footprint } : {}),
    }),
  )
  context.parts.splice(context.parts.indexOf(slab), 1, ...panels)
  context.panelsOf.set(slab.id, panels)

  // the beams: under the edges of the panels, on pillars and bearing walls; a bond beam that already runs there is the beam
  const top = roof ? slab.y0 : y0
  const dist = distancesOf(context)
  const storey = storeyUnder(context, slab)
  const props = propsUnder(context, dist, top, slab.y1, storey.floor)
  const near = props.length ? Math.min(...props.map((p) => p.dist)) : pillarDist(context, dist, storey)
  const spots: Array<Spot & { dist: number }> = []
  const bonds = context.parts.filter((q) => q.role === 'beam' && q.beamKind === 'bond_beam' && q.y1 >= top - BELOW && q.y0 < slab.y1)
  const ground = storey.below ? groundOf(context, storey.below) : []
  const covered = (line: Line): boolean => {
    const width = context.wallThickness
    const spans = merged(bonds.map((bond) => holds(line, width + 0.5, bond.aabb)).filter((x): x is Interval => x !== undefined))
    return spans.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, line.to - line.from) - Math.max(a, 0)), 0) >= (line.to - line.from) * 0.9
  }
  const [su0, sv0, su1, sv1] = slab.aabb
  const borders: Cut[] = [
    { dir: 'u', at: sv0, from: su0, to: su1 }, { dir: 'u', at: sv1, from: su0, to: su1 }, { dir: 'v', at: su0, from: sv0, to: sv1 }, { dir: 'v', at: su1, from: sv0, to: sv1 },
  ]
  const beams: Array<{ part: StructurePart; line: Line; width: number }> = []
  let count = 0
  for (const cut of [...layout.cuts, ...borders]) {
    for (const [from, to] of runsOf(cut, leaves)) {
      const line: Line = { dir: cut.dir === 'v' ? 'v' : 'u', at: cut.at, from, to }
      if (covered(line)) continue
      const walled = wallStretches(context, line, storey.floor, top)
      const allowed = storey.below ? intersect(walled, merged(ground.map((box) => holds(line, 0.02, box)).filter((x): x is Interval => x !== undefined))) : walled
      const held = pillarsFor(line, context.wallThickness, props, spots, { dist: near, options, section: context.section, ends: true, allowed, snap: (spot) => snapToWall(context, storey.floor, spot) })
      const span = beamSpan(to - from, held).span
      const depth = beamDepthFor(span, options)
      const width = Math.max(context.wallThickness, round2(depth / options.beamWidthRatio))
      const aabb: Rect = line.dir === 'u' ? [from, cut.at - width / 2, to, cut.at + width / 2] : [cut.at - width / 2, from, cut.at + width / 2, to]
      beams.push({ part: make({ id: `${slab.id}_b${count++}`, role: 'beam', material: context.beamMaterial, aabb, y0: top - depth, y1: top, floor: slab.floor, slab: slab.id }), line, width })
    }
  }
  const pillars = spots.map((spot) => addPillar(context, spot, storey.bottom, top, storey.floor, storey.below, slab.id))
  context.parts.splice(context.parts.indexOf(panels[panels.length - 1]!) + 1, 0, ...beams.map((b) => b.part))
  const all: Prop[] = [...props, ...pillars.map((p, k) => ({ box: p.aabb, dist: spots[k]!.dist, part: p }))]
  for (const { part: beam, line, width } of beams) for (const used of heldBy(line, width, all).used) rest(context, used.part!, beam)

  // the panels rest on the beams of their edges and on the bond beams (the walls and pillars under them hold the beams)
  for (const panel of panels) {
    for (const { part: beam } of beams) if (touches(panel.aabb, beam.aabb, PLAN_TOLERANCE)) rest(context, beam, panel)
    for (const bond of bonds) if (touches(panel.aabb, bond.aabb, PLAN_TOLERANCE)) rest(context, bond, panel, own.find((s) => s.on === bond.id)?.joint ?? context.joint)
  }
  for (const panel of panels.filter((p) => !context.supports.some((s) => s.part === p.id))) {
    const nearest = [...beams.map((b) => b.part), ...bonds].sort((a, b) => distance(a.aabb, panel.aabb) - distance(b.aabb, panel.aabb))[0]
    if (nearest) rest(context, nearest, panel)
  }
  // what rested on the slab rests on the panels it touches
  for (const support of resting) {
    const upper = context.parts.find((q) => q.id === support.part)
    if (!upper) continue
    for (const panel of panelsUnder(context, slab.id, upper.aabb)) context.supports.push({ ...support, on: panel.id })
  }
}

/** Depth of a beam over `span` metres: `span / beamDepthRatio` up to a multiple of `beamStep`, not under `minimum`. */
export const beamDepthFor = (span: number, options: SlabPanelOptions, minimum = options.beamMinDepth): number => Math.max(minimum, ceilTo(span / options.beamDepthRatio, options.beamStep))

/**
 * After the walls are cut at their windows: a bond beam over a wide opening spans it (the destruction world rests it on the piers, the nearest of its supports
 * to the ground), so it gets the depth and the width of a beam of that span. Returns copies of the parts it changes.
 */
export function deepenBondBeams(input: PartsAndSupports, structure: PlanStructure, options: SlabPanelOptions): PartsAndSupports {
  const frame = structure.construction.frame
  if (!frame.rebar) return input
  const dist = distances(input.parts, input.supports)
  const context = { parts: input.parts } as Context
  let changed = false
  const parts = input.parts.map((part) => {
    if (!isBondBeam(part, frame.beams) || !dist.has(part.id)) return part
    const dir: 'u' | 'v' = part.aabb[2] - part.aabb[0] >= part.aabb[3] - part.aabb[1] ? 'u' : 'v'
    const line = lineOf(part.aabb, dir)
    const width = dir === 'u' ? part.aabb[3] - part.aabb[1] : part.aabb[2] - part.aabb[0]
    const span = beamSpan(line.to - line.from, heldBy(line, width, propsUnder(context, dist, part.y0, part.y1, part.floor)).intervals).span
    if (!(span > 1.5) || !Number.isFinite(span)) return part
    const depth = Math.max(part.y1 - part.y0, beamDepthFor(span, options))
    const wide = Math.max(width, round2(depth / options.beamWidthRatio))
    const grow = (wide - width) / 2
    changed = true
    const aabb: Rect = dir === 'u' ? [part.aabb[0], part.aabb[1] - grow, part.aabb[2], part.aabb[3] + grow] : [part.aabb[0] - grow, part.aabb[1], part.aabb[2] + grow, part.aabb[3]]
    return make({ ...part, aabb, y0: part.y1 - depth })
  })
  return changed ? { parts, supports: input.supports } : input
}

/** Adds the pillars a concrete bond beam needs under it (a frame whose walls only close has none between its corners) and deepens it over a wide span. */
function supportBondBeam(context: Context, plate: StructurePart): void {
  const { options } = context
  const dir: 'u' | 'v' = plate.aabb[2] - plate.aabb[0] >= plate.aabb[3] - plate.aabb[1] ? 'u' : 'v'
  const line = lineOf(plate.aabb, dir)
  const width = dir === 'u' ? plate.aabb[3] - plate.aabb[1] : plate.aabb[2] - plate.aabb[0]
  const dist = distancesOf(context)
  const floor = plate.floor
  const props = propsUnder(context, dist, plate.y0, plate.y1, floor)
  const storey = { floor, below: floor >= 1 ? `slab_${floor}` : undefined, bottom: context.structure.levels[floor] ?? 0 }
  const spots: Array<Spot & { dist: number }> = []
  const near = props.length ? Math.min(...props.map((p) => p.dist)) : pillarDist(context, dist, storey)
  const held = pillarsFor(line, width, props, spots, { dist: near, options, section: context.section, ends: false, allowed: wallStretches(context, line, floor, plate.y0), snap: (spot) => snapToWall(context, floor, spot) })
  const span = beamSpan(line.to - line.from, held).span
  if (span > 1.5 && Number.isFinite(span)) {
    const depth = Math.max(plate.y1 - plate.y0, beamDepthFor(span, options))
    plate.y0 = round2(plate.y1 - depth)
    plate.mass = Math.max(1, Math.round((plate.aabb[2] - plate.aabb[0]) * (plate.aabb[3] - plate.aabb[1]) * depth * densityOf(plate.material)))
  }
  for (const spot of spots) {
    const pillar = addPillar(context, spot, storey.bottom, plate.y0 + PLAN_TOLERANCE, floor, storey.below, plate.id)
    rest(context, pillar, plate, 'rebar')
  }
}

/**
 * The slabs of concrete cut into panels with beams (`SlabPanelOptions`): see `T10-estrutura-real.md` §12. `input` is the structure as
 * `toDestructibleSpec` has it (walls with their roles), and the result has the panels, the beams, the pillars they need and the supports re-pointed.
 */
export function applySlabPanels(input: PartsAndSupports, structure: PlanStructure, options: SlabPanelOptions): PartsAndSupports {
  const frame = structure.construction.frame
  const system = CONSTRUCTION_SYSTEMS.get(structure.construction.system)
  if (!frame.rebar || !system || system.timber || structure.levels.length > options.maxStoreys) return input
  const parts = input.parts.map((p) => ({ ...p }))
  const slabs = parts.filter((p) => isConcreteSlab(p, frame.slabs))
  const bonds = parts.filter((p) => isBondBeam(p, frame.beams))
  if (!slabs.length && !bonds.length) return input
  const firstColumn = input.supports.find((s) => /^(column_0_|building_column_)/.test(s.part) && !/^(column_0_|building_column_)/.test(s.on))
  const context: Context = {
    structure, options, beamMaterial: frame.beams, pillarMaterial: frame.pillars, joint: system.joints.slab, wallThickness: (structure.construction.walls.thickness as number | undefined) ?? 0.15,
    parts, supports: input.supports.slice(), panelsOf: new Map(), pillars: 0, groundBase: firstColumn?.on ?? GROUND, section: sectionOf(structure, options),
  }
  const walls = parts.filter((p) => /^wall_/.test(p.id) && (p.role === 'wall' || p.role === 'partition'))
  const jobs = [...bonds.map((part) => ({ part, bond: true })), ...slabs.map((part) => ({ part, bond: false }))].sort((a, b) => a.part.y0 - b.part.y0 || Number(b.bond) - Number(a.bond))
  for (const job of jobs) {
    if (job.bond) {
      supportBondBeam(context, job.part)
      continue
    }
    const slab = job.part
    const boxes = walls.filter((w) => (w.y0 >= slab.y1 - 0.1 && w.y0 <= slab.y1 + 0.4) || (w.y1 >= slab.y0 - 0.4 && w.y1 <= slab.y1 + 0.1 && w.y0 < slab.y0)).map((w) => w.aabb)
    cutSlab(context, slab, boxes)
  }
  if (structure.construction.foundation.type === 'building') anchorBalconies(context)
  return { parts: context.parts, supports: context.supports }
}

/**
 * A unit of a building stands high above the ground, and the balcony of its plan comes with a pillar of its own that starts at the ground floor: the
 * pillar would be five storeys of a single column under one corner. The balcony is a cantilever of the unit's slab (`slab_base`) and the pillar goes.
 */
function anchorBalconies(context: Context): void {
  const base = context.panelsOf.get('slab_base')
  if (!base) return
  const decks = context.parts.filter((p) => p.role === 'slab' && /^slab_\d+_/.test(p.id) && context.supports.some((s) => s.part === p.id && /^balcony_column_/.test(s.on)))
  for (const deck of decks) {
    const pillars = new Set(context.supports.filter((s) => s.part === deck.id && /^balcony_column_/.test(s.on)).map((s) => s.on))
    context.supports = context.supports.filter((s) => s.part !== deck.id && !pillars.has(s.part) && !pillars.has(s.on))
    context.parts = context.parts.filter((p) => !pillars.has(p.id))
    for (const panel of panelsUnder(context, 'slab_base', deck.aabb)) rest(context, panel, deck)
  }
}

/**
 * The panels `toDestructibleSpec` makes of the slabs of a structure (named as it names them), for a renderer that draws the floor of each room apart:
 * `panels` (each with `slab`, the id of the slab it was cut from), `replaced` (those slabs, which the spec no longer has) and the `supports` that touch the panels.
 */
export function slabPanelView(structure: PlanStructure, options: SlabPanelOptions): { panels: StructurePart[]; replaced: string[]; supports: Support[] } {
  const out = applySlabPanels({ parts: structure.parts, supports: structure.supports }, structure, options)
  const panels = out.parts.filter((p) => p.slab !== undefined && p.role === 'slab')
  const ids = new Set(panels.map((p) => p.id))
  return { panels, replaced: [...new Set(panels.map((p) => p.slab!))], supports: out.supports.filter((s) => ids.has(s.part) || ids.has(s.on)) }
}

/** The panels of `slabPanelView`, alone. */
export const slabPanelsOf = (structure: PlanStructure, options: SlabPanelOptions): StructurePart[] => slabPanelView(structure, options).panels
