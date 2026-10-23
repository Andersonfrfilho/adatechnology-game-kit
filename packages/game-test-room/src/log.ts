import type { LogEntry, NewLogEntry, TestRoomLog } from './types'

export type NewEntry = NewLogEntry

/** The log the room writes to (a `TestRoomLog` plus the write side). */
export interface WritableLog extends TestRoomLog {
  /** Called before every read, so pending work (the room batches events per frame) is flushed first. */
  setBeforeRead(fn: (() => void) | null): void
  setClock(fn: () => number): void
}

const MAX_ENTRIES = 5000

const pad = (n: number, w = 2): string => String(n).padStart(w, '0')

/** `00:03.21` style clock for the text export. */
export const formatTime = (t: number): string => {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${pad(m)}:${s.toFixed(2).padStart(5, '0')}`
}

export function createLog(): WritableLog {
  let list: LogEntry[] = []
  let seq = 0
  let clock = (): number => 0
  let beforeRead: (() => void) | null = null
  const listeners = new Set<(entry: LogEntry, updated: boolean) => void>()
  const keyed = new Map<string, { entry: LogEntry; last: number; count: number }>()

  const read = (): LogEntry[] => {
    beforeRead?.()
    return list
  }
  const emit = (e: LogEntry, updated: boolean): void => {
    for (const fn of listeners) {
      try {
        fn(e, updated)
      } catch {
        // a broken listener must not break the room
      }
    }
  }

  const add = (entry: NewEntry): LogEntry => {
    const { t, ...rest } = entry
    const e: LogEntry = { seq: seq++, t: Math.round((t ?? clock()) * 1000) / 1000, ...rest }
    list.push(e)
    if (list.length > MAX_ENTRIES) list = list.slice(list.length - MAX_ENTRIES)
    emit(e, false)
    return e
  }

  const log: WritableLog = {
    add,
    coalesce(key, entry, windowS = 1) {
      const now = entry.t ?? clock()
      const k = keyed.get(key)
      if (k && now - k.last <= windowS && list.includes(k.entry)) {
        const { t: _t, ...rest } = entry
        k.count++
        Object.assign(k.entry, rest)
        k.entry.data = { ...(rest.data ?? {}), updates: k.count }
        k.last = now
        emit(k.entry, true)
        return k.entry
      }
      const e = add(entry)
      keyed.set(key, { entry: e, last: now, count: 1 })
      return e
    },
    setBeforeRead(fn) {
      beforeRead = fn
    },
    setClock(fn) {
      clock = fn
    },
    entries(filter) {
      const all = read()
      if (!filter) return all.slice()
      return all.filter(
        (e) =>
          (!filter.channel || e.channel === filter.channel) && (!filter.type || e.type === filter.type) && (!filter.objectId || e.objectId === filter.objectId),
      )
    },
    clear() {
      beforeRead?.()
      list = []
      keyed.clear()
    },
    toJSON: () => JSON.stringify(read(), null, 2),
    toNDJSON: () => read().map((e) => JSON.stringify(e)).join('\n') + (list.length ? '\n' : ''),
    toText: () => read().map((e) => `[${formatTime(e.t)}] ${e.channel.padEnd(6)} ${e.text}`).join('\n'),
    download(format = 'ndjson') {
      if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return
      const body = format === 'json' ? log.toJSON() : format === 'txt' ? log.toText() : log.toNDJSON()
      const mime = format === 'json' ? 'application/json' : 'text/plain'
      const url = URL.createObjectURL(new Blob([body], { type: mime }))
      const a = document.createElement('a')
      a.href = url
      a.download = `test-room-log.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
    summary() {
      const byType: Record<string, number> = {}
      const byMaterial: Record<string, number> = {}
      const objects = new Set<string>()
      let destroyed = 0
      for (const e of read()) {
        byType[e.type] = (byType[e.type] ?? 0) + 1
        if (e.material) byMaterial[e.material] = (byMaterial[e.material] ?? 0) + 1
        if (e.objectId) objects.add(e.objectId)
        if (e.type === 'destroyed') destroyed++
      }
      return { byType, byMaterial, objects: objects.size, destroyed }
    },
    on(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
  return log
}
