import type { EventValue, GoldenEvent } from './types'

export type EventRecorder = {
  readonly record: (type: string, data?: { readonly [key: string]: EventValue }) => void
  /** A copy of the events recorded so far, in order. */
  readonly events: () => readonly GoldenEvent[]
}

const EVENT_PRECISION = 4

function roundEventValue(value: EventValue): EventValue {
  if (typeof value === 'number') return Math.round(value * 10 ** EVENT_PRECISION) / 10 ** EVENT_PRECISION + 0
  if (Array.isArray(value)) return (value as readonly EventValue[]).map(roundEventValue)
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as { readonly [key: string]: EventValue })
    return Object.fromEntries(entries.map(([key, entry]) => [key, roundEventValue(entry)]))
  }
  return value
}

/** Collects the events a page emits or a caller instruments (shot, reload, break...), rounding numbers so the golden is stable. */
export function createEventRecorder(): EventRecorder {
  const recorded: GoldenEvent[] = []
  return {
    record(type, data) {
      recorded.push(data ? { type, data: roundEventValue(data) as GoldenEvent['data'] } : { type })
    },
    events: () => [...recorded],
  }
}
