type PlainObject = Record<string, unknown>

/** Keys that would reach the prototype of the result when a patch comes from parsed JSON. */
const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype

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
