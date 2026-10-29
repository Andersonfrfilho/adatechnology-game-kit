import { byteSizeOf } from './merge'
import type { ShapeBuffers } from './types'

export interface ShapeCacheOptions {
  /** Most results kept (default 256). */
  readonly maxEntries?: number
  /** Most bytes of arrays kept (default 64 MiB). A result larger than this alone is not kept. */
  readonly maxBytes?: number
}

export interface ShapeCacheStats {
  readonly entries: number
  readonly bytes: number
  readonly hits: number
  readonly misses: number
  readonly evictions: number
}

/** An LRU of results by `shapeKey`. What it returns is shared: read-only (copy with `cloneBuffers` before deforming). */
export interface ShapeCache {
  get(key: string): ShapeBuffers | undefined
  set(key: string, buffers: ShapeBuffers): void
  has(key: string): boolean
  delete(key: string): boolean
  clear(): void
  stats(): ShapeCacheStats
}

/** An LRU of `ShapeBuffers` by key, bounded by entries and by bytes of the arrays. Pure memoisation: a hit gives the bytes a miss would. */
export function createShapeCache(options: ShapeCacheOptions = {}): ShapeCache {
  const maxEntries = options.maxEntries ?? 256
  const maxBytes = options.maxBytes ?? 64 * 1024 * 1024
  const entries = new Map<string, { buffers: ShapeBuffers; bytes: number }>()
  let bytes = 0
  let hits = 0
  let misses = 0
  let evictions = 0
  const drop = (key: string): boolean => {
    const entry = entries.get(key)
    if (!entry) return false
    entries.delete(key)
    bytes -= entry.bytes
    return true
  }
  return {
    get(key) {
      const entry = entries.get(key)
      if (!entry) {
        misses++
        return undefined
      }
      hits++
      // most recently used goes last
      entries.delete(key)
      entries.set(key, entry)
      return entry.buffers
    },
    set(key, buffers) {
      drop(key)
      const size = byteSizeOf(buffers)
      if (size > maxBytes || maxEntries <= 0) return
      entries.set(key, { buffers, bytes: size })
      bytes += size
      for (const oldest of entries.keys()) {
        if (entries.size <= maxEntries && bytes <= maxBytes) break
        drop(oldest)
        evictions++
      }
    },
    has: (key) => entries.has(key),
    delete: drop,
    clear() {
      entries.clear()
      bytes = 0
    },
    stats: () => ({ entries: entries.size, bytes, hits, misses, evictions }),
  }
}
