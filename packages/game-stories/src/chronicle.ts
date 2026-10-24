import type { ChronicleEntry } from './types'

/** The world's chronicle: every story beat and every rule of the life simulation that happened, in order. */
export type Chronicle = {
  readonly entries: readonly ChronicleEntry[]
  add(entry: ChronicleEntry): void
  /** The lines of one day. */
  onDay(day: number): readonly ChronicleEntry[]
  /** The lines about a person: those that name them or change them. */
  about(id: string): readonly ChronicleEntry[]
  /** The lines up to a day. */
  until(day: number): readonly ChronicleEntry[]
  /** Follows the new lines. Returns the unsubscribe function. */
  on(listener: (entry: ChronicleEntry) => void): () => void
}

export function createChronicle(): Chronicle {
  const entries: ChronicleEntry[] = []
  const listeners = new Set<(entry: ChronicleEntry) => void>()
  return {
    entries,
    add(entry) {
      entries.push(entry)
      for (const listener of listeners) listener(entry)
    },
    onDay: (day) => entries.filter((entry) => entry.day === day),
    about: (id) => entries.filter((entry) => entry.people.includes(id) || entry.changes.some((change) => change.id === id)),
    until: (day) => entries.filter((entry) => entry.day <= day),
    on(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}
