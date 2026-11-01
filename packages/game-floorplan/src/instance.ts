import { applyPatches, removeIds } from '@adatechnology/game-contracts'
import type { DeepPartial } from '@adatechnology/game-contracts'

import { CAR_CLEARANCE, DOOR_CLEARANCE, DOOR_EDGE_CLEARANCE, OVERHEAD_TOP, PLAYER_RADIUS, WALL_THICKNESS, WINDOW_EDGE_CLEARANCE } from './constants'
import { findsAnswer, findsFor } from './extensions'
import { generate, limitsOf, listTemplates, slots, validate } from './generate'
import { overlaps, openingZones } from './geometry'
import { registerGroundItems } from './ground-items'
import { listLocales, registerLocale, translate } from './locale'
import { HIGH_SATURATION, MIN_FABRIC_FLOOR_CONTRAST, MIN_WALL_FLOOR_CONTRAST, hexString, intToHsl, lstar, palette } from './palette'
import { blocksWindow, windowZone } from './queries'
import {
  createRegistries,
  getDefaultRegistries,
  listStates,
  registerDecorProfile,
  registerFindsProvider,
  registerGroundOverlay,
  registerItem,
  registerItems,
  registerLibrary,
  registerLibraryAlias,
  registerPass,
  registerPaletteStyle,
  registerResultExtension,
  registerRoomColors,
  registerSeedKeys,
  registerState,
  registerStyle,
  registerTemplate,
  registerViewerLayer,
  registerWallTop,
  setStateDistribution,
  withRegistries,
} from './registry'
import type { Registries } from './registry'
import { createRng, hashString, mulberry32 } from './rng'
import { slotKit } from './slot-kit'
import type { FurnitureDef, TemplateDef } from './types'
import { checkLot, defineZone, getZone, listZones, registerPermeableGround } from './zoning'

import enLocale from './locales/en.json'
import ptBrLocale from './locales/pt-BR.json'

export const version = '0.1.0'

/** Registers `packs` and applies `patch` / `remove` over the catalogs, by id. Items are keyed by `type`, templates by `id`. */
export type CreateFloorplanOptions = {
  /** Content packs, applied in order: a function `(engine) => void` or an object with `register(engine)`. */
  readonly packs?: readonly FloorplanPack[]
  readonly patch?: { readonly items?: Readonly<Record<string, DeepPartial<FurnitureDef>>>; readonly templates?: Readonly<Record<string, DeepPartial<TemplateDef>>> }
  readonly remove?: { readonly items?: readonly string[]; readonly templates?: readonly string[] }
}

export type FloorplanPack = ((engine: FloorplanEngine) => void) | { readonly register: (engine: FloorplanEngine) => void }

type Keyed = { id: string }

function editCatalog<TDef extends object>(catalog: Record<string, TDef>, patch: Readonly<Record<string, DeepPartial<TDef>>> | undefined, remove: readonly string[] | undefined): void {
  if (!patch && !remove) return
  const entries = new Map<string, TDef & Keyed>(Object.entries(catalog).map(([key, definition]) => [key, { ...definition, id: key }]))
  applyPatches(entries, patch as Readonly<Record<string, DeepPartial<TDef & Keyed>>> | undefined)
  removeIds(entries, remove)
  for (const key of Object.keys(catalog)) {
    const edited = entries.get(key)
    if (!edited) delete catalog[key]
    else if (patch && key in patch) {
      const hadId = 'id' in catalog[key]!
      const next: TDef & Partial<Keyed> = { ...edited }
      if (!hadId) delete next.id
      catalog[key] = next
    }
  }
}

function buildEngine(scope: Registries) {
  const scoped = <TFunction extends (...args: never[]) => unknown>(fn: TFunction): TFunction =>
    ((...args: never[]) => withRegistries(scope, () => fn(...args))) as TFunction
  return {
    version,
    generate: scoped(generate),
    slots: scoped(slots),
    validate: scoped(validate),
    palette: scoped(palette),
    limitsOf: scoped(limitsOf),
    listTemplates: scoped(listTemplates),
    listStates: scoped(listStates),
    // content registration
    registerItem: scoped(registerItem),
    registerItems: scoped(registerItems),
    registerLibrary: scoped(registerLibrary),
    registerLibraryAlias: scoped(registerLibraryAlias),
    registerTemplate: scoped(registerTemplate),
    registerStyle: scoped(registerStyle),
    registerPaletteStyle: scoped(registerPaletteStyle),
    registerRoomColors: scoped(registerRoomColors),
    registerDecorProfile: scoped(registerDecorProfile),
    registerPass: scoped(registerPass),
    registerGroundOverlay: scoped(registerGroundOverlay),
    registerWallTop: scoped(registerWallTop),
    registerSeedKeys: scoped(registerSeedKeys),
    registerState: scoped(registerState),
    setStateDistribution: scoped(setStateDistribution),
    registerLocale: scoped(registerLocale),
    registerResultExtension: scoped(registerResultExtension),
    registerFindsProvider: scoped(registerFindsProvider),
    findsFor: scoped(findsFor),
    findsAnswer: scoped(findsAnswer),
    registerViewerLayer: scoped(registerViewerLayer),
    viewerLayers: scope.VIEWER_LAYERS,
    blocksWindow: scoped(blocksWindow),
    // zoning
    defineZone: scoped(defineZone),
    getZone: scoped(getZone),
    listZones: scoped(listZones),
    checkLot: scoped(checkLot),
    registerPermeableGround: scoped(registerPermeableGround),
    // kits and data
    slotKit,
    translate: scoped(translate),
    listLocales: scoped(listLocales),
    templates: scope.TEMPLATES,
    catalog: scope.CATALOG,
    libraries: scope.LIBRARIES,
    styles: scope.STYLES,
    paletteStyles: scope.PALETTE_STYLES,
    createRng,
    mulberry32,
    hashString,
    overlaps,
    windowZone,
    openingZones,
    color: { lstar, hex: hexString, hsl: intToHsl, HIGH_SATURATION, MIN_WALL_FLOOR_CONTRAST, MIN_FABRIC_FLOOR_CONTRAST },
    constants: { WALL_THICKNESS, DOOR_CLEARANCE, PLAYER_RADIUS, DOOR_EDGE_CLEARANCE, WINDOW_EDGE_CLEARANCE, OVERHEAD_TOP, CAR_CLEARANCE },
  }
}

export type FloorplanEngine = ReturnType<typeof buildEngine>

function seedBase(scope: Registries): void {
  withRegistries(scope, () => {
    registerGroundItems()
    registerPermeableGround('lawn', 'dirt')
    registerLocale('en', enLocale)
    registerLocale('pt-BR', ptBrLocale)
  })
}

/** An engine of its own: registries, zones and locales are not shared with any other engine on the page. */
export function createFloorplan(options: CreateFloorplanOptions = {}): FloorplanEngine {
  const scope = createRegistries()
  seedBase(scope)
  const instance = buildEngine(scope)
  for (const pack of options.packs ?? []) (typeof pack === 'function' ? pack : pack.register)(instance)
  editCatalog(scope.CATALOG, options.patch?.items, options.remove?.items)
  editCatalog(scope.TEMPLATES, options.patch?.templates, options.remove?.templates)
  return instance
}

let defaultEngine: FloorplanEngine | undefined

/** The engine the global `engine` stands for, created on first use. Content packs of the old `register(engine)` calls fill this one. */
export function defaultFloorplan(): FloorplanEngine {
  if (defaultEngine) return defaultEngine
  seedBase(getDefaultRegistries())
  defaultEngine = buildEngine(getDefaultRegistries())
  return defaultEngine
}
