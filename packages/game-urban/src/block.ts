import { createCityBuilding } from '@adatechnology/game-floorplan'

import type { UrbanBuilder } from './scene'

/** Facade colours of the city buildings (the Galeria's `FAC`). */
export const DEFAULT_FACADES: readonly number[] = [0x3b3f45, 0x4a4038, 0x35403d, 0x463a3a, 0x3f3b34, 0x2f3439, 0x51493f, 0x5a564e]

const DEFAULT_PARTITIONS = 2
const DEFAULT_GAP = 0.08
const STREET_MARGIN = 2
const FOOTPRINT_TRIM = 1.2
const FOOTPRINT_JITTER = 1.5
const HEIGHT_CURVE = 1.6

export type FillBlockOptions = {
  /** The block is split into `k x k` lots. Default 2. */
  k?: number
  /** Chance that a lot stays empty. Default 0.08. */
  gap?: number
  /** Chance that a window is lit. */
  lit?: number
  /** Chance of a ground-floor shop on a building. */
  shop?: number
  /** Facade colours. Default `DEFAULT_FACADES`. */
  palette?: readonly number[]
}

/** A building a block ended up with, for the game's own bookkeeping (collisions, minimap). */
export type BlockBuilding = { x: number; z: number; width: number; depth: number; height: number; color: number }

export type BuildingOptions = { lit?: number; shop?: number }

/** One city building: block, roof slab, maybe a vent on the roof, maybe a shop front on both long faces, windows on the four faces. Draws from the builder's random. */
export function drawBuilding(b: UrbanBuilder, x: number, z: number, width: number, depth: number, height: number, color: number, options: BuildingOptions = {}): BlockBuilding {
  b.add(createCityBuilding({ x, z, width, depth, height, color, random: b.random, shopChance: options.shop, litChance: options.lit }))
  return { x, z, width, depth, height, color }
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * Fills a square block with city buildings: a `k x k` split of the block less 2 m of street, each lot maybe empty, each building a
 * little smaller than its lot and as tall as `lerp(min, max, random^1.6)` (more low buildings than tall ones). Draws from the
 * builder's random in the page's order: gap, width, depth, height, facade, then the building's own.
 */
export function fillBlock(b: UrbanBuilder, cx: number, cz: number, size: number, minHeight: number, maxHeight: number, options: FillBlockOptions = {}): BlockBuilding[] {
  const placed: BlockBuilding[] = []
  const palette = options.palette ?? DEFAULT_FACADES
  const half = (size - STREET_MARGIN) / 2
  const k = options.k || DEFAULT_PARTITIONS
  const lot = (size - STREET_MARGIN) / k
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      if (b.random() < (options.gap || DEFAULT_GAP)) continue
      const width = lot - FOOTPRINT_TRIM - b.random() * FOOTPRINT_JITTER
      const depth = lot - FOOTPRINT_TRIM - b.random() * FOOTPRINT_JITTER
      const height = lerp(minHeight, maxHeight, Math.pow(b.random(), HEIGHT_CURVE))
      const x = cx - half + lot * (i + 0.5)
      const z = cz - half + lot * (j + 0.5)
      const color = b.pick(palette)
      placed.push(drawBuilding(b, x, z, width, depth, height, color, options))
    }
  }
  return placed
}
