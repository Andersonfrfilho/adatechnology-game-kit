import { createRandom } from './random'
import type { TerrainCrack } from './types'

/** Energy the reach and width of a material's cracks are given for (`TerrainCrackResponse`). */
export const CRACK_REFERENCE_JOULES = 1e6
/** A new star this close to an old one, as a share of the old one's reach, lengthens it instead. */
const MERGE_SHARE = 0.35
/** Lines never get thinner than a hairline, nor more than a star holds. */
const HAIRLINE = 0.0015
const MIN_RAYS = 4
const MAX_RAYS = 11
const SEGMENTS = 4
const BRANCH_CHANCE = 0.45

/** One piece of a crack line on the ground plane, with the width at each end. */
export interface CrackSegment {
  readonly x0: number
  readonly z0: number
  readonly x1: number
  readonly z1: number
  readonly w0: number
  readonly w1: number
}

export interface CrackStore {
  readonly list: TerrainCrack[]
  readonly version: number
  /** Opens a star at the point, or lengthens and widens the one already there. */
  add(spec: { x: number; z: number; reach: number; width: number; material: string; seed: number }, max: number): TerrainCrack
  clear(): void
  load(cracks: readonly TerrainCrack[]): void
}

export function createCrackStore(): CrackStore {
  const list: TerrainCrack[] = []
  let version = 0
  let nextId = 1
  let born = 0
  return {
    list,
    get version() {
      return version
    },
    add(spec, max) {
      version++
      const near = list.find((crack) => Math.hypot(crack.x - spec.x, crack.z - spec.z) < crack.reach * MERGE_SHARE)
      if (near) {
        // a second blow on cracked ground runs the lines further and opens them: concrete fatigues, it does not heal
        near.reach = Math.max(near.reach, spec.reach) + Math.min(near.reach, spec.reach) * 0.25
        near.width = Math.max(near.width, spec.width) * 1.1
        near.rays = Math.min(MAX_RAYS, near.rays + 1)
        return near
      }
      if (list.length >= max) list.shift()
      const rays = MIN_RAYS + Math.floor(createRandom(spec.seed)() * (MAX_RAYS - MIN_RAYS - 2))
      const crack: TerrainCrack = { id: nextId++, x: spec.x, z: spec.z, reach: spec.reach, width: Math.max(HAIRLINE, spec.width), rays, seed: spec.seed, material: spec.material, born: born++ }
      list.push(crack)
      return crack
    },
    clear() {
      list.length = 0
      version++
    },
    load(cracks) {
      list.length = 0
      for (const crack of cracks) {
        list.push({ ...crack })
        nextId = Math.max(nextId, crack.id + 1)
        born = Math.max(born, crack.born + 1)
      }
      version++
    },
  }
}

/**
 * The lines of a star, from its seed: rays that wander a little as they run out and thin towards their tips, with a branch now and then. The same crack always draws the same
 * lines, so only the crack travels in a snapshot or over the network.
 */
export function crackLines(crack: TerrainCrack): CrackSegment[] {
  const random = createRandom(crack.seed)
  const segments: CrackSegment[] = []
  const widthAt = (distance: number): number => Math.max(HAIRLINE, crack.width * (1 - distance / crack.reach))
  for (let ray = 0; ray < crack.rays; ray++) {
    let angle = (ray / crack.rays) * Math.PI * 2 + (random() - 0.5) * 0.6
    const length = crack.reach * (0.45 + 0.55 * random())
    let x = crack.x
    let z = crack.z
    let run = 0
    for (let segment = 0; segment < SEGMENTS; segment++) {
      const step = (length / SEGMENTS) * (0.75 + 0.5 * random())
      angle += (random() - 0.5) * 0.5
      const nx = x + Math.cos(angle) * step
      const nz = z + Math.sin(angle) * step
      segments.push({ x0: x, z0: z, x1: nx, z1: nz, w0: widthAt(run), w1: widthAt(run + step) })
      if (segment > 0 && random() < BRANCH_CHANCE) {
        const side = angle + (random() < 0.5 ? -1 : 1) * (0.45 + random() * 0.5)
        const branch = step * (0.5 + 0.6 * random())
        const w = widthAt(run + step) * 0.6
        segments.push({ x0: nx, z0: nz, x1: nx + Math.cos(side) * branch, z1: nz + Math.sin(side) * branch, w0: Math.max(HAIRLINE, w), w1: HAIRLINE })
      }
      run += step
      x = nx
      z = nz
    }
  }
  return segments
}
