import climatesJson from './data/climates.json'
import statesJson from './data/states.json'
import type { Climate, DeepPartial, WeatherState } from './types'

export const WEATHER_STATES: readonly WeatherState[] = statesJson as unknown as readonly WeatherState[]
export const CLIMATES: readonly Climate[] = climatesJson as unknown as readonly Climate[]

export type RegistryOptions = {
  /** Added to the shipped states or, when the id exists, replacing it. */
  readonly states?: readonly WeatherState[]
  readonly climates?: readonly Climate[]
  /** Merged into a shipped or added entry by id; a patch for an id that does not exist is ignored. */
  readonly patch?: {
    readonly states?: Readonly<Record<string, DeepPartial<WeatherState>>>
    readonly climates?: Readonly<Record<string, DeepPartial<Climate>>>
  }
  readonly remove?: { readonly states?: readonly string[]; readonly climates?: readonly string[] }
}

export type WeatherRegistry = {
  state(id: string): WeatherState | undefined
  climate(id: string): Climate | undefined
  stateIds(): string[]
  climateIds(): string[]
  registerState(state: WeatherState): void
  registerClimate(climate: Climate): void
  patchState(id: string, patch: DeepPartial<WeatherState>): void
  patchClimate(id: string, patch: DeepPartial<Climate>): void
  removeState(id: string): void
  removeClimate(id: string): void
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeRecords(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const current = merged[key]
    merged[key] = isPlainObject(current) && isPlainObject(value) ? mergeRecords(current, value) : value
  }
  return merged
}

function deepMerge<TValue>(base: TValue, patch: DeepPartial<TValue>): TValue {
  return mergeRecords(base as Record<string, unknown>, patch as Record<string, unknown>) as TValue
}

type Entry = { readonly id: string }

function createTable<TEntry extends Entry>(shipped: readonly TEntry[]): Map<string, TEntry> {
  return new Map(shipped.map((entry) => [entry.id, entry]))
}

function patchEntry<TEntry extends Entry>(table: Map<string, TEntry>, id: string, patch: DeepPartial<TEntry>): void {
  const entry = table.get(id)
  if (entry) table.set(id, deepMerge(entry, patch))
}

/** The shipped states and climates with yours added, patched or removed; change it later with the same verbs. */
export function createWeatherRegistry(options: RegistryOptions = {}): WeatherRegistry {
  const states = createTable(WEATHER_STATES)
  const climates = createTable(CLIMATES)
  for (const state of options.states ?? []) states.set(state.id, state)
  for (const climate of options.climates ?? []) climates.set(climate.id, climate)
  for (const [id, patch] of Object.entries(options.patch?.states ?? {})) patchEntry(states, id, patch)
  for (const [id, patch] of Object.entries(options.patch?.climates ?? {})) patchEntry(climates, id, patch)
  for (const id of options.remove?.states ?? []) states.delete(id)
  for (const id of options.remove?.climates ?? []) climates.delete(id)
  return {
    state: (id) => states.get(id),
    climate: (id) => climates.get(id),
    stateIds: () => [...states.keys()],
    climateIds: () => [...climates.keys()],
    registerState: (state) => void states.set(state.id, state),
    registerClimate: (climate) => void climates.set(climate.id, climate),
    patchState: (id, patch) => patchEntry(states, id, patch),
    patchClimate: (id, patch) => patchEntry(climates, id, patch),
    removeState: (id) => void states.delete(id),
    removeClimate: (id) => void climates.delete(id),
  }
}
