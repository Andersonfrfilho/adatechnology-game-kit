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
  /** Pipes of other networks the mains must pass under by `separation`. */
  readonly above?: readonly LaidPipe[]
  readonly separation?: number
}

const length = (pipe: GravityPipe): number => Math.hypot(pipe.b[0] - pipe.a[0], pipe.b[1] - pipe.a[1])

/** Inverts down the flow: each node at most its top, and every pipe falling at its slope from the highest it can start. */
function pass(pipes: readonly GravityPipe[], top: ReadonlyMap<string, number>): Map<string, number> {
  const incoming = new Map<string, GravityPipe[]>()
  const pending = new Map<string, number>()
  for (const pipe of pipes) {
    incoming.set(pipe.to, [...(incoming.get(pipe.to) ?? []), pipe])
    pending.set(pipe.to, (pending.get(pipe.to) ?? 0) + 1)
    if (!pending.has(pipe.from)) pending.set(pipe.from, 0)
  }
  const invert = new Map<string, number>()
  const ready = [...pending.entries()].filter(([, count]) => count === 0).map(([id]) => id).sort()
  const outgoing = new Map(pipes.map((pipe) => [pipe.from, pipe]))
  while (ready.length > 0) {
    const id = ready.shift() as string
    const fromAbove = (incoming.get(id) ?? []).map((pipe) => (invert.get(pipe.from) ?? 0) - pipe.slope * length(pipe))
    invert.set(id, Math.min(top.get(id) ?? Number.POSITIVE_INFINITY, ...fromAbove))
    const next = outgoing.get(id)
    if (next === undefined) continue
    const left = (pending.get(next.to) ?? 1) - 1
    pending.set(next.to, left)
    if (left === 0) ready.push(next.to)
  }
  return invert
}

/**
 * The inverts of a tree of gravity mains: from the heads down, at the least slope, never above the least cover; then, where a main crosses
 * a pipe laid above it, both ends of that main are lowered until it passes `separation` under it, and the flow is laid again from there.
 */
export function solveDrainInverts({ pipes, top, above = [], separation = 0 }: DrainParams): Map<string, number> {
  const caps = new Map(top)
  let invert = pass(pipes, caps)
  for (let round = 0; round < 16; round++) {
    let lowered = false
    for (const pipe of pipes) {
      for (const laid of above) {
        const crossing = segmentCrossing(pipe.a, pipe.b, laid.a, laid.b)
        if (crossing === undefined) continue
        const need = laid.inverts[0] + (laid.inverts[1] - laid.inverts[0]) * crossing[1] - separation - pipe.diameter
        const from = invert.get(pipe.from) ?? 0
        const to = invert.get(pipe.to) ?? 0
        if (from + (to - from) * crossing[0] <= need + 1e-9) continue
        caps.set(pipe.from, Math.min(caps.get(pipe.from) ?? Number.POSITIVE_INFINITY, need - 1e-3))
        caps.set(pipe.to, Math.min(caps.get(pipe.to) ?? Number.POSITIVE_INFINITY, need - 1e-3))
        lowered = true
      }
    }
    if (!lowered) return invert
    invert = pass(pipes, caps)
  }
  return invert
}
