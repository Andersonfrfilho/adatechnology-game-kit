/** What sizing a structure from its loads reads: each part's load at rest and in each loss case, and the rule's numbers. */
export interface CapacityRule<TPart> {
  readonly parts: Iterable<TPart>
  /** Load of a part at rest (undefined: it carries nothing and is left as it is). */
  loadOf(part: TPart): number | undefined
  /** Loads with one part lost, one function per case (`undefined`: the part carries nothing there). */
  readonly losses: Iterable<(part: TPart) => number | undefined>
  /** Share of its capacity a part uses at rest. */
  safety(part: TPart): number
  /** The most of its capacity a part `redundant` keeps to after any loss (unset: no loss is checked). */
  readonly redundancy?: number
  redundant(part: TPart): boolean
  /** Least capacity (default 0). */
  readonly minimum?: number
}

/**
 * The capacity of each loaded part as a designer sizes it: it uses `safety` of it at rest, and a part that must hold a loss stays under `redundancy` with
 * any other part lost (the house holds one loss and falls with two). The structure that designs a building and the destruction world that sizes a spec
 * both size with this rule, each from the loads it computes.
 */
export function capacitiesByLoad<TPart>(rule: CapacityRule<TPart>): Map<TPart, number> {
  const need = new Map<TPart, number>()
  for (const part of rule.parts) {
    const load = rule.loadOf(part)
    if (load === undefined) continue
    need.set(part, Math.max(rule.minimum ?? 0, load / rule.safety(part)))
  }
  if (rule.redundancy === undefined) return need
  for (const lost of rule.losses) {
    for (const [part, capacity] of need) {
      if (!rule.redundant(part)) continue
      const load = lost(part)
      if (load !== undefined && load / rule.redundancy > capacity) need.set(part, load / rule.redundancy)
    }
  }
  return need
}
