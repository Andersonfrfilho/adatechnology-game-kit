import type { LightAllowance } from './types'

/** The team's counter: `take()` is `left-- > 0`, so the count keeps falling after the allowance is spent. */
export function createLightAllowance(count: number): LightAllowance {
  const allowance: LightAllowance = {
    left: count,
    take() {
      return allowance.left-- > 0
    },
  }
  return allowance
}

/** @deprecated Renamed `createLightAllowance`: `LightBudget` is the name of the render budget of `@adatechnology/game-render-three`. Removed in the next major. */
export const createLightBudget = createLightAllowance
