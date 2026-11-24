/** The axis a straight street runs along. */
export type RunAxis = 'x' | 'z'

/** A point of a street's frame in the world: `u` along the street, `v` across it (+z for a street along x, +x for one along z). */
export function worldOf(along: RunAxis, axis: number, u: number, v: number): readonly [number, number] {
  return along === 'x' ? [u, axis + v] : [axis + v, u]
}

/** A world point in a street's frame: the inverse of `worldOf`. */
export function frameOf(along: RunAxis, axis: number, x: number, z: number): readonly [number, number] {
  return along === 'x' ? [x, z - axis] : [z, x - axis]
}

const UINT32 = 2 ** 32

/** FNV-1a of the seed and an id, into [0, 1): what the generator draws (a hookup, a bundle of cables), never the scene's random. */
export function hashOf(seed: number, id: string): number {
  let h = 2166136261 ^ (seed >>> 0)
  h = Math.imul(h, 16777619)
  h ^= Math.floor(seed / UINT32) >>> 0
  h = Math.imul(h, 16777619)
  for (let index = 0; index < id.length; index++) {
    h ^= id.charCodeAt(index)
    h = Math.imul(h, 16777619)
  }
  // murmur3's finaliser: ids that differ in their last character land far apart
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / UINT32
}

/** A whole number in `[least, most]` by the hash of the seed and an id. */
export function countOf(seed: number, id: string, [least, most]: readonly [number, number]): number {
  return least + Math.min(most - least, Math.floor(hashOf(seed, id) * (most - least + 1)))
}

/** Two digits from 1: 'pole:main_street:07'. */
export const ordinal = (index: number): string => String(index + 1).padStart(2, '0')
