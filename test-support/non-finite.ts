/**
 * Paths of the numbers in `value` that are not finite (NaN, Infinity), walked before any JSON turns NaN into null: a comparison of JSON strings
 * cannot see a NaN, since it writes the same `null` on both sides. Typed arrays are read element by element; an object met twice (a cycle, or one
 * shared by two branches) is walked once. Stops after `limit` paths.
 */
export function nonFinitePaths(value: unknown, limit = Infinity, path = '', out: string[] = [], seen: WeakSet<object> = new WeakSet()): string[] {
  if (out.length >= limit) return out
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) out.push(`${path}=${value}`)
    return out
  }
  if (!value || typeof value !== 'object') return out
  if (seen.has(value)) return out
  seen.add(value)
  if (ArrayBuffer.isView(value)) {
    if (!(value instanceof DataView)) {
      const items = value as unknown as ArrayLike<number | bigint>
      for (let index = 0; index < items.length && out.length < limit; index++) {
        const item = items[index]
        if (typeof item === 'number' && !Number.isFinite(item)) out.push(`${path}[${index}]=${item}`)
      }
    }
    return out
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length && out.length < limit; index++) nonFinitePaths(value[index], limit, `${path}[${index}]`, out, seen)
    return out
  }
  for (const [key, item] of Object.entries(value)) {
    if (out.length >= limit) break
    nonFinitePaths(item, limit, `${path}.${key}`, out, seen)
  }
  return out
}
