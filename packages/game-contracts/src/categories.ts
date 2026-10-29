import { applyPatches, deepMerge, mergeById, removeIds } from './registry'
import type { DeepPartial } from './registry'

/** One category (kind) of items. Defaults and required contracts are inherited from the `extends` chain. */
export interface CategoryDef<TDefaults extends object = Record<string, unknown>> {
  readonly id: string
  /** Parent category id; the child inherits its defaults and its required contracts. */
  readonly extends?: string
  /** Field values every entry of this kind starts with; objects merge down the chain, arrays replace. */
  readonly defaults?: DeepPartial<TDefaults>
  /** Contract ids (`ContractChecker.id`) every entry of this kind, or of a descendant, must satisfy. */
  readonly requires?: readonly string[]
  /** An abstract category only groups: entries cannot declare it directly, only its descendants. */
  readonly abstract?: boolean
}

/** Where a checker is being run: the entry's kind and the chain of categories root first. */
export interface ContractContext {
  readonly kind: string
  readonly chain: readonly string[]
}

/** A named contract: returns the problems of an entry, each a short phrase like `missing leftover.despawnSeconds`. Empty means it holds. */
export interface ContractChecker<TEntry> {
  readonly id: string
  check(entry: TEntry, ctx: ContractContext): string[]
}

export interface CategoryOptions {
  /** Categories added to the shipped ones; the same id replaces. */
  readonly extra?: readonly CategoryDef[]
  /** Partial changes by id, applied after `extra`. */
  readonly patches?: Readonly<Record<string, DeepPartial<CategoryDef> | Partial<CategoryDef>>>
  /** Ids taken out of the tree (their children are then reported by `check()`). */
  readonly remove?: readonly string[]
}

export interface CategoryRegistry {
  get(id: string): CategoryDef | undefined
  has(id: string): boolean
  ids(): string[]
  /** Root first, ending at `id`. Throws on an unknown id, an unknown parent or a cycle. */
  chain(id: string): string[]
  /** `defaults` merged along the chain, root first, so the closest category wins. */
  defaults(id: string): Record<string, unknown>
  /** Union of `requires` along the chain, order kept, without duplicates. */
  requires(id: string): string[]
  /** True when `id` is `ancestorId` or descends from it. */
  isA(id: string, ancestorId: string): boolean
  /** Problems in the tree itself: duplicate ids, unknown `extends`, cycles. */
  check(): string[]
}

export interface CategorizedOptions {
  /** Field of the entry that names its category. Default `kind`. */
  readonly kindField?: string
  /** Known gaps by entry id: problems starting with one of these texts go to `allowed`, so the list can shrink over time. */
  readonly allow?: Readonly<Record<string, readonly string[]>>
}

export interface CategorizedReport {
  readonly ok: boolean
  readonly problems: string[]
  readonly allowed: string[]
}

export const defineCategories = (defs: readonly CategoryDef[], options: CategoryOptions = {}): CategoryRegistry => {
  const problems: string[] = []
  const duplicates = (list: readonly CategoryDef[]): void => {
    const ids = new Set<string>()
    for (const def of list) {
      if (ids.has(def.id)) problems.push(`duplicate category "${def.id}"`)
      ids.add(def.id)
    }
  }
  duplicates(defs)
  duplicates(options.extra ?? [])

  const entries = mergeById(defs, options.extra)
  applyPatches(entries, options.patches)
  removeIds(entries, options.remove)

  const chain = (id: string): string[] => {
    const path: string[] = []
    let current: string | undefined = id
    while (current !== undefined) {
      const def = entries.get(current)
      if (!def) throw new Error(path.length === 0 ? `unknown category "${current}"` : `category "${path[0]}" has unknown parent "${current}"`)
      if (path.includes(current)) throw new Error(`category cycle: ${[...path, current].reverse().join(' -> ')}`)
      path.push(current)
      current = def.extends
    }
    return path.reverse()
  }

  const registry: CategoryRegistry = {
    get: (id) => entries.get(id),
    has: (id) => entries.has(id),
    ids: () => [...entries.keys()],
    chain,
    defaults: (id) => chain(id).reduce<Record<string, unknown>>((acc, ancestor) => deepMerge(acc, entries.get(ancestor)?.defaults), {}),
    requires: (id) => {
      const out: string[] = []
      for (const ancestor of chain(id)) for (const contract of entries.get(ancestor)?.requires ?? []) if (!out.includes(contract)) out.push(contract)
      return out
    },
    isA: (id, ancestorId) => {
      try {
        return chain(id).includes(ancestorId)
      } catch {
        return false
      }
    },
    check: () => {
      const found = [...problems]
      for (const [id, def] of entries) {
        if (def.extends !== undefined && !entries.has(def.extends)) found.push(`category "${id}" extends unknown "${def.extends}"`)
        else {
          try {
            chain(id)
          } catch (error) {
            const message = (error as Error).message
            // The same cycle is found from each of its members; the dedupe keeps one line per distinct message.
            if (message.startsWith('category cycle') && !found.includes(message)) found.push(message)
          }
        }
      }
      return found
    },
  }
  return registry
}

/** The entry with the defaults of its category underneath: the entry wins, objects merge, arrays replace. */
export const resolveEntry = <TEntry extends object>(registry: CategoryRegistry, entry: TEntry, kindField = 'kind'): TEntry =>
  deepMerge(registry.defaults(String((entry as Record<string, unknown>)[kindField])) as TEntry, entry)

/** Checks that each entry has a known, concrete kind and satisfies every contract its chain requires. */
export const checkCategorized = <TEntry extends { readonly id: string }>(
  entries: readonly TEntry[],
  registry: CategoryRegistry,
  checkers: readonly ContractChecker<TEntry>[],
  options: CategorizedOptions = {},
): CategorizedReport => {
  const kindField = options.kindField ?? 'kind'
  const byId = new Map(checkers.map((checker) => [checker.id, checker]))
  const problems: string[] = [...registry.check()]
  const allowed: string[] = []

  for (const entry of entries) {
    const kind = String((entry as Record<string, unknown>)[kindField])
    if (!registry.has(kind)) {
      problems.push(`"${entry.id}" has unknown kind "${kind}"`)
      continue
    }
    if (registry.get(kind)?.abstract) {
      problems.push(`"${entry.id}" has abstract kind "${kind}"`)
      continue
    }
    let path: string[]
    try {
      path = registry.chain(kind)
    } catch (error) {
      problems.push(`"${entry.id}" (${kind}): ${(error as Error).message}`)
      continue
    }
    const resolved = resolveEntry(registry, entry, kindField)
    for (const contract of registry.requires(kind)) {
      const owner = path.find((ancestor) => registry.get(ancestor)?.requires?.includes(contract)) ?? kind
      const checker = byId.get(contract)
      if (!checker) {
        problems.push(`kind "${kind}" requires contract "${contract}" but no checker is registered`)
        continue
      }
      const prefix = `"${entry.id}" (${kind}): `
      for (const problem of checker.check(resolved, { kind, chain: path })) {
        const text = `${prefix}${problem}, required by ${owner}`
        if ((options.allow?.[entry.id] ?? []).some((start) => problem.startsWith(start))) allowed.push(text)
        else problems.push(text)
      }
    }
  }
  return { ok: problems.length === 0, problems: [...new Set(problems)], allowed }
}
