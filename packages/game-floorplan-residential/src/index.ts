import type { FloorplanEngine } from '@adatechnology/game-floorplan'
import { towerLocales } from '@adatechnology/game-floorplan-structure'
import { residentialItems } from './catalog'
import { decorPass } from './decor'
import { residentialDecorProfiles } from './decor-profiles'
import { legacySeedKeys } from './legacy-seeds'
import { createResidentialLibraries } from './libraries'
import { createTowerLibraries } from './tower-libraries'
import enLocale from './locales/en.json'
import ptBrLocale from './locales/pt-BR.json'
import { createPaletteStyles } from './palette'
import { regions, resolveRegion } from './regions'
import type { ResidentialRegion } from './regions'
import { residentialRoomColors } from './room-colors'
import { sharedItems } from './shared-items'
import { residentialStyles } from './styles'
import * as t from './templates'

export interface ResidentialOptions {
  /** Region data (paint, colour tables, zones). Default `br`; pass an object for a custom region. */
  region?: string | ResidentialRegion
  /** Skip the decor pass (lights, air conditioners, pictures, plants, curtains). */
  decor?: boolean
}

export const version = '0.1.0'

/** Residential template ids. */
export const residentialTemplateIds = [
  'single_storey_a',
  'townhouse',
  'apartment_basic',
  'budget_slab_house',
  'budget_semi_detached',
  'mid_modern_single_storey',
  'mid_modern_townhouse',
  'high_end_contemporary',
  'mansion',
  'apartment_modern',
  'residential_tower',
] as const

/** Fills the engine with the residential content: items, libraries, templates, styles, palette, decor, zones and locales. */
export function register(engine: FloorplanEngine, options: ResidentialOptions = {}): void {
  const region = resolveRegion(options.region)
  engine.registerLocale('en', enLocale)
  engine.registerLocale('pt-BR', ptBrLocale)
  engine.registerLocale('en', towerLocales.en)
  engine.registerLocale('pt-BR', towerLocales['pt-BR'])
  engine.registerSeedKeys(legacySeedKeys)
  // catalogue: shared items are only added when another pack has not already
  engine.registerItems(residentialItems)
  engine.registerItems(sharedItems.filter((i) => !engine.catalog[i.type]))
  // slot libraries
  const libs = { ...createResidentialLibraries(engine.slotKit), ...createTowerLibraries(engine.slotKit) }
  for (const [id, lib] of Object.entries(libs)) engine.registerLibrary(id, lib)
  // wall tops used by the fence rules of the styles
  engine.registerWallTop('glass', 0.1)
  engine.registerWallTop('razor_wire', 0.45)
  engine.registerWallTop('railing', 0.5)
  // styles, palette and decor
  const palettes = createPaletteStyles(region.facadeColors)
  for (const style of residentialStyles) {
    engine.registerStyle({ ...style, swatches: region.swatches[style.id] })
    engine.registerPaletteStyle(style.id, palettes[style.id as keyof typeof palettes])
    engine.registerDecorProfile(style.id, residentialDecorProfiles[style.id])
  }
  engine.registerRoomColors(residentialRoomColors)
  if (options.decor !== false) engine.registerPass('residential_decor', decorPass)
  engine.registerGroundOverlay({ category: 'pool', ground: 'deck_floor', inflate: 1.2 })
  engine.registerGroundOverlay({ category: 'gourmet', ground: 'tile_floor', inflate: 0.7, merge: true, unlessGround: 'tile_floor' })
  // templates
  for (const id of Object.keys(t)) {
    const entry = (t as Record<string, unknown>)[id]
    if (typeof entry === 'function') engine.registerTemplate((entry as (h: (s: string) => number) => never)(engine.hashString))
    else engine.registerTemplate(entry as never)
  }
  // zoning
  for (const zone of region.zones) engine.defineZone(zone)
}

export { residentialItems, residentialStyles, residentialRoomColors, residentialDecorProfiles, regions, decorPass, createResidentialLibraries, enLocale, ptBrLocale }
export type { ResidentialRegion }
export { RESIDENTIAL_PLAN_DEFAULTS, RESIDENTIAL_TOWER_DEFAULTS, buildResidentialTower, residentialTower, residentialTowerLayout, residentialTowerTemplate } from './templates/residential-tower'
export type { ResidentialTowerPlan } from './templates/residential-tower'
