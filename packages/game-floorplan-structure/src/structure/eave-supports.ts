import type { JointKind } from '@adatechnology/game-contracts'

import { GROUND } from '../types'
import type { Rect, StructurePart } from '../types'
import { round2, touches } from '../geometry'
import { pillarBox } from './context'
import type { BuildContext } from './context'

/** Most metres an eave beam spans between two of its supports (the spacing of the wall pillars of confined masonry). */
export const EAVE_SUPPORT_SPACING = 4
/** Width of an eave beam, metres (NBR 6118 13.2.2: at least 12 cm). */
const EAVE_BEAM_WIDTH = 0.15
/** Least depth of a concrete eave beam (the depth of the bond beams), metres; else a tenth of its span (h = L/10). */
const MIN_BEAM_DEPTH = 0.25
/** Side of a timber post of a timber house, metres. */
const TIMBER_POST = 0.12
/** Metres a wall's plate may stop short of the first member it does not reach for the eave beam to start at its end and bear on it. */
const REACH = 2
/** Members closer than this along the line are one group under one eave beam, metres (a bit over the pitch of the rafters). */
const GROUPING = 1.6
const TOLERANCE = 0.02

/** The members of a roof with nothing under them along one eave line: the line, its axis and the floor and height of the eave. */
export interface BareEave {
  readonly members: readonly StructurePart[]
  readonly axis: 'u' | 'v'
  /** Plan coordinate of the eave line across `axis` (the edge of the roof's box, where the wall would stand). */
  readonly line: number
  readonly floor: number
  readonly eaveY: number
  readonly carriers: readonly StructurePart[]
  readonly joint: JointKind
}

/** The box of a post at `at` along the eave line: a timber post, or a concrete pillar of the walls' section. */
function postBox(context: BuildContext, at: { axis: 'u' | 'v'; line: number; at: number }): Rect {
  const { axis, line } = at
  const [u, v] = axis === 'u' ? [at.at, line] : [line, at.at]
  return context.isTimber ? [u - TIMBER_POST / 2, v - TIMBER_POST / 2, u + TIMBER_POST / 2, v + TIMBER_POST / 2] : pillarBox(context.pillar, u, v, axis === 'u')
}

const alongOf = (part: StructurePart, axis: 'u' | 'v'): [number, number] => (axis === 'u' ? [part.aabb[0], part.aabb[2]] : [part.aabb[1], part.aabb[3]])
const centreAlong = (part: StructurePart, axis: 'u' | 'v'): number => (alongOf(part, axis)[0] + alongOf(part, axis)[1]) / 2
const crossesLine = (part: StructurePart, axis: 'u' | 'v', line: number): boolean =>
  axis === 'u' ? part.aabb[1] <= line + TOLERANCE && part.aabb[3] >= line - TOLERANCE : part.aabb[0] <= line + TOLERANCE && part.aabb[2] >= line - TOLERANCE

/** Whether a post over `box` from `y0` to `y1` runs through nothing already built (a wall, a lintel, a slab, a doorway's frame). */
function isClear(context: BuildContext, box: Rect, span: { y0: number; y1: number; except?: StructurePart }): boolean {
  // (a partition, a terrace's railing, gives way to the pillar: it closes, it carries nothing; a slab is pierced by it, as by any column)
  return !context.builder.parts.some((p) => p !== span.except && p.role !== 'roof' && p.role !== 'none' && p.role !== 'partition' && p.role !== 'slab' && Math.min(p.y1, span.y1) - Math.max(p.y0, span.y0) > TOLERANCE && touches(p.aabb, box, -TOLERANCE))
}

/** Whether a door of the storey opens across `box` (a post there would stand in the doorway). */
function inDoorway(context: BuildContext, box: Rect, floor: number): boolean {
  return context.source.doors.some((d) => {
    if (d.floor !== floor) return false
    const half = d.width / 2
    const gap: Rect = d.axis === 'u' ? [d.u - half, d.v - 0.2, d.u + half, d.v + 0.2] : [d.u - 0.2, d.v - half, d.u + 0.2, d.v + half]
    return touches(gap, box, -TOLERANCE)
  })
}

/**
 * What a post at the eave stands on: on the ground floor the foundation under it (the raft, a footing) or the ground; above, the bond beam, wall or pillar
 * of the storey below whose top is the storey's floor; nothing there (an opening, a slab panel below), none. The post must also run through nothing built.
 */
function postBase(context: BuildContext, box: Rect, at: { floor: number; top: number }): { on: StructurePart | typeof GROUND; y0: number } | undefined {
  const { floor, top } = at
  if (inDoorway(context, box, floor)) return undefined
  if (floor === 0) {
    const footing = context.builder.parts.filter((p) => (p.role === 'slab' || /footing|foundation|ground_beam/.test(p.id)) && p.y1 <= context.level(0) + 0.06 && touches(p.aabb, box, -TOLERANCE)).sort((a, b) => b.y1 - a.y1)[0]
    const base: { on: StructurePart | typeof GROUND; y0: number } = footing ? { on: footing, y0: footing.y1 } : { on: GROUND, y0: 0 }
    return isClear(context, box, { y0: base.y0, y1: top, ...(footing ? { except: footing } : {}) }) ? base : undefined
  }
  // the bond beam, wall or pillar of the storey below (its bond beam may stand a little over the floor level: the post starts on its top); none there (a
  // balcony under a balcony), of the storey under that, the post running past the slabs between as a column of the stacked balconies does
  for (let storey = floor - 1; storey >= 0; storey--) {
    const level = context.level(storey + 1)
    const below = context.builder.parts
      .filter((p) => p.floor === storey && (p.beamKind === 'bond_beam' || p.role === 'wall' || p.role === 'column') && p.y1 >= level - 0.06 && p.y1 <= level + 0.3 && touches(p.aabb, box, -0.05))
      .sort((a, b) => b.y1 - a.y1)[0]
    if (below) return isClear(context, box, { y0: below.y1, y1: top }) ? { on: below, y0: below.y1 } : undefined
  }
  return postBase(context, box, { floor: 0, top })
}

/** A station near `at` (within `range`, nearest first) where a post can stand. */
function stationNear(context: BuildContext, at: number, place: { axis: 'u' | 'v'; line: number; floor: number; top: number; range: readonly number[] }): number | undefined {
  return place.range.map((d) => at + d).find((x) => postBase(context, postBox(context, { axis: place.axis, line: place.line, at: x }), place) !== undefined)
}

/**
 * Where a roof runs past the walls (over a terrace, a balcony, a wide doorway the bond beam does not cross) its rafters reach no plate: an eave beam along the
 * eave line carries them. At an end where a wall's plate stops within `REACH` the beam continues it: it bears on the pillar under the plate's end (the plate
 * cut back to it); elsewhere on a pillar of its own, set back up to 1.5 m where the end has nothing under it. More pillars where something below can take them
 * so that no span passes `EAVE_SUPPORT_SPACING` (over an opening or a slab panel below, none: the beam spans on, as deep as its span asks), each on the bond
 * beam, wall or pillar of the storey below, or on the foundation. Concrete (NBR 6118: depth L/10, at least 25 cm; pillars of the walls' section), or timber
 * posts and beams in a timber house (which bear on the plate's end: a timber plate carries by its studs). Each bare member rests on the beam.
 */
export function addEaveSupports(context: BuildContext, eave: BareEave): StructurePart[] {
  const { builder, construction } = context
  const { axis, line, floor, eaveY, carriers } = eave
  const timber = context.isTimber
  const material = timber ? construction.frame.timber : construction.frame.beams
  const sorted = [...eave.members].sort((a, b) => centreAlong(a, axis) - centreAlong(b, axis))
  const groups: StructurePart[][] = []
  for (const member of sorted) {
    const last = groups[groups.length - 1]
    if (last && centreAlong(member, axis) - centreAlong(last[last.length - 1]!, axis) <= GROUPING) last.push(member)
    else groups.push([member])
  }
  const created: StructurePart[] = []
  const onLine = carriers.filter((c) => c.role !== 'slab' && crossesLine(c, axis, line))
  for (const group of groups) {
    let lo = centreAlong(group[0]!, axis) - 0.1
    let hi = centreAlong(group[group.length - 1]!, axis) + 0.1
    const left = onLine.filter((c) => alongOf(c, axis)[1] <= lo + TOLERANCE && alongOf(c, axis)[1] >= lo - REACH).sort((a, b) => alongOf(b, axis)[1] - alongOf(a, axis)[1])[0]
    const right = onLine.filter((c) => alongOf(c, axis)[0] >= hi - TOLERANCE && alongOf(c, axis)[0] <= hi + REACH).sort((a, b) => alongOf(a, axis)[0] - alongOf(b, axis)[0])[0]
    if (left) lo = alongOf(left, axis)[1]
    if (right) hi = alongOf(right, axis)[0]
    // (a second roof unit over the same line: one beam)
    const same = builder.parts.find((p) => p.id.startsWith(`eave_beam_${floor}_`) && p.role === 'beam' && Math.abs(alongOf(p, axis)[0] - lo) < TOLERANCE && Math.abs(alongOf(p, axis)[1] - hi) < TOLERANCE && crossesLine(p, axis, line))
    if (same) {
      for (const member of group) builder.rest(member, same, eave.joint)
      continue
    }
    const top = eaveY - MIN_BEAM_DEPTH
    const place = { axis, line, floor, top }
    // its own pillars at its ends: right past the end of a plate (the beam abuts the plate and bears on its own pillar: never on the end of a shallower
    // beam, NBR 6118 18.3.7), set back up to 1.5 m where nothing is under the end; only where no pillar can stand by a plate's end (a doorway under it)
    // does the beam bear on the plate, as the plate bears on the wall there
    // (past a plate's end by more than its wall's pillar reach, so it is no pillar of that wall)
    const firstPost = stationNear(context, lo, { ...place, range: left ? [0.65, 0.8] : [0.15, 0.3, 0.5, 0.75, 1, 1.25, 1.5] })
    const lastPost = stationNear(context, hi, { ...place, range: right ? [-0.65, -0.8] : [-0.15, -0.3, -0.5, -0.75, -1, -1.25, -1.5] })
    const from = firstPost ?? lo
    const to = lastPost ?? hi
    const spans = Math.max(1, Math.ceil((to - from) / EAVE_SUPPORT_SPACING - 1e-6))
    const middle = Array.from({ length: spans - 1 }, (_, n) => from + ((to - from) * (n + 1)) / spans).flatMap((at) => {
      const found = stationNear(context, at, { ...place, range: [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9] })
      return found === undefined ? [] : [found]
    })
    const stations = [...(firstPost === undefined ? [] : [firstPost]), ...middle, ...(lastPost === undefined ? [] : [lastPost])]
    if ((!left && firstPost === undefined) || (!right && lastPost === undefined)) continue
    const supports = [from, ...middle, to]
    const longest = Math.max(...supports.slice(1).map((x, n) => x - supports[n]!), from - lo, hi - to)
    const depth = timber ? Math.max(0.15, round2(longest / 12)) : Math.max(MIN_BEAM_DEPTH, round2(longest / 10))
    const id = `eave_beam_${floor}_${builder.parts.filter((p) => p.role === 'beam' && p.id.startsWith(`eave_beam_${floor}_`)).length}`
    const half = EAVE_BEAM_WIDTH / 2
    const aabb: Rect = axis === 'u' ? [lo, line - half, hi, line + half] : [line - half, lo, line + half, hi]
    const beam = builder.add({ id, role: 'beam', material, aabb, y0: eaveY - depth, y1: eaveY }, { floor, ...(timber ? {} : { assembly: 'reinforced_concrete' }) })
    created.push(beam)
    if (left && firstPost === undefined) builder.rest(beam, left, timber ? 'nail' : 'rebar')
    if (right && lastPost === undefined) builder.rest(beam, right, timber ? 'nail' : 'rebar')
    stations.forEach((at, n) => {
      const box = postBox(context, { axis, line, at })
      // (found clear up to 25 cm under the eave: clear under a deeper beam too)
      const base = postBase(context, box, { floor, top: beam.y0 })
      if (!base) return
      const post = builder.add({ id: `${id}_post_${n}`, role: 'column', material: timber ? construction.frame.timber : construction.frame.pillars, aabb: box, y0: base.y0, y1: beam.y0 }, { floor, ...(timber ? {} : { assembly: 'reinforced_concrete' }) })
      builder.rest(post, base.on, timber ? 'nail' : 'rebar')
      builder.rest(beam, post, timber ? 'nail' : 'rebar')
      created.push(post)
    })
    for (const member of group) builder.rest(member, beam, eave.joint)
  }
  return created
}
