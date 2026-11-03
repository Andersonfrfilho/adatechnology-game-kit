import type { BufferGeometry } from 'three'

import { markPooled, pooledKey, roundedNumber } from './pooled'

export interface GeometryPool {
  /** The geometry for `key`, built once with `build`. Counts one use. */
  acquire(key: string, build: () => BufferGeometry): BufferGeometry
  release(geometry: BufferGeometry): void
  /** Never disposed while the pool lives (unit shapes, effect geometries warmed at load). */
  retain(key: string): void
  /** Disposes unretained geometries with no use, oldest first, keeping at most `keep` idle ones. Only at load points, never in play. */
  trim(keep?: number): number
  stats(): { readonly entries: number; readonly retained: number; readonly inUse: number }
  dispose(): void
}

type Entry = { geometry: BufferGeometry; uses: number; retained: boolean; idleSince: number; disposeForPool(): void }

const DEFAULT_KEY_STEP = 1e-3

/** Builds a key from a kind and its numbers, rounded to `step`, so near-equal sizes share one geometry. */
export function geometryKey(kind: string, params: readonly number[], step: number = DEFAULT_KEY_STEP): string {
  return [kind, ...params.map((value) => roundedNumber(value, step))].join('|')
}

export function createGeometryPool(): GeometryPool {
  const entries = new Map<string, Entry>()
  let clock = 0

  function disposeEntry(key: string, entry: Entry): void {
    entries.delete(key)
    entry.disposeForPool()
  }

  return {
    acquire(key, build) {
      let entry = entries.get(key)
      if (entry === undefined) {
        const geometry = build()
        entry = { geometry, uses: 0, retained: false, idleSince: 0, ...markPooled(geometry, key, 'geometry') }
        entries.set(key, entry)
      }
      entry.uses++
      return entry.geometry
    },
    release(geometry) {
      const key = pooledKey(geometry)
      const entry = key === undefined ? undefined : entries.get(key)
      if (entry === undefined || entry.uses === 0) return
      entry.uses--
      if (entry.uses === 0) entry.idleSince = ++clock
    },
    retain(key) {
      const entry = entries.get(key)
      if (entry !== undefined) entry.retained = true
    },
    trim(keep = 0) {
      const idle = [...entries].filter(([, entry]) => entry.uses === 0 && !entry.retained).sort((a, b) => a[1].idleSince - b[1].idleSince)
      const excess = idle.slice(0, Math.max(0, idle.length - keep))
      for (const [key, entry] of excess) disposeEntry(key, entry)
      return excess.length
    },
    stats() {
      const all = [...entries.values()]
      return { entries: all.length, retained: all.filter((entry) => entry.retained).length, inUse: all.filter((entry) => entry.uses > 0).length }
    },
    dispose() {
      for (const [key, entry] of [...entries]) disposeEntry(key, entry)
    },
  }
}
