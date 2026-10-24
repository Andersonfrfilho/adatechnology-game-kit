/** The weather, light and ground as the world is right now. Written by whoever drives the weather, read by whoever reacts to it. */
export interface EnvironmentState {
  /** Rain in mm/h; 0 is dry. */
  readonly rain: number
  /** Wind in m/s along x and z, and its strength (the length of that vector). */
  readonly windX: number
  readonly windZ: number
  readonly windSpeed: number
  /** Strongest gust in m/s. */
  readonly gust: number
  /** Render fog far distance in metres. */
  readonly fogFar: number
  /** How far one can see for gameplay, in metres (not the render fog). */
  readonly visibility: number
  /** 0 is full daylight, 1 is the darkest night. */
  readonly nightFactor: number
  readonly temperatureC: number
  /** Wet ground, 0..1: rises with rain and dries after it stops. */
  readonly wetness: number
}

export type EnvironmentKey = keyof EnvironmentState

/** A calm dry day (the normal world, before anything went wrong). */
export const DEFAULT_ENVIRONMENT: EnvironmentState = {
  rain: 0,
  windX: 0,
  windZ: 0,
  windSpeed: 0,
  gust: 0,
  fogFar: 220,
  visibility: 220,
  nightFactor: 0,
  temperatureC: 20,
  wetness: 0,
}

/** The host's environment (`ModuleHost.environment`): a store the weather module writes to and the others read. */
export interface EnvironmentBus {
  get(): EnvironmentState
  /** Merges `patch` into the state; listeners hear it only when a value really changed. */
  set(patch: Partial<EnvironmentState>): void
  /** Hears every change with the keys that changed. Returns the unsubscribe function. */
  on(listener: (state: EnvironmentState, changed: readonly EnvironmentKey[]) => void): () => void
}

/** A plain store that implements the bus; the test room and tests use it, a game may bring its own. */
export function createEnvironmentBus(initial: Partial<EnvironmentState> = {}): EnvironmentBus {
  let state: EnvironmentState = { ...DEFAULT_ENVIRONMENT, ...initial }
  const listeners = new Set<(state: EnvironmentState, changed: readonly EnvironmentKey[]) => void>()
  return {
    get: () => state,
    set(patch) {
      const changed = (Object.keys(patch) as EnvironmentKey[]).filter((key) => patch[key] !== undefined && patch[key] !== state[key])
      if (changed.length === 0) return
      const next = { ...state } as { -readonly [Key in EnvironmentKey]: number }
      for (const key of changed) next[key] = patch[key] as number
      state = next
      for (const listener of [...listeners]) listener(state, changed)
    },
    on(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}
