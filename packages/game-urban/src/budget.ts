import type { LightBudget } from './types'

/** The team's counter: `take()` is `left-- > 0`, so the count keeps falling after the budget is spent. */
export function createLightBudget(count: number): LightBudget {
  const budget: LightBudget = {
    left: count,
    take() {
      return budget.left-- > 0
    },
  }
  return budget
}
