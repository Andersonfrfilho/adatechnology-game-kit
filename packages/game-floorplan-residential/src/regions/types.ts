import type { PaletteStyleDef, ZoneDef } from '@adatechnology/game-floorplan'

/** Regional data of the residential pack: paint, colour tables and urban zones. */
export interface ResidentialRegion {
  id: string
  /** Facade paint swatches per style, `[labelKey, hex]`. */
  swatches: Record<string, [string, string][]>
  /** Facade colour tables per style, `[labelKey, hue, saturation, lightness]`. */
  facadeColors: Record<string, PaletteStyleDef['facadeColors']>
  /** Urban zones of the region that concern housing. */
  zones: ZoneDef[]
}
