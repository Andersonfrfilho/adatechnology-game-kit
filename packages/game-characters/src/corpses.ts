import type { CorpseOptions } from './types'

export type CorpseEntry<TData> = {
  /** Seconds since it fell. */
  age: number
  readonly data: TData
}

export type CorpseLedger<TData> = {
  readonly entries: readonly CorpseEntry<TData>[]
  readonly count: number
  /** Adds a corpse; when the ledger is full the oldest one is replaced. Returns the replaced data, if any. */
  add(data: TData): TData | undefined
  /** Ages every corpse by `dt` seconds and removes the ones past their life (swap with the last, like the game). Returns the removed data. */
  update(dt: number): TData[]
  clear(): void
}

/** The bodies left on the ground: capped (400) and gone after a lifetime (900 s); generic over what each one carries. */
export const createCorpseLedger = <TData>(options: CorpseOptions): CorpseLedger<TData> => {
  const entries: CorpseEntry<TData>[] = []
  return {
    entries,
    get count() {
      return entries.length
    },
    add(data) {
      if (entries.length < options.max) {
        entries.push({ age: 0, data })
        return undefined
      }
      let oldest = 0
      for (let index = 1; index < entries.length; index++) if ((entries[index] as CorpseEntry<TData>).age > (entries[oldest] as CorpseEntry<TData>).age) oldest = index
      const replaced = (entries[oldest] as CorpseEntry<TData>).data
      entries[oldest] = { age: 0, data }
      return replaced
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
        index--
      }
      return removed
    },
    clear() {
      entries.length = 0
    },
  }
}
