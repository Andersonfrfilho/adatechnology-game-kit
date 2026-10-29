import type { FloorplanEngine, SlotLibrary } from '@adatechnology/game-floorplan'
import { towerLocales } from '@adatechnology/game-floorplan-structure'
import { commercialItems } from './catalog'
import { commercialDecorProfile, farmDecorProfile } from './decor-profiles'
import { legacySeedKeys } from './legacy-seeds'
import { createCommercialLibraries } from './libraries'
import { createTowerLibraries } from './tower-libraries'
import enInteriorLocale from './locales/interiors-en.json'
import ptBrInteriorLocale from './locales/interiors-pt-BR.json'
import enLocale from './locales/en.json'
import ptBrLocale from './locales/pt-BR.json'
import { interiorFindsHints, interiorModules, interiorTemplateIds, sharedInteriorLibraries } from './interiors'
import { createCommercialPalette } from './palette'
import { regions, resolveRegion } from './regions'
import type { CommercialRegion } from './regions'
import { commercialRoomColors } from './room-colors'
import { sharedItems } from './shared-items'
import { commercialStyles } from './styles'
import { market } from './templates/market'
import { pharmacy } from './templates/pharmacy'
import { officeTower } from './templates/office-tower'

export interface CommercialOptions {
  /** Region data (paint, colour tables, zones). Default `br`; pass an object for a custom region. */
  region?: string | CommercialRegion
}

export const version = '0.1.0'

/** Commercial template ids. */
export const commercialTemplateIds = ['market', 'pharmacy', 'office_tower', ...interiorTemplateIds] as const

/** Fills the engine with the commercial content: items, libraries, templates, style, palette, zones and locales. */
export function register(engine: FloorplanEngine, options: CommercialOptions = {}): void {
  const region = resolveRegion(options.region)
  engine.registerLocale('en', enLocale)
  engine.registerLocale('pt-BR', ptBrLocale)
  engine.registerLocale('en', enInteriorLocale)
  engine.registerLocale('pt-BR', ptBrInteriorLocale)
  engine.registerLocale('en', towerLocales.en)
  engine.registerLocale('pt-BR', towerLocales['pt-BR'])
  engine.registerSeedKeys(legacySeedKeys)
  engine.registerItems(commercialItems)
  engine.registerItems(sharedItems.filter((i) => !engine.catalog[i.type]))
  for (const module of interiorModules) engine.registerItems([...module.items])
  const libs: Record<string, SlotLibrary> = Object.assign(createCommercialLibraries(engine.slotKit), createTowerLibraries(engine.slotKit), sharedInteriorLibraries, ...interiorModules.map((module) => module.libraries(engine.slotKit)))
  for (const [id, lib] of Object.entries(libs)) engine.registerLibrary(id, lib)
  engine.registerLibraryAlias('shop', 'shop_market')
  engine.registerLibraryAlias('counter', 'counter_market')
  engine.registerWallTop('glass', 0.1)
  engine.registerWallTop('razor_wire', 0.45)
  for (const style of commercialStyles) {
    engine.registerStyle({ ...style, swatches: region.swatches[style.id] })
    engine.registerPaletteStyle(style.id, createCommercialPalette(region.facadeColors[style.id]))
    engine.registerDecorProfile(style.id, style.id === 'farm' ? farmDecorProfile : commercialDecorProfile)
  }
  engine.registerRoomColors(commercialRoomColors)
  engine.registerTemplate(market)
  engine.registerTemplate(pharmacy)
  engine.registerTemplate(officeTower)
  for (const module of interiorModules) engine.registerTemplate(module.template)
  for (const zone of region.zones) engine.defineZone(zone)
}

export { interiorFindsHints, interiorTemplateIds }
export type { FindsHint } from './interiors'
export { commercialItems, commercialStyles, commercialRoomColors, commercialDecorProfile, farmDecorProfile, regions, createCommercialLibraries, enLocale, ptBrLocale }
export type { CommercialRegion }
export { OFFICE_PLAN_DEFAULTS, OFFICE_TOWER_DEFAULTS, buildOfficeTower, officeTower, officeTowerLayout, officeTowerTemplate } from './templates/office-tower'
export type { OfficeTowerPlan } from './templates/office-tower'
