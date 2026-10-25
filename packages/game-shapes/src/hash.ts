/**
 * Canonical JSON (keys sorted, `undefined` left out, `-0` kept as `-0`, typed arrays as plain lists) and a 64-bit FNV-1a of it in two 32-bit
 * lanes: the key a shape is cached and shared by.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : Number.isFinite(value) ? String(value) : JSON.stringify(String(value))
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'function') throw new Error('game-shapes: a function cannot be part of a shape (register it as a generator)')
  if (ArrayBuffer.isView(value)) return canonicalJson(Array.from(value as unknown as ArrayLike<number>))
  if (Array.isArray(value)) return `[${value.map((item) => (item === undefined ? 'null' : canonicalJson(item))).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  }
  return 'null'
}

const lane = (text: string, offset: number, prime: number): string => {
  let hash = offset
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, prime)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** 64-bit FNV-1a of a text as 16 hex digits (two independent 32-bit lanes). */
export const hash64 = (text: string): string => lane(text, 0x811c9dc5, 0x01000193) + lane(text, 0x050c5d1f, 0x5bd1e995)

/** `hash64(canonicalJson(value))`. */
export const hashValue = (value: unknown): string => hash64(canonicalJson(value))
