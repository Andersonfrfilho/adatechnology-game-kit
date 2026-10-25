import { createCityBuilding } from '@adatechnology/game-floorplan'

import type { UrbanBuilder } from './scene'
import { DEFAULT_TOWER_PRESETS } from './tower'
import type { TowerPreset } from './tower'

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
  /**
   * Storeys of each building, a number or `[min, max]` (the same name and shape as a city block's `building.floors`). Given, the height is storeys times the
   * storey height of the use's preset instead of `minHeight..maxHeight`; the random draws are the same.
   */
  floors?: number | readonly [number, number]
  /** Share of the buildings by use (`commercial`, `residential`, ...); each building picks one (one more random draw). Needs no `floors`. */
  uses?: Readonly<Record<string, number>>
  /** Which tower preset gives the storey height of a use. Default `{ commercial: 'office', residential: 'residential' }`. */
  storeyPresets?: Readonly<Record<string, string>>
  /** The presets whose storey heights are used (default `DEFAULT_TOWER_PRESETS`; the kit passes its `towers.presets`). */
  presets?: readonly TowerPreset[]
  /** Storey height when no preset applies, metres. Default the residential preset's. */
  storeyHeight?: number
  /** Draws each building (default `drawBuilding`): the kit passes its own to put towers on the tall lots. */
  draw?: (b: UrbanBuilder, x: number, z: number, width: number, depth: number, height: number, color: number, options: BuildingOptions) => BlockBuilding
}

/** A building a block ended up with, for the game's own bookkeeping (collisions, minimap). */
export type BlockBuilding = { x: number; z: number; width: number; depth: number; height: number; color: number }

export type BuildingOptions = {
  lit?: number
  shop?: number
  /** Use of the building (`commercial`, `residential`...), when the block gave `uses`. */
  use?: string
  /** Storeys of the building, when the block gave `floors`; the height is already storeys times the storey height. */
  storeys?: number
  /** Id of the tower preset the use maps to; a tower drawer with that preset uses it instead of picking at random. */
  preset?: string
}

export const DEFAULT_STOREY_PRESETS: Readonly<Record<string, string>> = { commercial: 'office', residential: 'residential' }

/** One city building: block, roof slab, maybe a vent on the roof, maybe a shop front on both long faces, windows on the four faces. Draws from the builder's random. */
export function drawBuilding(b: UrbanBuilder, x: number, z: number, width: number, depth: number, height: number, color: number, options: BuildingOptions = {}): BlockBuilding {
  b.add(createCityBuilding({ x, z, width, depth, height, color, random: b.random, shopChance: options.shop, litChance: options.lit }))
  return { x, z, width, depth, height, color }
}

/** The use a building has: one pick by weight (draws once). */
function pickUse(b: UrbanBuilder, uses: Readonly<Record<string, number>>): string | undefined {
  const entries = Object.entries(uses).filter(([, w]) => w > 0)
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  if (total <= 0) return undefined
  let r = b.random() * total
  for (const [use, w] of entries) { r -= w; if (r < 0) return use }
  return entries[entries.length - 1]![0]
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
      const t = Math.pow(b.random(), HEIGHT_CURVE)
      let height = lerp(minHeight, maxHeight, t)
      let extra: BuildingOptions | null = null
      if (options.floors !== undefined || options.uses) {
        const use = options.uses ? pickUse(b, options.uses) : undefined
        const presetId = use ? (options.storeyPresets ?? DEFAULT_STOREY_PRESETS)[use] : undefined
        const preset = presetId ? (options.presets ?? DEFAULT_TOWER_PRESETS).find((p) => p.id === presetId) : undefined
        extra = { use, preset: preset?.id }
        if (options.floors !== undefined) {
          const [lo, hi] = typeof options.floors === 'number' ? [options.floors, options.floors] : options.floors
          const storeys = Math.max(1, Math.round(lerp(lo, hi, t)))
          height = storeys * (preset?.storeyHeight ?? options.storeyHeight ?? DEFAULT_TOWER_PRESETS[DEFAULT_TOWER_PRESETS.length - 1]!.storeyHeight)
          extra.storeys = storeys
        }
      }
      const x = cx - half + lot * (i + 0.5)
      const z = cz - half + lot * (j + 0.5)
      const color = b.pick(palette)
      placed.push((options.draw ?? drawBuilding)(b, x, z, width, depth, height, color, extra ? { ...options, ...extra } : options))
    }
  }
  return placed
}
