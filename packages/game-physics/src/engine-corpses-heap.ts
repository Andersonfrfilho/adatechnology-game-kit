import type { CorpseRecord } from './engine-corpses-types'

interface Entry {
  readonly key: number
  readonly record: CorpseRecord
}

const before = (a: Entry, b: Entry): boolean => a.key < b.key || (a.key === b.key && a.record.id < b.record.id)

/** A min-heap of corpses by key (the lowest id among equals): the dormant ones wait in it for the interest to come near. An entry is stale once its record is not dormant at that key. */
export interface CorpseHeap {
  readonly size: number
  push(key: number, record: CorpseRecord): void
  /** The lowest key, or Infinity when empty. */
  peek(): number
  pop(): CorpseRecord | undefined
  clear(): void
}

export const createCorpseHeap = (): CorpseHeap => {
  const items: Entry[] = []
  const up = (from: number): void => {
    let at = from
    while (at > 0) {
      const parent = (at - 1) >> 1
      if (!before(items[at] as Entry, items[parent] as Entry)) return
      ;[items[at], items[parent]] = [items[parent] as Entry, items[at] as Entry]
      at = parent
    }
  }
  const down = (from: number): void => {
    let at = from
    for (;;) {
      const left = at * 2 + 1
      const right = left + 1
      let least = at
      if (left < items.length && before(items[left] as Entry, items[least] as Entry)) least = left
      if (right < items.length && before(items[right] as Entry, items[least] as Entry)) least = right
      if (least === at) return
      ;[items[at], items[least]] = [items[least] as Entry, items[at] as Entry]
      at = least
    }
  }
  return {
    get size() {
      return items.length
    },
    push(key, record) {
      items.push({ key, record })
      up(items.length - 1)
    },
    peek: () => items[0]?.key ?? Infinity,
    pop() {
      const top = items[0]
      const last = items.pop()
      if (!top || !last) return top?.record
      if (items.length > 0) {
        items[0] = last
        down(0)
      }
      return top.record
    },
    clear() {
      items.length = 0
    },
  }
}
