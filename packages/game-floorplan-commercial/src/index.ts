import type { FloorplanEngine } from '@adatechnology/game-floorplan'
import { commercialItems } from './catalog'
import { commercialDecorProfile } from './decor-profiles'
import { legacySeedKeys } from './legacy-seeds'
import { createCommercialLibraries } from './libraries'
import enLocale from './locales/en.json'
import ptBrLocale from './locales/pt-BR.json'
import { createCommercialPalette } from './palette'
import { regions, resolveRegion } from './regions'
import type { CommercialRegion } from './regions'
import { commercialRoomColors } from './room-colors'
import { sharedItems } from './shared-items'
import { commercialStyles } from './styles'
import { market } from './templates/market'
import { pharmacy } from './templates/pharmacy'

export interface CommercialOptions {
  /** Region data (paint, colour tables, zones). Default `br`; pass an object for a custom region. */
  region?: string | CommercialRegion
}

export const version = '0.1.0'

/** Commercial template ids. */
export const commercialTemplateIds = ['market', 'pharmacy'] as const

/** Fills the engine with the commercial content: items, libraries, templates, style, palette, zones and locales. */
export function register(engine: FloorplanEngine, options: CommercialOptions = {}): void {
  const region = resolveRegion(options.region)
  engine.registerLocale('en', enLocale)
  engine.registerLocale('pt-BR', ptBrLocale)
  engine.registerSeedKeys(legacySeedKeys)
  engine.registerItems(commercialItems)
  engine.registerItems(sharedItems.filter((i) => !engine.catalog[i.type]))
  const libs = createCommercialLibraries(engine.slotKit)
  for (const [id, lib] of Object.entries(libs)) engine.registerLibrary(id, lib)
  engine.registerLibraryAlias('shop', 'shop_market')
  engine.registerLibraryAlias('counter', 'counter_market')
  engine.registerWallTop('glass', 0.1)
  engine.registerWallTop('razor_wire', 0.45)
  for (const style of commercialStyles) {
    engine.registerStyle({ ...style, swatches: region.swatches[style.id] })
    engine.registerPaletteStyle(style.id, createCommercialPalette(region.facadeColors[style.id]))
    engine.registerDecorProfile(style.id, commercialDecorProfile)
  }
  engine.registerRoomColors(commercialRoomColors)
  engine.registerTemplate(market)
  engine.registerTemplate(pharmacy)
  for (const zone of region.zones) engine.defineZone(zone)
}

export { commercialItems, commercialStyles, commercialRoomColors, commercialDecorProfile, regions, createCommercialLibraries, enLocale, ptBrLocale }
export type { CommercialRegion }
