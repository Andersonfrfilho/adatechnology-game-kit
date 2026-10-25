import type { Rect } from '../types'
import type { SlabPanelOptions } from './options'

/** A line of wall seen from above: it runs along `dir` at the coordinate `at` of the other axis, over `[from, to]`. */
export interface WallLine {
  dir: 'u' | 'v'
  at: number
  from: number
  to: number
}

/** A beam line: it runs along `dir` at `at` over `[from, to]`. A cut along `v` at `u = at` separates the panels on its two sides. */
export type Cut = WallLine

export interface Layout {
  leaves: Rect[]
  cuts: Cut[]
}

const EPS = 1e-6

/** The wall boxes `[u0, v0, u1, v1]` as lines. */
export function linesOf(boxes: readonly Rect[]): WallLine[] {
  return boxes.map(([u0, v0, u1, v1]) => (u1 - u0 >= v1 - v0 ? { dir: 'u', at: (v0 + v1) / 2, from: u0, to: u1 } : { dir: 'v', at: (u0 + u1) / 2, from: v0, to: v1 }))
}

/** Share of `[from, to]` the walls of the line `(dir, at)` cover, with gaps up to `doorGap` counted as wall. */
function coverage(lines: readonly WallLine[], dir: 'u' | 'v', at: number, from: number, to: number, options: SlabPanelOptions): number {
  const spans = lines
    .filter((line) => line.dir === dir && Math.abs(line.at - at) <= options.lineTolerance)
    .map((line): [number, number] => [Math.max(from, line.from), Math.min(to, line.to)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0])
  let covered = 0
  let end = from
  let start = NaN
  for (const [a, b] of spans) {
    if (Number.isNaN(start)) {
      start = a
      end = b
    } else if (a - end <= options.doorGap) end = Math.max(end, b)
    else {
      covered += end - start
      start = a
      end = b
    }
  }
  if (!Number.isNaN(start)) covered += end - start
  return to > from ? covered / (to - from) : 0
}

/** Positions of the lines of one direction, walls closer than the tolerance merged. */
function positions(lines: readonly WallLine[], dir: 'u' | 'v', tolerance: number): number[] {
  const sorted = lines.filter((line) => line.dir === dir).map((line) => line.at).sort((a, b) => a - b)
  const out: number[] = []
  let group: number[] = []
  for (const at of sorted) {
    if (group.length && at - group[group.length - 1]! > tolerance) {
      out.push(group.reduce((s, x) => s + x, 0) / group.length)
      group = []
    }
    group.push(at)
  }
  if (group.length) out.push(group.reduce((s, x) => s + x, 0) / group.length)
  return out
}

interface Candidate {
  dir: 'u' | 'v'
  at: number
  coverage: number
  /** 0 at the middle of the rectangle, 1 at its edge. */
  skew: number
}

const round = (x: number): number => Math.round(x * 100) / 100

/** The cut of `rect`: along `dir` at `at`, or none when it is already a panel. */
function choose(rect: Rect, lines: readonly WallLine[], options: SlabPanelOptions): { dir: 'u' | 'v'; at: number } | null {
  const [u0, v0, u1, v1] = rect
  const width = u1 - u0
  const depth = v1 - v0
  const tooWide = width > options.maxSpan + EPS
  const tooDeep = depth > options.maxSpan + EPS
  const candidates: Candidate[] = []
  for (const at of positions(lines, 'v', options.lineTolerance)) {
    if (at < u0 + options.minPanel - EPS || at > u1 - options.minPanel + EPS) continue
    candidates.push({ dir: 'v', at, coverage: coverage(lines, 'v', at, v0, v1, options), skew: Math.abs(at - (u0 + u1) / 2) / (width / 2) })
  }
  for (const at of positions(lines, 'u', options.lineTolerance)) {
    if (at < v0 + options.minPanel - EPS || at > v1 - options.minPanel + EPS) continue
    candidates.push({ dir: 'u', at, coverage: coverage(lines, 'u', at, u0, u1, options), skew: Math.abs(at - (v0 + v1) / 2) / (depth / 2) })
  }
  const boundary = candidates.filter((c) => c.coverage >= options.lineCoverage)
  if (tooWide || tooDeep) {
    // cut across the longer side when both are too long
    const across: 'u' | 'v' = tooWide && (!tooDeep || width >= depth) ? 'v' : 'u'
    const pool = boundary.filter((c) => c.dir === across)
    if (pool.length) {
      const best = pool.reduce((a, b) => (b.skew - 0.25 * b.coverage < a.skew - 0.25 * a.coverage ? b : a))
      return { dir: best.dir, at: round(best.at) }
    }
    const length = across === 'v' ? width : depth
    const origin = across === 'v' ? u0 : v0
    return { dir: across, at: round(origin + length / Math.ceil(length / options.maxSpan - EPS)) }
  }
  if (!boundary.length) return null
  const best = boundary.reduce((a, b) => (b.coverage - 0.25 * b.skew > a.coverage - 0.25 * a.skew ? b : a))
  return { dir: best.dir, at: round(best.at) }
}

/** Cuts `rect` along the walls and into pieces no wider than `maxSpan` (the panels of a slab) and returns them with the cut lines. */
export function layoutPanels(rect: Rect, lines: readonly WallLine[], options: SlabPanelOptions): Layout {
  const leaves: Rect[] = []
  const cuts: Cut[] = []
  const walk = (r: Rect, depth: number): void => {
    const cut = depth < 16 ? choose(r, lines, options) : null
    if (!cut) {
      leaves.push(r)
      return
    }
    if (cut.dir === 'v') {
      cuts.push({ dir: 'v', at: cut.at, from: r[1], to: r[3] })
      walk([r[0], r[1], cut.at, r[3]], depth + 1)
      walk([cut.at, r[1], r[2], r[3]], depth + 1)
    } else {
      cuts.push({ dir: 'u', at: cut.at, from: r[0], to: r[2] })
      walk([r[0], r[1], r[2], cut.at], depth + 1)
      walk([r[0], cut.at, r[2], r[3]], depth + 1)
    }
  }
  walk(rect, 0)
  return { leaves, cuts }
}

export const areaOf = (rect: Rect): number => Math.max(0, rect[2] - rect[0]) * Math.max(0, rect[3] - rect[1])

export function overlapArea(a: Rect, b: Rect): number {
  return Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
}

/** Share of `rect` inside the union of `footprint` (the rectangles of the footprint do not overlap). */
export function shareInside(rect: Rect, footprint: readonly Rect[]): number {
  const area = areaOf(rect)
  return area > 0 ? Math.min(1, footprint.reduce((sum, other) => sum + overlapArea(rect, other), 0) / area) : 0
}

/** The stretches of the cut that border at least one of `panels` (the beams under the kept panels), as `[from, to]` runs. */
export function runsOf(cut: Cut, panels: readonly Rect[], tolerance = 0.02): [number, number][] {
  const spans: [number, number][] = []
  for (const [u0, v0, u1, v1] of panels) {
    if (cut.dir === 'v') {
      if (Math.abs(u0 - cut.at) < tolerance || Math.abs(u1 - cut.at) < tolerance) spans.push([Math.max(v0, cut.from), Math.min(v1, cut.to)])
    } else if (Math.abs(v0 - cut.at) < tolerance || Math.abs(v1 - cut.at) < tolerance) spans.push([Math.max(u0, cut.from), Math.min(u1, cut.to)])
  }
  const sorted = spans.filter(([a, b]) => b - a > tolerance).sort((x, y) => x[0] - y[0])
  const runs: [number, number][] = []
  for (const [a, b] of sorted) {
    const last = runs[runs.length - 1]
    if (last && a <= last[1] + tolerance) last[1] = Math.max(last[1], b)
    else runs.push([a, b])
  }
  return runs
}
