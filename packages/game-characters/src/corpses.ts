import type { CorpseOptions } from './types'

export type CorpseEntry<TData> = {
  /** Stable while it lasts, never reused (a counter): the ledger swaps the removed for the last and overwrites the oldest when full, so an index names no corpse for long. */
  readonly id: number
  /** Seconds since it fell. */
  age: number
  readonly data: TData
}

/** Why a corpse left the ledger: past its life, taken away (eaten, dragged off), overwritten by a new one when the ledger was full, or the ledger was cleared. */
export type CorpseRemoval = 'expired' | 'taken' | 'replaced' | 'cleared'

/** What follows the ledger: the body a corpse has in the physics world is made and removed by these. Called as it happens, in the ledger's order. */
export type CorpseListener<TData> = {
  readonly added?: (entry: CorpseEntry<TData>) => void
  readonly removed?: (entry: CorpseEntry<TData>, reason: CorpseRemoval) => void
}

export type CorpseLedger<TData> = {
  readonly entries: readonly CorpseEntry<TData>[]
  readonly count: number
  /** Adds a corpse; when the ledger is full the oldest one is replaced. Returns the replaced data, if any. */
  add(data: TData): TData | undefined
  /** Ages every corpse by `dt` seconds and removes the ones past their life (swap with the last, like the game). Returns the removed data. */
  update(dt: number): TData[]
  /** Takes one corpse away (eaten, searched and dragged off): the last one moves into its place, like the game's `CP`. Returns its data. */
  remove(index: number): TData | undefined
  clear(): void
  /** Puts new data on the corpse `id` (it was pushed and lies elsewhere): same id, same age, same place in the list. False when no corpse has that id. */
  replace(id: number, data: TData): boolean
  /** `listener` hears every add and removal from now on; returns the call that stops it. */
  subscribe(listener: CorpseListener<TData>): () => void
}

/** The bodies left on the ground: capped (400) and gone after a lifetime (900 s); generic over what each one carries. */
export const createCorpseLedger = <TData>(options: CorpseOptions): CorpseLedger<TData> => {
  const entries: CorpseEntry<TData>[] = []
  const listeners = new Set<CorpseListener<TData>>()
  let nextId = 1
  const announceAdded = (entry: CorpseEntry<TData>): void => {
    for (const listener of listeners) listener.added?.(entry)
  }
  const announceRemoved = (entry: CorpseEntry<TData>, reason: CorpseRemoval): void => {
    for (const listener of listeners) listener.removed?.(entry, reason)
  }
  return {
    entries,
    get count() {
      return entries.length
    },
    add(data) {
      if (entries.length < options.max) {
        const added = { id: nextId++, age: 0, data }
        entries.push(added)
        announceAdded(added)
        return undefined
      }
      let oldest = 0
      for (let index = 1; index < entries.length; index++) if ((entries[index] as CorpseEntry<TData>).age > (entries[oldest] as CorpseEntry<TData>).age) oldest = index
      const evicted = entries[oldest] as CorpseEntry<TData>
      const added = { id: nextId++, age: 0, data }
      entries[oldest] = added
      announceRemoved(evicted, 'replaced')
      announceAdded(added)
      return evicted.data
    },
    update(dt) {
      const removed: TData[] = []
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index] as CorpseEntry<TData>
        entry.age += dt
        if (entry.age <= options.seconds) continue
        removed.push(entry.data)
        entries[index] = entries[entries.length - 1] as CorpseEntry<TData>
        entries.pop()
        announceRemoved(entry, 'expired')
        index--
      }
      return removed
    },
    remove(index) {
      const entry = entries[index]
      if (!entry) return undefined
      entries[index] = entries[entries.length - 1] as CorpseEntry<TData>
      entries.pop()
      announceRemoved(entry, 'taken')
      return entry.data
    },
    clear() {
      const gone = entries.splice(0)
      for (const entry of gone) announceRemoved(entry, 'cleared')
    },
    replace(id, data) {
      const index = entries.findIndex((entry) => entry.id === id)
      if (index < 0) return false
      entries[index] = { ...(entries[index] as CorpseEntry<TData>), data }
      return true
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}
