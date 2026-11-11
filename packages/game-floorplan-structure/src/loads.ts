import { distributeLoads, solveSupports } from '@adatechnology/game-load-path'
import type { LoadSharing, SupportEdge } from '@adatechnology/game-load-path'

import { GROUND } from './types'
import type { StructurePart, Support } from './types'


/**
 * Load each part carries at rest by the load path rule of `game-load-path` (the destruction world uses the same one): with `all` every support a part
 * rests on carries its share, with `nearest` only those closest to the ground; a partition wall carries nothing, so what rests only on partitions has no
 * load. `without` leaves one part out (as if it had failed). Parts that are not structural (the tank) are not loaded.
 */
export function loadsAtRest(parts: readonly StructurePart[], supports: readonly Support[], without?: string, sharing: LoadSharing = 'all'): Map<string, number> {
  const kept = parts.filter((part) => part.id !== without && part.id !== GROUND)
  const ids = [GROUND, ...kept.map((part) => part.id)]
  const index = new Map(ids.map((id, k) => [id, k]))
  const edges: SupportEdge[][] = ids.map(() => [])
  for (const support of supports) {
    if (support.bears === false) continue
    const part = index.get(support.part)
    const on = index.get(support.on)
    if (part === undefined || on === undefined) continue
    edges[part]!.push({ on, directed: true })
  }
  const partOf = (k: number): StructurePart | undefined => (k === 0 ? undefined : kept[k - 1])
  const solution = solveSupports({
    size: ids.length, sharing, anchored: (k) => k === 0, active: (k) => k === 0 || partOf(k)!.role !== 'none', partition: (k) => partOf(k)?.role === 'partition',
    supportsOf: (k) => edges[k]!,
  })
  const loads = distributeLoads(solution, (k) => (k === 0 ? 0 : partOf(k)!.mass || 1))
  const out = new Map<string, number>()
  for (const k of solution.reached) if (k !== 0) out.set(ids[k]!, loads[k]!)
  return out
}

export interface SizingOptions {
  /** Fraction of its capacity a pillar or bearing wall uses at rest. */
  safety: number
  /** The most of its capacity a pillar or bearing wall uses after any other pillar or bearing wall is lost. */
  redundancy: number
  /** Fraction of capacity every other structural part uses at rest. */
  safetyOthers: number
  /** Default `all`. */
  sharing?: LoadSharing
}

const isBearing = (part: StructurePart): boolean => part.role === 'column' || part.role === 'wall'

/**
 * Capacity of each loaded part, as a designer would size it: a pillar or bearing wall uses `safety` of it at rest and stays under `redundancy` when
 * any other pillar or bearing wall is lost (the house holds one loss and falls with two); every other part uses `safetyOthers`, and a rafter or roof bay
 * also stays under `redundancy` after that loss (the bays' load moves to the rafter beside the lost pillar).
 * `sizeStructure` of game-destruction gives the same numbers except for beams of a framed building (it holds them under `redundancy` too).
 */
/** A roof bay or the rafter under it: its load moves to the neighbour when a pillar below is lost (whole trusses keep the team's sizing). */
function isRoofFrame(part: StructurePart): boolean {
  return part.role === 'roof' || part.id.startsWith('rafter')
}

export function sizeCapacities(parts: readonly StructurePart[], supports: readonly Support[], options: SizingOptions): Map<string, number> {
  const loads = loadsAtRest(parts, supports, undefined, options.sharing)
  const worst = new Map<string, number>()
  for (const part of parts.filter(isBearing)) {
    for (const [id, load] of loadsAtRest(parts, supports, part.id, options.sharing)) {
      const before = loads.get(id)
      if (before && load / before > (worst.get(id) ?? 1)) worst.set(id, load / before)
    }
  }
  const capacities = new Map<string, number>()
  for (const part of parts) {
    const load = loads.get(part.id)
    if (load === undefined || part.role === 'none') continue
    const afterLoss = (worst.get(part.id) ?? 1) / options.redundancy
    const factor = isBearing(part) ? Math.max(1 / options.safety, afterLoss) : isRoofFrame(part) ? Math.max(1 / options.safetyOthers, afterLoss) : 1 / options.safetyOthers
    capacities.set(part.id, Math.max(1, load * factor))
  }
  return capacities
}
