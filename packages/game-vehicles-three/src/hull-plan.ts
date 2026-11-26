import { FLOATING_AREA, drawnIndexOf, floatingAreaOf } from './hull-excess'
import type { DrawnIndex } from './hull-excess'
import { MIN_DIVISIBLE, cutSoup, joined, longestSide, protrusionsOf, withoutProtrusions } from './hull-split'
import type { CutNode } from './hull-split'
import { hullOf } from './vehicle-hulls'
import type { HullSoup } from './vehicle-hulls'

/** What the division decided about a car and kept: the cuts of each unit, and the protrusions (by number) taken off each piece. Later builds of the same car (dented) follow it. */
export interface HullPlan {
  readonly cuts: Map<string, CutNode>
  readonly taken: Map<string, Set<number>>
}

export const newHullPlan = (): HullPlan => ({ cuts: new Map(), taken: new Map() })

/** A piece of the car (named by its key), or a protrusion taken off one (the key and its number), as a soup. */
export interface HullUnit {
  readonly key: string
  readonly soup: HullSoup
}

/** A piece of a unit and its hull (null when it has none) and the floating area of it. */
export interface HullLeaf {
  readonly unit: string
  readonly path: string
  readonly soup: HullSoup
  readonly points: number[] | null
  readonly floating: number
  /** Its protrusions have been looked at (or it is not a whole piece). */
  readonly isDone: boolean
  /** The drawn triangles of the whole piece it belongs to. */
  readonly drawn: DrawnIndex
}

const floatingOf = (soup: HullSoup, drawn: DrawnIndex): number => {
  const points = hullOf(soup)
  return points ? floatingAreaOf(points, drawn) : 0
}

const leafOf = (unit: string, path: string, soup: HullSoup, isDone: boolean, drawn: DrawnIndex): HullLeaf => {
  const points = hullOf(soup)
  return { unit, path, soup, points, floating: points ? floatingAreaOf(points, drawn) : 0, isDone, drawn }
}

const insertCut = (cuts: Map<string, CutNode>, unit: string, path: string, node: CutNode): void => {
  if (path === '') {
    cuts.set(unit, node)
    return
  }
  let at = cuts.get(unit)!
  for (const step of path.slice(0, -1)) at = (step === '0' ? at.lo : at.hi)!
  if (path.endsWith('0')) at.lo = node
  else at.hi = node
}

/** Takes the thin parts that stretch the hull of a piece off it: those that add more than `FLOATING_AREA` to the floating area of the rest, the one that adds most first, while the model has room. */
const takeProtrusions = (leaf: HullLeaf, room: number): { body: HullLeaf; parts: HullLeaf[]; ids: number[] } => {
  const all = protrusionsOf(leaf.soup)
  const rest = withoutProtrusions(leaf.soup, all)
  const base = floatingOf(rest, leaf.drawn)
  const gains = all.map((protrusion) => ({ protrusion, gain: floatingOf(joined(rest, protrusion.soup), leaf.drawn) - base })).filter(({ gain }) => gain > FLOATING_AREA)
  const taken = gains.sort((a, b) => b.gain - a.gain || a.protrusion.id - b.protrusion.id).slice(0, Math.max(0, room)).map(({ protrusion }) => protrusion)
  const body = leafOf(leaf.unit, '', withoutProtrusions(leaf.soup, taken), true, leaf.drawn)
  return { body, parts: taken.map((protrusion) => leafOf(`${leaf.unit}~${protrusion.id}`, '', protrusion.soup, true, leaf.drawn)), ids: taken.map((protrusion) => protrusion.id) }
}

/**
 * The adaptive division (design 10.3): every piece starts as one hull; while a hull still floats more than `FLOATING_AREA`, the one that floats most (ties go to the first in the list) first
 * gives up the thin parts that stretch it (`takeProtrusions`), then is cut in the middle of its longest side, until none floats that much, none can be cut, or the model has `maxHulls`
 * hulls. What was decided is written to `plan` and is what a dented car follows. Returns the leaves, in the order of the pieces.
 */
export const planDivision = (pieces: readonly HullUnit[], plan: HullPlan, maxHulls: number): HullLeaf[] => {
  let leaves = pieces.map((piece) => leafOf(piece.key, '', piece.soup, false, drawnIndexOf(piece.soup)))
  let hulls = leaves.filter((leaf) => leaf.points).length
  while (hulls < maxHulls) {
    let worst = -1
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i]!
      if (leaf.floating > FLOATING_AREA && (worst < 0 || leaf.floating > leaves[worst]!.floating)) worst = i
    }
    if (worst < 0) break
    const leaf = leaves[worst]!
    if (!leaf.isDone && leaf.path === '') {
      const { body, parts, ids } = takeProtrusions(leaf, maxHulls - hulls)
      if (ids.length > 0) plan.taken.set(leaf.unit, new Set(ids))
      hulls += parts.filter((part) => part.points).length
      leaves = [...leaves.slice(0, worst), body, ...parts, ...leaves.slice(worst + 1)]
      continue
    }
    const { axis, at, length } = longestSide(leaf.soup)
    const [lo, hi] = length < MIN_DIVISIBLE ? [null, null] : cutSoup(leaf.soup, axis, at)
    if (!lo || !hi) {
      leaves[worst] = { ...leaf, floating: 0 }
      continue
    }
    insertCut(plan.cuts, leaf.unit, leaf.path, { axis, at, lo: null, hi: null })
    const halves = [leafOf(leaf.unit, `${leaf.path}0`, lo, true, leaf.drawn), leafOf(leaf.unit, `${leaf.path}1`, hi, true, leaf.drawn)]
    hulls += halves.filter((half) => half.points).length - 1
    leaves = [...leaves.slice(0, worst), ...halves, ...leaves.slice(worst + 1)]
  }
  return leaves
}
