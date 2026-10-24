import type { FloorplanEngine, SlotDef, TemplateDef } from '@adatechnology/game-floorplan'
import { ruralItems } from './items'
import { legacySeedKeys } from './legacy-seeds'
import { createCabinLibraries } from './libraries-cabin'
import { createCampLibraries } from './libraries-camp'
import { createWoodLibraries } from './libraries-wood'
import enLocale from './locales/en.json'
import ptBrLocale from './locales/pt-BR.json'
import { registerRuralStyle, ruralDecorProfile, ruralFacadeColors, ruralStyle, ruralSwatches } from './style'
import { createAFrameChalet } from './templates/a-frame-chalet'
import { createCampsite } from './templates/campsite'
import { createLogCabin } from './templates/log-cabin'
import { createShack } from './templates/shack'
import { createWoodFrameHouse } from './templates/wood-frame-house'

export interface RuralOptions {
  /** Region tag written on the templates. Default `br`. */
  region?: string
}

export const version = '0.1.0'

/** Rural template ids. */
export const ruralTemplateIds = ['wood_frame_house', 'a_frame_chalet', 'log_cabin', 'shack', 'campsite'] as const

type BaseLibrary = (room: { w: number; d: number }) => SlotDef[]

function baseLibrary(engine: FloorplanEngine, id: string): BaseLibrary {
  const library = engine.libraries[id]
  if (!library) throw new Error(`Register @adatechnology/game-floorplan-residential before the rural pack: the library "${id}" is missing`)
  return typeof library === 'function' ? library : () => library
}

/**
 * Fills the engine with the rural content: items, libraries, style and palette, templates and locales.
 * Needs the residential pack registered first (it extends its living room and laundry libraries and its mid palette).
 */
export function register(engine: FloorplanEngine, options: RuralOptions = {}): void {
  engine.registerLocale('en', enLocale)
  engine.registerLocale('pt-BR', ptBrLocale)
  engine.registerSeedKeys(legacySeedKeys)
  engine.registerItems(ruralItems)
  const libraries = {
    ...createWoodLibraries(engine.slotKit, { living: baseLibrary(engine, 'living'), laundry: baseLibrary(engine, 'laundry') }),
    ...createCabinLibraries(engine.slotKit),
    ...createCampLibraries(engine.slotKit),
  }
  for (const [id, library] of Object.entries(libraries)) engine.registerLibrary(id, library)
  registerRuralStyle(engine)
  const region = options.region ?? 'br'
  const factories = [createWoodFrameHouse, createAFrameChalet, createLogCabin, createShack, createCampsite]
  for (const create of factories) engine.registerTemplate({ ...create(engine.createRng), region } satisfies TemplateDef)
}

export { ruralItems, ruralStyle, ruralDecorProfile, ruralFacadeColors, ruralSwatches, enLocale, ptBrLocale }
