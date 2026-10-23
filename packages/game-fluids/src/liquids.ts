import liquidsData from './data/liquids.json'
import type { LiquidDef } from './types'

/**
 * Built-in liquids (data in `data/liquids.json`; colours are `0xRRGGBB` stored as integers).
 * Viscosity is relative to water, density in kg/m³, `dryTime` in seconds for a thin film at 20 °C (0 = never dries).
 */
export const LIQUIDS: LiquidDef[] = liquidsData as unknown as LiquidDef[]
