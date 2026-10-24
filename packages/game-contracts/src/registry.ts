type PlainObject = Record<string, unknown>
type Entry = { readonly id: string }

/** Keys that would reach the prototype of the result when a patch comes from parsed JSON. */
const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype

/** Recursively optional; arrays and functions are replaced as a whole, objects are merged. */
export type DeepPartial<TValue> = TValue extends (...args: never[]) => unknown
  ? TValue
  : TValue extends readonly unknown[]
    ? TValue
    : TValue extends object
      ? { [TKey in keyof TValue]?: DeepPartial<TValue[TKey]> }
      : TValue

/** Merges `patch` over `base`: plain objects merge field by field, arrays, functions and primitives replace. `undefined` in the patch is ignored. */
export const deepMerge = <TBase extends object>(base: TBase, patch: object | undefined): TBase => {
  if (!patch) return base
  const result: PlainObject = { ...(base as PlainObject) }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || UNSAFE_KEYS.has(key)) continue
    const current = result[key]
    result[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value
  }
  return result as TBase
}

/** The shipped entries with the ones from `extra` added or, when the id exists, replaced. */
export const mergeById = <TEntry extends Entry>(shipped: readonly TEntry[], extra: readonly TEntry[] | undefined): Map<string, TEntry> => {
  const entries = new Map<string, TEntry>()
  for (const entry of [...shipped, ...(extra ?? [])]) entries.set(entry.id, entry)
  return entries
}

/** Applies `patch` by id; a patch for an id that does not exist is ignored. */
export const applyPatches = <TEntry extends Entry>(entries: Map<string, TEntry>, patches: Readonly<Record<string, DeepPartial<TEntry> | Partial<TEntry>>> | undefined): void => {
  for (const [id, patch] of Object.entries(patches ?? {})) {
    const entry = entries.get(id)
    if (entry) entries.set(id, deepMerge(entry, patch))
  }
}

export const removeIds = (entries: Map<string, unknown>, ids: readonly string[] | undefined): void => {
  for (const id of ids ?? []) entries.delete(id)
}
