import type { StructurePart } from '@adatechnology/game-floorplan-structure';

export type Vec3 = readonly [number, number, number]

/** A fixed solid a run passes through: the box of a slab, a wall or a partition. */
export type Solid = { readonly id: string; readonly min: Vec3; readonly max: Vec3 }

/** One stretch of a run between two cuts. `host` is the solid it lies inside, `fromVertex`/`toVertex` the run's own vertex at an end (-1 where the end is a cut). */
export type Span = { readonly a: Vec3; readonly b: Vec3; readonly length: number; readonly host: string | null; readonly fromVertex: number; readonly toVertex: number }

/** Longest stretch (m) a run may detach as one piece, per kind of run. */
export type SegmentLimits = { readonly wiring: number; readonly pipe: number }

export const DEFAULT_SEGMENT_LIMITS: SegmentLimits = { wiring: 3, pipe: 2.5 }

const CUT_ROLES = new Set(['slab', 'wall', 'partition'])
const EPSILON = 1e-6

/** The solids a run is cut at, from the structure of the plan (slabs, walls and partitions; panels stand in for the slab they cut). */
export function solidsOf(structure: Readonly<Record<string, StructurePart>>): Solid[] {
  const solids: Solid[] = []
  for (const part of Object.values(structure)) {
    if (!CUT_ROLES.has(part.role)) continue
    solids.push({ id: part.id, min: [part.aabb[0], part.y0, part.aabb[1]], max: [part.aabb[2], part.y1, part.aabb[3]] })
  }
  return solids
}

/** The parameters (0..1) where the straight line a-b is inside the solid, or null if it never is. */
function insideRange(a: Vec3, b: Vec3, solid: Solid): [number, number] | null {
  let enter = 0
  let exit = 1
  for (let axis = 0; axis < 3; axis++) {
    const delta = b[axis]! - a[axis]!
    if (Math.abs(delta) < EPSILON) {
      if (a[axis]! < solid.min[axis]! || a[axis]! > solid.max[axis]!) return null
      continue
    }
    const near = (solid.min[axis]! - a[axis]!) / delta
    const far = (solid.max[axis]! - a[axis]!) / delta
    enter = Math.max(enter, Math.min(near, far))
    exit = Math.min(exit, Math.max(near, far))
    if (enter >= exit - EPSILON) return null
  }
  return [enter, exit]
}

const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** Cuts one straight edge where it enters and leaves a solid, then into equal parts no longer than `maxLength`. */
function cutEdge(a: Vec3, b: Vec3, vertex: number, maxLength: number, solids: readonly Solid[]): Span[] {
  const total = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const ranges = solids.map((solid) => ({ solid, range: insideRange(a, b, solid) })).filter((entry): entry is { solid: Solid; range: [number, number] } => entry.range !== null)
  const stops = new Set<number>([0, 1])
  for (const { range } of ranges) for (const t of range) if (t > EPSILON && t < 1 - EPSILON) stops.add(t)
  const ordered = [...stops].sort((left, right) => left - right)
  const spans: Span[] = []
  for (let k = 0; k + 1 < ordered.length; k++) {
    const t0 = ordered[k]!
    const t1 = ordered[k + 1]!
    const middle = (t0 + t1) / 2
    const host = ranges.find(({ range }) => middle >= range[0] && middle <= range[1])?.solid.id ?? null
    const parts = Math.max(1, Math.ceil(((t1 - t0) * total) / maxLength - EPSILON))
    for (let part = 0; part < parts; part++) {
      const from = t0 + ((t1 - t0) * part) / parts
      const to = t0 + ((t1 - t0) * (part + 1)) / parts
      spans.push({ a: lerp(a, b, from), b: lerp(a, b, to), length: (to - from) * total, host, fromVertex: k === 0 && part === 0 ? vertex : -1, toVertex: k + 2 === ordered.length && part === parts - 1 ? vertex + 1 : -1 })
    }
  }
  if (!spans.length) return [{ a, b, length: total, host: null, fromVertex: vertex, toVertex: vertex + 1 }]
  return spans
}

/**
 * The spans a run detaches in: cut where it enters and leaves a slab, wall or partition, and no span longer than `maxLength`. A span is wholly inside a solid or
 * wholly outside it, so none crosses a solid it was cut at.
 */
export function cutRun(points: readonly Vec3[], maxLength: number, solids: readonly Solid[]): Span[] {
  const spans: Span[] = []
  for (let vertex = 0; vertex + 1 < points.length; vertex++) {
    const a = points[vertex]!
    const b = points[vertex + 1]!
    if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < 1e-3) continue
    spans.push(...cutEdge(a, b, vertex, maxLength, solids))
  }
  return spans
}

/**
 * What holds each span so that none hangs in the air: the solid it lies in, else the solid of a span it touches, else the span next to it that is held
 * (the piece id of that span comes from `pieceIdOf`). A run with no solid in reach comes back with undefined holders.
 */
export function holdersOf(spans: readonly Span[], pieceIdOf: (index: number) => string): (string | undefined)[] {
  const holders: (string | undefined)[] = spans.map((span) => span.host ?? undefined)
  let changed = true
  while (changed) {
    changed = false
    for (let index = 0; index < spans.length; index++) {
      if (holders[index] !== undefined) continue
      for (const next of [index - 1, index + 1]) {
        if (next < 0 || next >= spans.length || holders[next] === undefined) continue
        holders[index] = spans[next]!.host ?? pieceIdOf(next)
        changed = true
        break
      }
    }
  }
  return holders
}

/** How far (m) the cap of a stretch cut at a face of the solid it lies in is drawn off that face. */
const CAP_SINK = 0.002

/**
 * Where a stretch is drawn from and to: its ends are cut at the faces of the slabs and walls, and a cap lying on a face of the wall it ends in fights it, so a stretch in a solid
 * is drawn `CAP_SINK` short of its cut and the stretch in the open beside it goes `CAP_SINK` into the solid: every cap lies inside the solid, none on its plane.
 */
export function drawnEnds(span: Span, previous: Span | undefined, next: Span | undefined): [Vec3, Vec3] {
  const along: Vec3 = [(span.b[0] - span.a[0]) / span.length, (span.b[1] - span.a[1]) / span.length, (span.b[2] - span.a[2]) / span.length]
  const shift = (neighbour: Span | undefined): number => (span.host !== null ? -CAP_SINK : neighbour && neighbour.host !== null ? CAP_SINK : 0)
  const move = (end: Vec3, amount: number): Vec3 => [end[0] + along[0] * amount, end[1] + along[1] * amount, end[2] + along[2] * amount]
  return span.length > 4 * CAP_SINK ? [move(span.a, -shift(previous)), move(span.b, shift(next))] : [span.a, span.b]
}
