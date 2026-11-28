import { twistStroke } from '@adatechnology/game-contracts'
import type { ItemUseDef, TwistStroke } from '@adatechnology/game-contracts'

/**
 * Where the opening use (`ModuleItemSeal.openUse`) is at `time`: the hand's stroke over its `turn` keys (`twistStroke`), then the part rising off until its
 * `open` key (or its end).
 */
export const openingProgress = (def: ItemUseDef, time: number): { stroke: TwistStroke; lift: number } => {
  const keys = [...def.keys].sort((a, b) => a.t - b.t)
  const turning = keys.findIndex((k) => k.action === 'turn')
  const lastTurn = keys.map((k) => k.action).lastIndexOf('turn')
  const start = turning >= 0 ? keys[turning]!.t : 0
  const end = lastTurn >= 0 ? (keys[lastTurn + 1]?.t ?? def.duration) : start
  const openAt = keys.find((k) => k.action === 'open')?.t ?? def.duration
  const share = end > start ? (time - start) / (end - start) : 1
  const lift = time <= end ? 0 : openAt > end ? Math.min(1, (time - end) / (openAt - end)) : 1
  return { stroke: twistStroke(share), lift }
}
