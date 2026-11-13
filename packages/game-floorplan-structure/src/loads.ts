import { capacitiesByLoad, contactArea, contactCentre, distributeLoads, solveSupports } from '@adatechnology/game-load-path'
import type { LoadSharing, PlanePoint, SupportEdge } from '@adatechnology/game-load-path'
import { bearingModulus, getAssembly, isUpright } from '@adatechnology/game-destruction'

import { GROUND } from './types'
import type { StructurePart, Support } from './types'

/** The stiffness of a part as a support, from what its spec is built of (`toDestructibleSpec`): the assembly's core and units, and its mortar bed. */
const stiffnessOf = (part: StructurePart, bedded: boolean): number | undefined => {
  const assembly = part.assembly ? getAssembly(part.assembly) : undefined
  const units = part.unit ? undefined : assembly?.units
  return bearingModulus(assembly?.core.material ?? part.material, { ...(units ? { units } : {}), bedded })
}


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
    const top = kept[part - 1]
    const under = on === 0 ? undefined : kept[on - 1]
    // with `all`, by statics on two supports apart, else by contact over the compliance of the path (the Visor's `nearest` shares equally)
    // (the ground is under the whole of a part: its footprint, as the terrain the world lays under the house)
    edges[part]!.push({ on, directed: true, ...(sharing === 'all' && top ? { weight: contactArea(top.aabb, under?.aabb ?? top.aabb), at: contactCentre(top.aabb, under?.aabb ?? top.aabb) } : {}) })
  }
  const partOf = (k: number): StructurePart | undefined => (k === 0 ? undefined : kept[k - 1])
  const bedded = new Set(supports.filter((support) => support.joint === 'mortar' && support.bears !== false).map((support) => support.part))
  const solution = solveSupports({
    size: ids.length, sharing, anchored: (k) => k === 0, active: (k) => k === 0 || partOf(k)!.role !== 'none', partition: (k) => partOf(k)?.role === 'partition',
    supportsOf: (k) => edges[k]!,
    // with `all`, by the stiffness of each path to the ground too, read from what the spec is built of (the destruction world reads the same moduli)
    ...(sharing === 'all' ? {
      stiffness: (k: number) => (k === 0 ? undefined : stiffnessOf(partOf(k)!, bedded.has(ids[k]!))),
      upright: (k: number) => k !== 0 && isUpright(partOf(k)!.role),
      height: (k: number) => (k === 0 ? 0 : partOf(k)!.y1 - partOf(k)!.y0),
      centre: (k: number): PlanePoint => {
        const [u0, v0, u1, v1] = partOf(k)?.aabb ?? [0, 0, 0, 0]
        return [(u0 + u1) / 2, (v0 + v1) / 2]
      },
    } : {}),
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
  const losses = parts.filter(isBearing).map((lost) => {
    const after = loadsAtRest(parts, supports, lost.id, options.sharing)
    return (part: StructurePart): number | undefined => after.get(part.id)
  })
  const sized = capacitiesByLoad({
    parts: parts.filter((part) => part.role !== 'none'), loadOf: (part) => loads.get(part.id), losses, minimum: 1, redundancy: options.redundancy,
    // every part holds the loss of a pillar or bearing wall (a beam or a slab too: no collapse spreads from one loss), as the world sizes them; the Visor's
    // sizing (`nearest`) held only the pillars, walls and roof frame to it
    safety: (part) => (isBearing(part) ? options.safety : options.safetyOthers), redundant: (part) => options.sharing !== 'nearest' || isBearing(part) || isRoofFrame(part),
  })
  return new Map([...sized].map(([part, capacity]) => [part.id, capacity]))
}
