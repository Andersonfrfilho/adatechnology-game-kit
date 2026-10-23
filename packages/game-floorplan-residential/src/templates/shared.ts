import type { FloorplanOptions } from '@adatechnology/game-floorplan'
import { clamp } from '../util'

export const SMALL_LIVING = { sofa_right: { size: [2.1, 1.0] }, tv_unit_right: { clearance: 0.2 } }

export const SINGLE_BED_ONLY = { bed: { size: [1.0, 2.1], cats: { bed: 1 }, pos: 0, clearance: 0.05 } }

/** Storey count from `options.floors`, between 1 and 3. */
export const floorCount = (op: FloorplanOptions, def: number): number => clamp(Math.round(op.floors || def), 1, 3)

/** Bigger bed and wardrobe when the suite is wide enough. */
export const LARGE_SUITE = (wd: number) => (wd >= 4.2 ? { bed: { size: [2.2, 2.35], cats: { bed: 2, bed_king: 3 } }, wardrobe: { cats: { wardrobe: 2, wardrobe_large: 3 }, size: [2.5, 0.75] } } : {})
