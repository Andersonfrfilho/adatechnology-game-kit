import type { LightBudget } from './types'

/** For adapters that receive the budget as `unknown` through the host (the contract does not know three). */
export function isLightBudget(value: unknown): value is LightBudget {
  const candidate = value as Partial<LightBudget> | null | undefined
  return typeof candidate === 'object' && candidate !== null && typeof candidate.acquire === 'function' && typeof candidate.addSource === 'function' && typeof candidate.lease === 'function' && typeof candidate.present === 'function'
}
