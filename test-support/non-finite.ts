/**
 * Paths of the numbers in `value` that are not finite (NaN, Infinity), walked before any JSON turns NaN into null: a comparison of JSON strings
 * cannot see a NaN, since it writes the same `null` on both sides. Stops after `limit` paths.
 */
export function nonFinitePaths(value: unknown, limit = Infinity, path = '', out: string[] = []): string[] {
  if (out.length >= limit) return out
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) out.push(`${path}=${value}`)
  } else if (Array.isArray(value)) {
    for (let index = 0; index < value.length && out.length < limit; index++) nonFinitePaths(value[index], limit, `${path}[${index}]`, out)
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (out.length >= limit) break
      nonFinitePaths(item, limit, `${path}.${key}`, out)
    }
  }
  return out
}
