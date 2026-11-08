import eventData from '../data/event-effects.json'

/** What a game event looks like to the map: the kind of event and the little that picks its effect. */
export interface GameEvent {
  /** `spall`, `stage`, `expose`, `collapse`, `explode`, `fracture`... (strings, so there is no compile dependency on the destruction package). */
  readonly kind: string
  /** The stage of a `stage` event (1, 2 or 3). */
  readonly stage?: number
  /**
   * The material of a `spall` or `fracture` event; for a `stage`, `collapse` or `expose` event the family of the material that broke (`DEBRIS_EFFECT_FAMILIES`:
   * `wood`, `masonry`, `glass`, `metal`, `soft`, `soil`), so the stone dust of a breach is not raised by a wooden wall.
   */
  readonly material?: string
}

type EventMap = Readonly<Record<string, string | Readonly<Record<string, string>>>>

export const EVENT_EFFECTS_MAP: EventMap = eventData

/**
 * The effect id that plays for an event (`undefined` when the map has none). A string entry may use `{material}`; an object entry is chosen by the event's
 * stage or material, and its value may use `{material}` too. A game passes its own map to add or change entries.
 */
export function effectForEvent(event: GameEvent, map: EventMap = EVENT_EFFECTS_MAP): string | undefined {
  const entry = map[event.kind]
  if (entry === undefined) return undefined
  if (typeof entry === 'string') return withMaterial(entry, event.material)
  const key = event.stage !== undefined ? String(event.stage) : event.material
  const chosen = key === undefined ? undefined : entry[key]
  return chosen === undefined ? undefined : withMaterial(chosen, event.material)
}

/** Fills the `{material}` of an entry; an entry that needs a material and has none plays nothing. */
function withMaterial(entry: string, material: string | undefined): string | undefined {
  if (!entry.includes('{material}')) return entry
  return material ? entry.replace('{material}', material) : undefined
}
