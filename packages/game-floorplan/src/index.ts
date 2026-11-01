import { findsAnswer, findsFor } from './extensions'
import { generate, limitsOf, listTemplates, slots, validate } from './generate'
import { createFloorplan, defaultFloorplan, version } from './instance'
import type { CreateFloorplanOptions, FloorplanEngine, FloorplanPack } from './instance'
import { listLocales, registerLocale, translate } from './locale'
import { palette } from './palette'
import {
  registerViewerLayer,
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
  registerWallTop,
  setStateDistribution,
} from './registry'
import { createRng, hashString, mulberry32 } from './rng'
import { slotKit } from './slot-kit'
import { checkLot, defineZone, getZone, listZones, registerPermeableGround } from './zoning'
import { overlaps, openingZones } from './geometry'
import { blocksWindow, windowZone } from './queries'

export { version, createFloorplan, defaultFloorplan }
export type { CreateFloorplanOptions, FloorplanEngine, FloorplanPack }

/**
 * The global engine. Content packs take it as an argument (`register(engine)`), so that several bundles (ESM or IIFE) fill the same registries.
 * @deprecated use `createFloorplan({ packs, patch, remove })`, an engine of its own, or `defaultFloorplan()` for the shared one.
 */
export const engine: FloorplanEngine = defaultFloorplan()

export {
  generate,
  slots,
  validate,
  palette,
  limitsOf,
  listTemplates,
  listStates,
  registerItem,
  registerItems,
  registerLibrary,
  registerLibraryAlias,
  registerTemplate,
  registerStyle,
  registerPaletteStyle,
  registerRoomColors,
  registerDecorProfile,
  registerPass,
  registerGroundOverlay,
  registerWallTop,
  registerSeedKeys,
  registerState,
  setStateDistribution,
  registerLocale,
  registerResultExtension,
  registerFindsProvider,
  findsFor,
  findsAnswer,
  registerViewerLayer,
  blocksWindow,
  translate,
  listLocales,
  defineZone,
  getZone,
  listZones,
  checkLot,
  registerPermeableGround,
  slotKit,
  createRng,
  mulberry32,
  hashString,
  overlaps,
  windowZone,
  openingZones,
}
export type * from './types'
export type { PaletteDraw, PaletteEarly, PaletteStyleDef } from './palette'
export * from './silhouettes'
