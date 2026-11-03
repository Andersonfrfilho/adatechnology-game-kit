import { checkDestructible as check } from '@adatechnology/game-contracts'
import type { CheckOptions as ContractCheckOptions, CostOptions, DestructibleImpl } from '@adatechnology/game-contracts'
import { MATERIALS } from './materials'

// The contract itself lives in @adatechnology/game-contracts (a module depends only on that); re-exported here so that no import breaks.
export { IMPACT_CONTRACT, checkHit } from '@adatechnology/game-contracts'
export type { DestructibleImpl, ImpactContract } from '@adatechnology/game-contracts'

export interface CheckOptions {
  /** Ids of custom materials the impl uses besides the built-in `MATERIALS`. */
  materials?: string[]
  /** Opt-in cost measurement of `state()` and `describe()` (D8). */
  cost?: boolean | CostOptions
}

/**
 * `checkDestructible` of `@adatechnology/game-contracts`, with the built-in `MATERIALS` (plus `options.materials`) as the known material ids.
 * It hits the impl (and calls `reset()` afterwards when there is one).
 */
export const checkDestructible = (impl: DestructibleImpl, options: CheckOptions = {}): { ok: boolean; problems: string[] } => {
  const contractOptions: ContractCheckOptions = { materials: [...MATERIALS.map((m) => m.id), ...(options.materials ?? [])], ...(options.cost === undefined ? {} : { cost: options.cost }) }
  return check(impl, contractOptions)
}
