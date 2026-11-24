import type { UtilityConnection, UtilityNetwork } from '@adatechnology/game-contracts'

import { worldOf } from './frame'
import type { NetworkLayoutRules } from './layout-rules'
import type { ServedLot } from './runs'

export type GroundAt = (x: number, z: number) => number

/**
 * Where a lot takes each network when it declares none, from its rectangle and the street it faces: the meter post (power, telecom 0.6 m
 * under it) and the water stand behind the front wall, the inspection box 1 m inside the front, the downspout outlet at the kerb.
 */
export function defaultConnectionsOf(served: ServedLot, rules: NetworkLayoutRules, groundAt: GroundAt): UtilityConnection[] {
  const { run, side, span, front, lot } = served
  const rule = rules.connection
  const within = (u: number): number => Math.min(Math.max(u, span[0]), span[1])
  const centre = (span[0] + span[1]) / 2
  const at = (u: number, v: number, above: number): readonly [number, number, number] => {
    const [x, z] = worldOf(run.along, run.axis, within(u), v)
    return [x, groundAt(x, z) + above, z]
  }
  const wall = side * (front + rule.frontInset)
  const sewer = at(centre, side * (front + rule.sewerInset), 0)
  const base = { lot: lot.id, frame: 'world' as const }
  return [
    { ...base, network: 'power', at: at(span[0] + rule.meterFromSide, wall, rule.powerHeight) },
    { ...base, network: 'telecom', at: at(span[0] + rule.meterFromSide, wall, rule.powerHeight - rule.telecomBelowPower) },
    { ...base, network: 'sewer', at: sewer, invert: sewer[1] - rule.sewerDepth },
    { ...base, network: 'storm', at: at(span[1] - rule.downspoutFromSide, side * (run.width / 2), 0) },
    { ...base, network: 'water', at: at(span[0] + rule.waterFromSide, wall, 0) },
  ]
}

/** The connections of every served lot: the ones a lot declared, and the defaults for the networks it declared none of. */
export function lotConnectionsOf(served: readonly ServedLot[], declared: readonly UtilityConnection[], rules: NetworkLayoutRules, groundAt: GroundAt): UtilityConnection[] {
  const own = new Map(declared.map((connection) => [`${connection.lot}:${connection.network}`, connection]))
  return served.flatMap((entry) => defaultConnectionsOf(entry, rules, groundAt).map((fallback) => own.get(`${entry.lot.id}:${fallback.network}`) ?? fallback))
}

/** The connections of one network. */
export const ofNetwork = (connections: readonly UtilityConnection[], network: UtilityNetwork): UtilityConnection[] => connections.filter((connection) => connection.network === network)
