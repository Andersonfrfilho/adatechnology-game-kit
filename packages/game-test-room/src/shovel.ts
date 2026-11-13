import type { ToolCondition, Vec3 } from '@adatechnology/game-contracts'
import type { DestructibleSpec, ObjectState } from '@adatechnology/game-destruction'
import type { Terrain } from '@adatechnology/game-terrain'

/**
 * A shovelful, as one digs: a 0.3 x 0.3 m bite of the blade, 0.2 m into loose soil (less into harder ground, by its `dig.effort`), thrown 0.9 m to the
 * right of where one faces. The motion takes 1.5 s. The blade comes down on the ground when the aim points down (`downward`) at ground within
 * `reachFromFeet` of the feet and not deeper than `reachDown` under them (the floor of a hole being dug there; one bends into it), wherever the aim starts
 * (the eye, or the camera over the shoulder); a swing otherwise.
 */
export const SHOVEL = { aimReach: 6, reachFromFeet: 1.6, reachDown: 1, bite: 0.2, size: [0.3, 0.3] as const, seconds: 1.5, swingSeconds: 0.6, downward: -0.3, throwSide: 0.9, heapReach: 2.5, heapRadius: 0.6, holeReach: 0.6 } as const

/** What the shovel does where it is aimed: dig (take earth out, throw it aside) or fill (take it back from the heap into the hole). */
export type ShovelMode = 'dig' | 'fill'

/** What a shovelful did, for the room to show and say. */
export type Shovelful =
  | { readonly kind: 'dug'; readonly volume: number; readonly material: string; readonly dump: Vec3 }
  /** The blade met ground a shovel does not dig (rock, concrete, laterite): it bounced off and nothing came out. */
  | { readonly kind: 'refused'; readonly material: string; readonly point: Vec3 }
  /** Mud: the blade lifted it and the hole closed behind it. */
  | { readonly kind: 'closed'; readonly material: string; readonly point: Vec3 }
  | { readonly kind: 'filled'; readonly volume: number; readonly from: Vec3; readonly point: Vec3 }
  /** Fill with no heap within reach: nothing to throw back. */
  | { readonly kind: 'no_heap'; readonly point: Vec3 }

/** True when the tool is one that digs (its arsenal entry carries the `digs` tag). */
export const digsWith = (def: { readonly tags?: readonly string[] } | undefined): boolean => def?.tags?.includes('digs') === true

/** Where the earth of a shovelful lands: on the ground to the right of the way one faces, `SHOVEL.throwSide` from the bite. */
export function dumpOf(terrain: Terrain, point: Vec3, direction: Vec3): Vec3 {
  const length = Math.hypot(direction[0], direction[2]) || 1
  // three's frame: facing -z, the right is +x: the right of (dx, dz) is (-dz, dx)
  const x = point[0] + (-direction[2] / length) * SHOVEL.throwSide, z = point[2] + (direction[0] / length) * SHOVEL.throwSide
  return [x, terrain.heightAt(x, z), z]
}

/** The heap of loose earth nearest `around` within `SHOVEL.heapReach`: where the shovel takes earth back from. */
export function nearestHeap(terrain: Terrain, around: Vec3): Vec3 | null {
  let best: { at: Vec3; score: number } | null = null
  const step = 0.15
  for (let dx = -SHOVEL.heapReach; dx <= SHOVEL.heapReach + 1e-9; dx += step) {
    for (let dz = -SHOVEL.heapReach; dz <= SHOVEL.heapReach + 1e-9; dz += step) {
      const distance = Math.hypot(dx, dz)
      if (distance > SHOVEL.heapReach) continue
      const x = around[0] + dx, z = around[2] + dz
      if (!terrain.contains(x, z)) continue
      const loose = terrain.columnAt(x, z).loose
      if (loose < 0.02) continue
      // the highest earth, the nearer the better
      const score = loose - distance * 0.02
      if (!best || score > best.score) best = { at: [x, terrain.heightAt(x, z), z], score }
    }
  }
  return best?.at ?? null
}

/** The lowest point of the ground within `SHOVEL.holeReach` of `around`: the floor of the hole one aims at. */
export function deepestNear(terrain: Terrain, around: Vec3): Vec3 {
  let best: Vec3 = [around[0], terrain.heightAt(around[0], around[2]), around[2]]
  const step = 0.1
  for (let dx = -SHOVEL.holeReach; dx <= SHOVEL.holeReach + 1e-9; dx += step) {
    for (let dz = -SHOVEL.holeReach; dz <= SHOVEL.holeReach + 1e-9; dz += step) {
      if (Math.hypot(dx, dz) > SHOVEL.holeReach) continue
      const x = around[0] + dx, z = around[2] + dz, y = terrain.heightAt(x, z)
      if (y < best[1] - 1e-4) best = [x, y, z]
    }
  }
  return best
}

/** One shovelful at `point`, aimed along `direction` (`share` of a full bite, `biteShareOf` of a bent blade): digs (the bite as deep as the ground lets it) or fills from the nearest heap. */
export function shovelful(terrain: Terrain, mode: ShovelMode, point: Vec3, direction: Vec3, share = 1): Shovelful {
  const scale = Math.sqrt(share)
  const size: [number, number] = [SHOVEL.size[0] * scale, SHOVEL.size[1] * scale]
  if (mode === 'fill') {
    const heap = nearestHeap(terrain, point)
    if (!heap) return { kind: 'no_heap', point }
    // the earth goes into the hole one aims at: its deepest point near the aim (the aim may meet its near rim)
    const hole = deepestNear(terrain, point)
    const volume = terrain.fill({ x: hole[0], z: hole[2], size, from: { x: heap[0], z: heap[2], radius: SHOVEL.heapRadius }, volume: size[0] * size[1] * SHOVEL.bite })
    return volume > 0 ? { kind: 'filled', volume, from: heap, point: hole } : { kind: 'no_heap', point }
  }
  // the harder the ground, the shallower the bite a shovelful takes
  const met = terrain.material(terrain.columnAt(point[0], point[2]).material)
  const depth = SHOVEL.bite / Math.max(1, met.dig?.effort ?? 1)
  const dump = dumpOf(terrain, point, direction)
  const result = terrain.dig({ x: point[0], z: point[2], size, depth, dump: { x: dump[0], z: dump[2] } })
  if (result.refused) return { kind: 'refused', material: result.refused, point }
  if (result.closes) return { kind: 'closed', material: result.material, point }
  return { kind: 'dug', volume: result.volume, material: result.material, dump }
}

export type { ToolCondition }

/** Smallest share of a full bite a folded blade still takes. */
export const MIN_BITE_SHARE = 0.25

/** Share of a full bite a blade bent by `bend` radians takes: it scoops with the part of its face that still faces the ground, `cos(bend)`. */
export const biteShareOf = (bend: number): number => Math.min(1, Math.max(MIN_BITE_SHARE, Math.cos(Math.max(0, bend))))

const lost = (status: string): boolean => status === 'broken' || status === 'ash' || status === 'melted'

/** The condition of a tool from its destruction object: the parts the spec tags `handle` and `blade`. A tool without a handle part is never handle-broken. */
export function toolConditionOf(spec: DestructibleSpec, state: ObjectState): ToolCondition {
  const tagged = (tag: string) => state.parts.filter((part) => spec.parts.find((candidate) => candidate.id === part.id)?.tags?.includes(tag))
  return { handleBroken: tagged('handle').some((part) => lost(part.status)), bend: Math.max(0, ...tagged('blade').map((part) => part.bend ?? 0)) }
}
