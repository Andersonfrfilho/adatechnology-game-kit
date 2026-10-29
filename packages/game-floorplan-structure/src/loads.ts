import { GROUND } from './types'
import type { StructurePart, Support } from './types'

/**
 * Load each part carries at rest, by the rules of the Visor de casas 3D (which the destruction world shares): load only goes down to supports closer to
 * the ground, shared equally, and a partition wall carries nothing, so what rests only on partitions has no load. `without` leaves one part out (as if it
 * had failed). Parts that are not structural (the tank) are not loaded.
 */
export function loadsAtRest(parts: readonly StructurePart[], supports: readonly Support[], without?: string): Map<string, number> {
  const byId = new Map(parts.filter((part) => part.id !== without).map((part) => [part.id, part]))
  const resting = new Map<string, string[]>()
  const carrying = new Map<string, string[]>()
  const push = (map: Map<string, string[]>, key: string, value: string): void => {
    const list = map.get(key)
    if (list) list.push(value)
    else map.set(key, [value])
  }
  for (const support of supports) {
    if (support.bears === false) continue
    if (!byId.has(support.part) || (support.on !== GROUND && !byId.has(support.on))) continue
    push(resting, support.part, support.on)
    push(carrying, support.on, support.part)
  }
  const partition = (id: string): boolean => byId.get(id)?.role === 'partition'
  const structural = (id: string): boolean => byId.has(id) && byId.get(id)!.role !== 'none'
  const distance = new Map<string, number>([[GROUND, 0]])
  const queue = [GROUND]
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]!
    if (current !== GROUND && partition(current)) continue
    for (const above of carrying.get(current) ?? []) {
      if (distance.has(above) || !structural(above)) continue
      distance.set(above, distance.get(current)! + 1)
      queue.push(above)
    }
  }
  const incoming = new Map<string, number>()
  const loads = new Map<string, number>()
  for (let head = queue.length - 1; head >= 1; head--) {
    const id = queue[head]!
    const total = (byId.get(id)!.mass || 1) + (incoming.get(id) ?? 0)
    loads.set(id, total)
    const below = (resting.get(id) ?? []).filter((other) => distance.has(other) && distance.get(other)! < distance.get(id)! && !(other !== GROUND && partition(other)))
    for (const other of below) incoming.set(other, (incoming.get(other) ?? 0) + total / below.length)
  }
  return loads
}

export interface SizingOptions {
  /** Fraction of its capacity a pillar or bearing wall uses at rest. */
  safety: number
  /** The most of its capacity a pillar or bearing wall uses after any other pillar or bearing wall is lost. */
  redundancy: number
  /** Fraction of capacity every other structural part uses at rest. */
  safetyOthers: number
}

const isBearing = (part: StructurePart): boolean => part.role === 'column' || part.role === 'wall'

/**
 * Capacity of each loaded part, as a designer would size it: a pillar or bearing wall uses `safety` of it at rest and stays under `redundancy` when
 * any other pillar or bearing wall is lost (the house holds one loss and falls with two); every other part uses `safetyOthers`.
 * `sizeStructure` of game-destruction gives the same numbers except for beams of a framed building (it holds them under `redundancy` too).
 */
export function sizeCapacities(parts: readonly StructurePart[], supports: readonly Support[], options: SizingOptions): Map<string, number> {
  const loads = loadsAtRest(parts, supports)
  const worst = new Map<string, number>()
  for (const part of parts.filter(isBearing)) {
    for (const [id, load] of loadsAtRest(parts, supports, part.id)) {
      const before = loads.get(id)
      if (before && load / before > (worst.get(id) ?? 1)) worst.set(id, load / before)
    }
  }
  const capacities = new Map<string, number>()
  for (const part of parts) {
    const load = loads.get(part.id)
    if (load === undefined || part.role === 'none') continue
    const factor = isBearing(part) ? Math.max(1 / options.safety, (worst.get(part.id) ?? 1) / options.redundancy) : 1 / options.safetyOthers
    capacities.set(part.id, Math.max(1, load * factor))
  }
  return capacities
}
