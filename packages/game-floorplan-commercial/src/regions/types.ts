import type { PaletteStyleDef, ZoneDef } from '@adatechnology/game-floorplan'

/** Regional data of the commercial pack: shop paint, colour tables and urban zones. */
export interface CommercialRegion {
  id: string
  swatches: Record<string, [string, string][]>
  facadeColors: Record<string, PaletteStyleDef['facadeColors']>
  zones: ZoneDef[]
}
