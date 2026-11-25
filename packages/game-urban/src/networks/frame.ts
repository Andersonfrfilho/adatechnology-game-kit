/** The axis a straight street runs along. */
export type RunAxis = 'x' | 'z'

/** A straight street's frame: `u` along it, `v` across it (+z for a street along x, +x for one along z). */
export type RunFrame = { readonly along: RunAxis; readonly axis: number }

/** A point of a street's frame in the world. */
export function worldOf({ frame, u, v }: { readonly frame: RunFrame; readonly u: number; readonly v: number }): readonly [number, number] {
  return frame.along === 'x' ? [u, frame.axis + v] : [frame.axis + v, u]
}

/** A world point in a street's frame: the inverse of `worldOf`. */
export function frameOf({ frame, x, z }: { readonly frame: RunFrame; readonly x: number; readonly z: number }): readonly [number, number] {
  return frame.along === 'x' ? [x, z - frame.axis] : [z, x - frame.axis]
}

const UINT32 = 2 ** 32

export type HashParams = { readonly seed: number; readonly id: string }

/** FNV-1a of the seed and an id, into [0, 1): what the generator draws (a hookup, a bundle of cables), never the scene's random. */
export function hashOf({ seed, id }: HashParams): number {
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

/** A whole number in `range` (both ends in) by the hash of the seed and an id. */
export function countOf({ seed, id, range }: HashParams & { readonly range: readonly [number, number] }): number {
  const [least, most] = range
  return least + Math.min(most - least, Math.floor(hashOf({ seed, id }) * (most - least + 1)))
}

/** Two digits from 1: 'pole:main_street:07'. */
export const ordinal = (index: number): string => String(index + 1).padStart(2, '0')

/** Points in square cells of `size` metres, to find the near ones without a pass over all of them. */
export type PlanBins<T> = { add(x: number, z: number, item: T): void; near(x: number, z: number, radius: number): T[] }

export function planBins<T>(size: number): PlanBins<T> {
  const cells = new Map<string, T[]>()
  const key = (i: number, k: number): string => `${i},${k}`
  return {
    add(x, z, item) {
      const id = key(Math.floor(x / size), Math.floor(z / size))
      cells.set(id, [...(cells.get(id) ?? []), item])
    },
    near(x, z, radius) {
      const out: T[] = []
      const reach = Math.ceil(radius / size)
      const [ci, ck] = [Math.floor(x / size), Math.floor(z / size)]
      for (let i = ci - reach; i <= ci + reach; i++) for (let k = ck - reach; k <= ck + reach; k++) out.push(...(cells.get(key(i, k)) ?? []))
      return out
    },
  }
}
