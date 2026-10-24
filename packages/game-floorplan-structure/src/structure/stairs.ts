import { GROUND } from '../types'
import type { StructureSource } from '../types'
import type { BuildContext } from './context'

type StairItem = StructureSource['items'][number]

/** One flight per pair of linked storeys, taken from the item of the lower storey when both are present. */
function flightsOf(items: readonly StairItem[]): Map<string, StairItem> {
  const flights = new Map<string, StairItem>()
  for (const item of items.filter((it) => it.category === 'stairs' && it.link)) {
    const key = `${item.link!.from}_${item.link!.to}`
    if (!flights.has(key) || item.floor === item.link!.from) flights.set(key, item)
  }
  return flights
}

/** Interior stairs between storeys, resting on the floor below and tied to the one above, plus the basement stairs. */
export function addStairs(context: BuildContext): void {
  const { builder, construction } = context
  const material = context.isTimber ? construction.frame.timber : (construction.stairs ?? 'concrete')
  for (const [key, item] of flightsOf(context.source.items)) {
    const { from, to } = item.link!
    const flight = builder.add({ id: `stairs_${key}`, role: 'stair', material, aabb: item.aabb!, y0: context.level(from), y1: context.level(to) }, { floor: from, steps: Math.round((context.level(to) - context.level(from)) / 0.18) })
    const base = context.baseOf(from)
    builder.rest(flight, !base || base === GROUND ? GROUND : base, !base || base === GROUND ? 'resting' : context.isTimber ? 'nail' : 'mortar')
    const upper = context.baseOf(to)
    if (upper && upper !== GROUND) builder.rest(flight, upper, context.isTimber ? 'nail' : 'bolt')
  }
  if (!context.hasBasement) return
  const item = context.source.items.find((it) => it.type === 'basement_stairs')
  if (!item?.aabb) return
  const depth = construction.foundation.depth || 2.4
  const flight = builder.add({ id: 'basement_stairs', role: 'stair', material: 'wood_soft', aabb: item.aabb, y0: -depth, y1: context.level(0) }, { floor: -1, steps: Math.round((context.level(0) + depth) / 0.18) })
  builder.rest(flight, builder.find('basement_slab')!, 'resting')
  if (context.base0 && context.base0 !== GROUND) builder.rest(flight, context.base0, 'nail')
}
