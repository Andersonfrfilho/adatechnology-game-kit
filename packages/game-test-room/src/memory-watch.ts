/**
 * Watches what the room keeps after each clear (CLAUDE.md, "Memória"). Right after a clear the scene holds only the scenery, so the GPU counts of three
 * (geometries and textures alive, `renderer.info.memory`) should come back to the same level every time. A cache fills once (the first use of a
 * model, a palette); a leak grows on every clear. The watch warns when the counts grew on each of the last clears and, over them, by more than the
 * budget: something taken out of the scene was not released (`discardObject3D` / `releaseObject3D` of game-shapes-three) or a list still holds it.
 */
export interface MemorySample {
  readonly geometries: number
  readonly textures: number
  /** JS heap in MB, where the browser tells it (Chrome). Shown, never used to warn: without a forced GC it moves with the garbage. */
  readonly heapMB?: number
}

export interface MemoryWatchOptions {
  /** Reads the counts now. */
  readonly read: () => MemorySample | undefined
  /** How many clears in a row must each grow before the watch warns (default 4). */
  readonly clears?: number
  /** Growth over those clears that is a leak and not a cache (defaults: 40 geometries, 4 textures). */
  readonly budget?: { readonly geometries?: number; readonly textures?: number }
}

export interface MemoryVerdict {
  /** The counts right after the last clear. */
  readonly after: MemorySample
  /** Growth over the watched clears (last minus first). */
  readonly grew: { readonly geometries: number; readonly textures: number }
  /** True when the counts keep growing clear after clear past the budget. */
  readonly leaking: boolean
}

export interface MemoryWatch {
  /**
   * Call right after the room clears; returns the verdict, or undefined when the counts are not readable. `context` names what was on the table
   * (the area or bench): clears are compared only with clears of the same context, so visiting a new area (its caches filling) is not a leak.
   */
  cleared(context?: string): MemoryVerdict | undefined
  /** The last verdict (none before the first clear). */
  readonly last: MemoryVerdict | undefined
  /** Forgets every history. */
  reset(): void
}

export function createMemoryWatch(options: MemoryWatchOptions): MemoryWatch {
  const clears = Math.max(2, options.clears ?? 4)
  const budget = { geometries: options.budget?.geometries ?? 40, textures: options.budget?.textures ?? 4 }
  const histories = new Map<string, MemorySample[]>()
  let last: MemoryVerdict | undefined
  return {
    cleared(where) {
      const now = options.read()
      if (!now) return undefined
      const key = where ?? ''
      const history = histories.get(key) ?? []
      histories.set(key, history)
      history.push(now)
      if (history.length > clears + 1) history.shift()
      const first = history[0]
      const grew = { geometries: now.geometries - first.geometries, textures: now.textures - first.textures }
      let growing = history.length === clears + 1
      for (let i = 1; growing && i < history.length; i++) {
        const before = history[i - 1]
        const after = history[i]
        growing = after.geometries > before.geometries || after.textures > before.textures
      }
      const leaking = growing && (grew.geometries > budget.geometries || grew.textures > budget.textures)
      last = { after: now, grew, leaking }
      return last
    },
    get last() {
      return last
    },
    reset() {
      histories.clear()
      last = undefined
    },
  }
}
