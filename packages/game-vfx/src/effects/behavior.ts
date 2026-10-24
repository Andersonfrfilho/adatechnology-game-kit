import type { WorkshopEngine } from '../workshop/engine'
import type { EffectView } from './instance'

/** What a prop model may read and write: the engine, the camera, the effect's variables and its clock. */
export interface BehaviorHost {
  readonly engine: WorkshopEngine
  readonly camera: EffectView
  readonly variables: Map<string, unknown>
  readonly param: number
  /** Seconds since the effect started. */
  readonly time: number
  /** Schedules `action` at `seconds` after the start (the page's `at`). */
  after(seconds: number, action: () => void): void
}

/**
 * A prop the page animates by hand (a walking zombie, a car, a bottle in flight): the part of that motion a spawn position or a random draw depends on,
 * ported as a small deterministic model. A recipe calls it with `{ op: 'behavior', id, action }`; it is reset when an effect starts and updated every
 * frame after the effect's own tick (`updateZombie` runs there in the page's loop).
 */
export interface Behavior {
  reset(host: BehaviorHost): void
  act(host: BehaviorHost, action: string, args: unknown): void
  /** Reads something off the prop (`{ $: 'query', a: [id, name, ...] }` in a recipe). */
  query(host: BehaviorHost, name: string, args: readonly unknown[]): unknown
  update(host: BehaviorHost, dt: number, elapsed: number): void
}
