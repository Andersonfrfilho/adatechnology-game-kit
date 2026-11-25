import type { UtilityConnection } from '@adatechnology/game-contracts'

import type { BuriedContext } from './buried'
import type { ChainStop } from './chain'
import { frameOf, worldOf } from './frame'
import { piecesOf } from './pole-layout'
import { diversifiedDemand, pickTransformer } from './rules'
import type { TransformerRating } from './rules'
import type { ServedLot, StreetRun } from './runs'

/** A light column on the far sidewalk and the station of its box on the bank. */
export type UndergroundLight = { readonly key: string; readonly run: StreetRun; readonly u: number; readonly at: readonly [number, number]; readonly lamp: readonly [number, number] }

/** A lot on an underground street: its box's key and station, and its power and telecom points. */
export type UndergroundLot = { readonly key: string; readonly served: ServedLot; readonly u: number; readonly power?: UtilityConnection; readonly telecom?: UtilityConnection }

/** A low voltage circuit: its pad-mounted transformer at a box between two of its lots, the lots and the light columns it feeds. */
export type UndergroundCircuit = {
  readonly run: StreetRun
  readonly padKey: string
  readonly rating: TransformerRating
  readonly lots: readonly UndergroundLot[]
  /** Keys of the boxes the circuit's low voltage reaches: its lots' and its lights'. */
  readonly members: readonly string[]
  readonly stops: readonly ChainStop[]
}

export type LightsParams = { readonly context: BuriedContext; readonly run: StreetRun; readonly canStand: (x: number, z: number) => boolean; readonly crossings: readonly number[]; readonly lampReach: number }

/** Light columns along every stretch of the street between crossings, about `lightSpacing` apart, slid clear of gates and of the pipes that cross the street. */
export function lightsOfRun({ context, run, canStand, crossings, lampReach }: LightsParams): UndergroundLight[] {
  const { underground } = context.rules.layout
  const side = context.sides.get(run.id) ?? -1
  const v = side * (run.width / 2 + underground.lightFromKerb)
  return piecesOf(run).flatMap((piece, pieceIndex) => {
    const length = piece.to - piece.from
    const count = Math.max(1, Math.round(length / underground.lightSpacing))
    return Array.from({ length: count }, (_, index): UndergroundLight[] => {
      const target = piece.from + ((index + 0.5) * length) / count
      for (let step = 0; step <= 24; step++) {
        const u = target + (step % 2 === 0 ? 1 : -1) * Math.ceil(step / 2) * 0.25
        if (u < piece.from + 1 || u > piece.to - 1) continue
        const at = worldOf({ frame: run, u, v })
        if (!canStand(at[0], at[1]) || crossings.some((other) => Math.abs(other - u) < underground.lateralGap)) continue
        return [{ key: `light:${run.id}:${pieceIndex}:${index}`, run, u, at, lamp: worldOf({ frame: run, u, v: v - side * lampReach }) }]
      }
      return []
    }).flat()
  })
}

/** The lots of a street that take power or telecom from it, by station. */
/**
 * The station of a lot's box: across from its meter, or stepped away from the nearest pipe that leaves the street within `gap` of it (on the
 * side away from it, so the lateral never crosses that pipe), in 0.1 m steps until it and the lateral's middle clear every other, at most 3 m.
 */
function clearStation({ target, others, gap }: { readonly target: number; readonly others: readonly number[]; readonly gap: number }): number {
  const nearest = [...others].sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0]
  if (nearest === undefined || Math.abs(nearest - target) >= gap) return target
  const away = Math.sign(target - nearest) || 1
  // the lateral runs from the box to the meter: halfway along it, it keeps half the gap too
  const clear = (u: number): boolean => others.every((other) => Math.abs(other - u) >= gap && Math.abs(other - (u + target) / 2) >= gap / 2)
  for (let step = 1; step <= 30; step++) {
    const u = target + away * step * 0.1
    if (clear(u)) return u
  }
  return target + away * gap
}

function lotsOf({ context, run, connections }: { readonly context: BuriedContext; readonly run: StreetRun; readonly connections: readonly UtilityConnection[] }): UndergroundLot[] {
  return [...context.served.values()]
    .filter((served) => served.run.id === run.id)
    .flatMap((served): UndergroundLot[] => {
      const power = connections.find((connection) => connection.lot === served.lot.id && connection.network === 'power')
      const telecom = connections.find((connection) => connection.lot === served.lot.id && connection.network === 'telecom')
      const anchor = power ?? telecom
      if (anchor === undefined) return []
      const along = (connection: UtilityConnection): number => frameOf({ frame: run, x: connection.at[0], z: connection.at[2] })[0]
      // the box stands across from the meter, unless another pipe leaves the street at nearly the same station (this lot's water or sewer, a
      // neighbour's across the street): then it steps aside, so the lateral never runs on their line
      const others = connections.filter((connection) => connection.network !== 'power' && connection.network !== 'telecom' && context.served.get(connection.lot)?.run.id === run.id).map(along)
      const u = clearStation({ target: along(anchor), others, gap: context.rules.layout.underground.lateralGap })
      return [{ key: `box:${served.lot.id}`, served, u, ...(power === undefined ? {} : { power }), ...(telecom === undefined ? {} : { telecom }) }]
    })
    .sort((a, b) => a.u - b.u)
}

type Group = { readonly lots: UndergroundLot[]; readonly lights: UndergroundLight[] }

/**
 * The circuits of each stretch of an underground street: its lots in order, as many to a circuit as the largest transformer carries (by the
 * diversified demand and the lamps) within the low voltage's reach each way; the pad between the two middle lots; each light column joins
 * the nearest circuit of its stretch. A circuit never spans a crossing.
 */
export type CircuitsParams = {
  readonly context: BuriedContext
  readonly run: StreetRun
  readonly connections: readonly UtilityConnection[]
  readonly lights: readonly UndergroundLight[]
  /** Stations of the pipes that cross the street: the pad's ducts keep clear of them. */
  readonly crossings: readonly number[]
}

/** The pad's station: at the boundary between the circuit's two middle lots (a single lot's far side), slid clear of the pipes that cross the street. */
function padStationOf({ context, group, piece, crossings }: { readonly context: BuriedContext; readonly group: readonly UndergroundLot[]; readonly piece: { readonly from: number; readonly to: number }; readonly crossings: readonly number[] }): number {
  const gap = context.rules.layout.underground.lateralGap
  const middle = Math.floor((group.length - 1) / 2)
  const [a, b] = [group[middle] as UndergroundLot, group[middle + 1]]
  const targets = b === undefined ? [a.served.span[1], a.served.span[0]] : [(a.served.span[1] + b.served.span[0]) / 2]
  const busy = [...crossings, ...group.map((lot) => lot.u)]
  for (let step = 0; step <= 40; step++) {
    for (const target of targets) {
      const u = target + (step % 2 === 0 ? 1 : -1) * Math.ceil(step / 2) * 0.25
      if (u >= piece.from + 0.5 && u <= piece.to - 0.5 && busy.every((other) => Math.abs(other - u) >= gap)) return u
    }
  }
  return Math.min(piece.to - 0.5, Math.max(piece.from + 0.5, targets[0] as number))
}

export function circuitsOfRun({ context, run, connections, lights, crossings }: CircuitsParams): UndergroundCircuit[] {
  const { power, lighting } = context.rules
  const lots = lotsOf({ context, run, connections })
  const fits = (group: readonly UndergroundLot[]): boolean => {
    const demand = diversifiedDemand(group.map((lot) => lot.power?.installedKva ?? 0), power)
    const span = (group[group.length - 1]?.u ?? 0) - (group[0]?.u ?? 0)
    return pickTransformer(demand / 0.9, power) !== undefined && span <= power.lvCircuitMaxLength
  }
  return piecesOf(run).flatMap((piece, pieceIndex) => {
    const groups: Group[] = []
    for (const lot of lots.filter((entry) => entry.u >= piece.from && entry.u <= piece.to)) {
      const last = groups[groups.length - 1]
      if (last !== undefined && fits([...last.lots, lot])) last.lots.push(lot)
      else groups.push({ lots: [lot], lights: [] })
    }
    if (groups.length === 0) return []
    for (const light of lights.filter((entry) => entry.u >= piece.from && entry.u <= piece.to)) {
      const distance = (group: Group): number => Math.max(0, (group.lots[0]?.u ?? 0) - light.u, light.u - (group.lots[group.lots.length - 1]?.u ?? 0))
      ;[...groups].sort((a, b) => distance(a) - distance(b))[0]?.lights.push(light)
    }
    return groups.map((group, groupIndex): UndergroundCircuit => {
      const padU = padStationOf({ context, group: group.lots, piece, crossings })
      const demand = diversifiedDemand(group.lots.map((lot) => lot.power?.installedKva ?? 0), power) + group.lights.length * lighting.lampKva
      const largest = [...power.transformers].sort((x, y) => y.kva - x.kva)[0] as TransformerRating
      const rating = pickTransformer(demand, power) ?? largest
      if (pickTransformer(demand, power) === undefined) context.sink.warnings.push({ code: 'transformer_over_capacity', id: `pad:${run.id}:${pieceIndex}:${groupIndex}`, detail: `${demand.toFixed(1)} kVA` })
      const padKey = `pad:${run.id}:${pieceIndex}:${groupIndex}`
      return {
        run,
        padKey,
        rating,
        lots: group.lots,
        members: [...group.lots.map((lot) => lot.key), ...group.lights.map((light) => light.key)],
        stops: [{ key: padKey, run, u: padU }, ...group.lots.map((lot) => ({ key: lot.key, run, u: lot.u }))],
      }
    })
  })
}
