import type { FloorplanOptions } from '@adatechnology/game-floorplan'
import { clamp } from '../util'
import type { CreateRng } from '../util'

export type WoodFrameFoundation = 'slab' | 'crawl_space' | 'basement'
export type WoodFrameConfig = {
  floors: 1 | 2
  garage: boolean
  fireplace: boolean
  foundation: WoodFrameFoundation
  attic: boolean
  bedrooms: number
}

export const WOOD_FRAME = { porchDepth: 2, stairsWidth: 2.4, garageWidth: 3.6 } as const

/** Elevation of the ground floor above the terrain, by foundation. */
export const FOUNDATION_ELEVATION: Record<WoodFrameFoundation, number> = { basement: 0.5, crawl_space: 0.6, slab: 0.2 }

/** Options (or a draw per option from the seed) of the wood frame house; a basement only fits the two-storey house. */
export function createWoodFrameConfig(createRng: CreateRng) {
  return (options: FloorplanOptions): WoodFrameConfig => {
    const draw = (key: string): number => createRng(options.seed == null ? 1 : options.seed, 'am:' + key)()
    const floors = options.floors === 1 ? 1 : options.floors === 2 ? 2 : draw('and') < 0.65 ? 2 : 1
    const garage = options.garage != null ? !!options.garage : draw('gar') < 0.7
    const fireplace = options.fireplace != null ? !!options.fireplace : draw('lar') < 0.55
    const foundationDraw = draw('fund')
    const foundation: WoodFrameFoundation =
      options.basement === 'none' ? 'slab' : options.basement === 'basement' || options.basement === 'crawl_space' ? options.basement : foundationDraw < 0.28 ? 'basement' : foundationDraw < 0.6 ? 'crawl_space' : 'slab'
    const attic = options.attic != null ? !!options.attic : draw('sot') < 0.5
    const bedrooms = clamp(Math.round(options.bedrooms || 2 + Math.floor(draw('qts') * 3)), 2, 4)
    return { floors, garage, fireplace, foundation: floors === 1 && foundation === 'basement' ? 'crawl_space' : foundation, attic, bedrooms }
  }
}
