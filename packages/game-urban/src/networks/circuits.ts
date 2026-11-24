import type { PoleSystem } from './pole-tree'
import { diversifiedDemand, pickTransformer } from './rules'
import type { NetworkRules } from './rules'

/** Length of the span between two neighbouring poles. */
export type SpanOf = (ends: { readonly from: string; readonly to: string }) => number

/** One low voltage circuit: its poles, the pole that carries its transformer (the centre of the circuit), the rating that takes its load. */
export type Circuit = { readonly poles: readonly string[]; readonly transformer: string; readonly rating: string; readonly demand: number; readonly over: boolean }

export type CircuitParams = {
  readonly system: PoleSystem
  /** The installed kVA of each consumer a pole feeds (unknown counts in the lower column). */
  readonly consumers: ReadonlyMap<string, readonly number[]>
  readonly span: SpanOf
  readonly rules: NetworkRules
  /** Poles a transformer may not stand on (a service pole inside a lot: the medium voltage never enters a lot). */
  readonly isService: (pole: string) => boolean
}

type Open = { readonly poles: string[]; readonly height: number; readonly diameter: number; readonly installed: number[] }

/**
 * The circuits of a system, cut bottom up on its tree: a pole gathers its children's open circuits, and while the longest line between two
 * of their poles is over twice the circuit limit less one span (the transformer stands on a pole, at most half a span off the middle) or
 * their diversified demand (plus one lamp a pole) is over the largest rating's loading, the child that reaches farthest closes as a circuit
 * of its own (one more transformer). Each circuit's transformer stands on its centre. `over` marks a circuit no cut can bring under the
 * largest rating (one pole's own consumers).
 */
export function circuitsOf({ system, consumers, span, rules, isService }: CircuitParams): Circuit[] {
  const power = rules.power
  const capacity = Math.max(...power.transformers.map((rating) => rating.kva)) * power.maxLoading
  const longest = 2 * power.lvCircuitMaxLength - rules.layout.poles.spacing[1]
  const demandOf = (open: Pick<Open, 'poles' | 'installed'>): number => diversifiedDemand(open.installed, power) + open.poles.filter((pole) => !isService(pole)).length * rules.lighting.lampKva
  const closed: Array<Pick<Open, 'poles' | 'installed'>> = []
  const gather = (pole: string): Open => {
    const parts = (system.children.get(pole) ?? []).map((child) => {
      const open = gather(child)
      return { ...open, height: open.height + span({ from: pole, to: child }) }
    })
    parts.sort((a, b) => b.height - a.height)
    const own = (): Open => {
      const heights = parts.map((part) => part.height)
      return {
        poles: [pole, ...parts.flatMap((part) => part.poles)],
        height: Math.max(0, ...heights),
        diameter: Math.max(0, ...parts.map((part) => part.diameter), (heights[0] ?? 0) + (heights[1] ?? 0)),
        installed: [...(consumers.get(pole) ?? []), ...parts.flatMap((part) => part.installed)],
      }
    }
    let open = own()
    while (parts.length > 0 && (open.diameter > longest || demandOf(open) > capacity)) {
      closed.push(parts.shift() as Open)
      open = own()
    }
    return open
  }
  closed.push(gather(system.root))
  return closed.map((open) => {
    const transformer = centreOf({ poles: open.poles, system, span, isService })
    const demand = demandOf(open)
    const rating = pickTransformer(demand, power)
    return { poles: open.poles, transformer, rating: rating?.id ?? power.transformers[power.transformers.length - 1]?.id ?? 'none', demand, over: rating === undefined }
  })
}

export type DistancesParams = { readonly poles: readonly string[]; readonly from: string; readonly system: PoleSystem; readonly span: SpanOf }

/** Line length from `from` to every pole of the circuit, along the tree. */
export function distancesWithin({ poles, from, system, span }: DistancesParams): Map<string, number> {
  const members = new Set(poles)
  const distance = new Map([[from, 0]])
  const pending = [from]
  while (pending.length > 0) {
    const id = pending.pop() as string
    const up = system.parent.get(id)
    const near = [...(system.children.get(id) ?? []), ...(up === undefined ? [] : [up])].filter((next) => members.has(next) && !distance.has(next))
    for (const next of near) {
      distance.set(next, (distance.get(id) ?? 0) + span({ from: id, to: next }))
      pending.push(next)
    }
  }
  return distance
}

/** The street pole of a circuit with the shortest longest line to the others (the first in tree order on a tie). */
function centreOf({ poles, system, span, isService }: Omit<DistancesParams, 'from'> & { readonly isService: (pole: string) => boolean }): string {
  let best = poles.find((pole) => !isService(pole)) ?? (poles[0] as string)
  let bestReach = Number.POSITIVE_INFINITY
  for (const pole of poles) {
    if (isService(pole)) continue
    const reach = Math.max(...distancesWithin({ poles, from: pole, system, span }).values())
    if (reach < bestReach - 1e-9) {
      best = pole
      bestReach = reach
    }
  }
  return best
}
