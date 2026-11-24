import { segmentCrossing } from './geometry'
import type { PlanPoint } from './geometry'

/** A pipe of a gravity main between two nodes, in the direction of the flow. */
export type GravityPipe = { readonly from: string; readonly to: string; readonly a: PlanPoint; readonly b: PlanPoint; readonly diameter: number; readonly slope: number }

/** A pipe already laid, by its plan ends and the bottoms there: the main must pass under it. */
export type LaidPipe = { readonly a: PlanPoint; readonly b: PlanPoint; readonly inverts: readonly [number, number] }

export type DrainParams = {
  readonly pipes: readonly GravityPipe[]
  /** The highest invert each node may have: under its least cover. */
  readonly top: ReadonlyMap<string, number>
  /** The lowest invert each node may have (the deepest a sewer goes, an outfall above the river): a pipe that would reach under it is lifted at its upper node. */
  readonly floor?: ReadonlyMap<string, number>
  /** Pipes of other networks the mains must pass under by `separation`. */
  readonly above?: readonly LaidPipe[]
  readonly separation?: number
}

/** The inverts of the nodes, and the lifts: a node whose outgoing pipe starts again near the ground (a pumping station), with that start. */
export type DrainInverts = { readonly inverts: ReadonlyMap<string, number>; readonly lifts: ReadonlyMap<string, number> }

const length = (pipe: GravityPipe): number => Math.hypot(pipe.b[0] - pipe.a[0], pipe.b[1] - pipe.a[1])

type PassParams = { readonly pipes: readonly GravityPipe[]; readonly top: ReadonlyMap<string, number>; readonly floor: ReadonlyMap<string, number> }

/** Inverts down the flow: each node at most its top, every pipe falling at its slope from the highest it can start, lifted where it would go under the floor. */
function pass({ pipes, top, floor }: PassParams): { inverts: Map<string, number>; lifts: Map<string, number> } {
  const incoming = new Map<string, GravityPipe[]>()
  const pending = new Map<string, number>()
  for (const pipe of pipes) {
    incoming.set(pipe.to, [...(incoming.get(pipe.to) ?? []), pipe])
    pending.set(pipe.to, (pending.get(pipe.to) ?? 0) + 1)
    if (!pending.has(pipe.from)) pending.set(pipe.from, 0)
  }
  const inverts = new Map<string, number>()
  const lifts = new Map<string, number>()
  const ready = [...pending.entries()].filter(([, count]) => count === 0).map(([id]) => id).sort()
  const outgoing = new Map(pipes.map((pipe) => [pipe.from, pipe]))
  while (ready.length > 0) {
    const id = ready.shift() as string
    const lowest = floor.get(id) ?? Number.NEGATIVE_INFINITY
    const fromAbove = (incoming.get(id) ?? []).map((pipe) => {
      const reach = (lifts.get(pipe.from) ?? inverts.get(pipe.from) ?? 0) - pipe.slope * length(pipe)
      if (reach >= lowest - 1e-9 || lifts.has(pipe.from)) return reach
      lifts.set(pipe.from, top.get(pipe.from) ?? 0)
      return (lifts.get(pipe.from) ?? 0) - pipe.slope * length(pipe)
    })
    inverts.set(id, Math.min(top.get(id) ?? Number.POSITIVE_INFINITY, ...fromAbove))
    const next = outgoing.get(id)
    if (next === undefined) continue
    const left = (pending.get(next.to) ?? 1) - 1
    pending.set(next.to, left)
    if (left === 0) ready.push(next.to)
  }
  return { inverts, lifts }
}

/** For each main, the laid pipes whose plan boxes meet its own (found once, by cells of 20 m). */
function crossingCandidates({ pipes, above }: { readonly pipes: readonly GravityPipe[]; readonly above: readonly LaidPipe[] }): Map<GravityPipe, LaidPipe[]> {
  const size = 20
  const cells = new Map<string, LaidPipe[]>()
  const cellsOf = (a: PlanPoint, b: PlanPoint): string[] => {
    const out: string[] = []
    for (let i = Math.floor(Math.min(a[0], b[0]) / size); i <= Math.floor(Math.max(a[0], b[0]) / size); i++) {
      for (let k = Math.floor(Math.min(a[1], b[1]) / size); k <= Math.floor(Math.max(a[1], b[1]) / size); k++) out.push(`${i},${k}`)
    }
    return out
  }
  for (const laid of above) for (const cell of cellsOf(laid.a, laid.b)) cells.set(cell, [...(cells.get(cell) ?? []), laid])
  return new Map(pipes.map((pipe) => [pipe, [...new Set(cellsOf(pipe.a, pipe.b).flatMap((cell) => cells.get(cell) ?? []))]]))
}

/**
 * The inverts of a tree of gravity mains: from the heads down, at the least slope, never above the least cover nor under the floor (a lift
 * there); then, where a main crosses a pipe laid above it, the upper end of that main is lowered until it passes `separation` under it, and the
 * flow is laid again from there.
 */
export function solveDrainInverts({ pipes, top, floor = new Map(), above = [], separation = 0 }: DrainParams): DrainInverts {
  const caps = new Map(top)
  const candidates = crossingCandidates({ pipes, above })
  let result = pass({ pipes, top: caps, floor })
  for (let round = 0; round < 16; round++) {
    let lowered = false
    for (const pipe of pipes) {
      for (const laid of candidates.get(pipe) ?? []) {
        const crossing = segmentCrossing(pipe.a, pipe.b, laid.a, laid.b)
        if (crossing === undefined) continue
        const need = laid.inverts[0] + (laid.inverts[1] - laid.inverts[0]) * crossing[1] - separation - pipe.diameter
        const from = result.lifts.get(pipe.from) ?? result.inverts.get(pipe.from) ?? 0
        const to = result.inverts.get(pipe.to) ?? 0
        if (from + (to - from) * crossing[0] <= need + 1e-9) continue
        // the pipe falls from its upper node, so starting it under the crossing is enough
        caps.set(pipe.from, Math.min(caps.get(pipe.from) ?? Number.POSITIVE_INFINITY, need - 1e-3))
        lowered = true
      }
    }
    if (!lowered) return result
    result = pass({ pipes, top: caps, floor })
  }
  return result
}
