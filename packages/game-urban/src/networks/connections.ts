import type { UtilityConnection, UtilityNetwork } from '@adatechnology/game-contracts'

import { worldOf } from './frame'
import type { NetworkRules } from './rules'
import type { ServedLot } from './runs'

export type GroundAt = (x: number, z: number) => number

/**
 * Where a lot takes each network when it declares none, from its rectangle and the street it faces: the meter post (power, telecom 0.6 m
 * under it) and the water stand behind the front wall, the inspection box 1 m inside the front, the downspout outlet at the kerb.
 */
export function defaultConnectionsOf({ served, rules, groundAt, buried = false }: { readonly served: ServedLot; readonly rules: NetworkRules; readonly groundAt: GroundAt; readonly buried?: boolean }): UtilityConnection[] {
  const { run, side, span, front, lot } = served
  const rule = rules.layout.connection
  const within = (u: number): number => Math.min(Math.max(u, span[0]), span[1])
  const centre = (span[0] + span[1]) / 2
  const at = (u: number, v: number, above: number): readonly [number, number, number] => {
    const [x, z] = worldOf({ frame: run, u: within(u), v })
    return [x, groundAt(x, z) + above, z]
  }
  const wall = side * (front + rule.frontInset)
  const sewer = at(centre, side * (front + rule.sewerInset), 0)
  const base = { lot: lot.id, frame: 'world' as const }
  // on an underground street the meter box sits low on the front wall and its lateral comes in under the ground, the telecom box beside it
  const power = buried ? at(span[0] + rule.meterFromSide, wall, 0) : at(span[0] + rule.meterFromSide, wall, rule.powerHeight)
  const telecom = buried ? at(span[0] + rule.meterFromSide + rule.telecomBesidePower, wall, 0) : at(span[0] + rule.meterFromSide, wall, rule.powerHeight - rule.telecomBelowPower)
  return [
    { ...base, network: 'power', at: power },
    { ...base, network: 'telecom', at: telecom },
    { ...base, network: 'sewer', at: sewer, invert: sewer[1] - sewerDepthOf({ rules, length: front + rule.sewerInset - rules.layout.sewer.dropOffset }) },
    { ...base, network: 'storm', at: at(span[1] - rule.downspoutFromSide, side * (run.width / 2), 0) },
    { ...base, network: 'water', at: at(span[0] + rule.waterFromSide, wall, 0) },
  ]
}

/**
 * The depth of a lot's inspection box outlet: the usual one, shallower for a lot set back from its street, so its lateral still crosses
 * the gallery within `lateralOverGallery` at its least slope (never under `sewerLeastDepth`).
 */
function sewerDepthOf({ rules, length }: { readonly rules: NetworkRules; readonly length: number }): number {
  const { connection, slopeMargin, coverMargin } = rules.layout
  const fits = rules.sewer.lateralOverGallery - coverMargin - (rules.minSlope.sewer_lateral + slopeMargin) * length
  return Math.max(connection.sewerLeastDepth, Math.min(connection.sewerDepth, fits))
}

/** The connections of every served lot: the ones a lot declared, and the defaults for the networks it declared none of. */
export type LotConnectionsParams = {
  readonly served: readonly ServedLot[]
  readonly declared: readonly UtilityConnection[]
  readonly rules: NetworkRules
  readonly groundAt: GroundAt
  /** Lots on a street whose power runs underground: their default meter and telecom box sit at the ground. */
  readonly buried?: ReadonlySet<string>
}

export function lotConnectionsOf({ served, declared, rules, groundAt, buried }: LotConnectionsParams): UtilityConnection[] {
  const own = new Map(declared.map((connection) => [`${connection.lot}:${connection.network}`, connection]))
  return served.flatMap((entry) => defaultConnectionsOf({ served: entry, rules, groundAt, buried: buried?.has(entry.lot.id) ?? false }).map((fallback) => own.get(`${entry.lot.id}:${fallback.network}`) ?? fallback))
}

/** The connections of one network. */
export const ofNetwork = ({ connections, network }: { readonly connections: readonly UtilityConnection[]; readonly network: UtilityNetwork }): UtilityConnection[] =>
  connections.filter((connection) => connection.network === network)
