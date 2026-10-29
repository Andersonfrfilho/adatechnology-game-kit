import type { RunOverRules } from './arcade'
import { defaultArcadeSpec } from './arcade'

export type RunOverOutcome = 'push' | 'knock' | 'kill'

/** What a vehicle moving at `speed` (m/s) does to a body it touches: pushes it (and is held), knocks it down, or kills it. */
export function runOver(speed: number, rules: Partial<RunOverRules> = {}): RunOverOutcome {
  const { knockSpeed, killSpeed } = { ...defaultArcadeSpec.runOver, ...rules }
  const s = Math.abs(speed)
  return s > killSpeed ? 'kill' : s > knockSpeed ? 'knock' : 'push'
}
