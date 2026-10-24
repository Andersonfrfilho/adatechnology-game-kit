import eventData from '../data/event-effects.json'

/** What a game event looks like to the map: the kind of event and the little that picks its effect. */
export interface GameEvent {
  /** `spall`, `stage`, `expose`, `collapse`, `explode`, `fracture`... (strings, so there is no compile dependency on the destruction package). */
  readonly kind: string
  /** The stage of a `stage` event (1, 2 or 3). */
  readonly stage?: number
  /** The material of a `spall` or `fracture` event. */
  readonly material?: string
}

type EventMap = Readonly<Record<string, string | Readonly<Record<string, string>>>>

export const EVENT_EFFECTS_MAP: EventMap = eventData

/**
 * The effect id that plays for an event (`undefined` when the map has none). A string entry may use `{material}`; an object entry is chosen by the event's
 * stage or material. A game passes its own map to add or change entries.
 */
export function effectForEvent(event: GameEvent, map: EventMap = EVENT_EFFECTS_MAP): string | undefined {
  const entry = map[event.kind]
  if (entry === undefined) return undefined
  if (typeof entry === 'string') return event.material || !entry.includes('{material}') ? entry.replace('{material}', event.material ?? '') : undefined
  const key = event.stage !== undefined ? String(event.stage) : event.material
  return key === undefined ? undefined : entry[key]
}
