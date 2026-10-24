import { CAR_CLEARANCE, DOOR_CLEARANCE, DOOR_EDGE_CLEARANCE, OVERHEAD_TOP, PLAYER_RADIUS, WALL_THICKNESS, WINDOW_EDGE_CLEARANCE } from './constants'
import { findsFor } from './extensions'
import { generate, limitsOf, listTemplates, slots, validate } from './generate'
import { registerGroundItems } from './ground-items'
import { listLocales, registerLocale, translate } from './locale'
import { HIGH_SATURATION, MIN_FABRIC_FLOOR_CONTRAST, MIN_WALL_FLOOR_CONTRAST, hexString, intToHsl, lstar, palette } from './palette'
import {
  CATALOG,
  LIBRARIES,
  PALETTE_STYLES,
  STYLES,
  TEMPLATES,
  VIEWER_LAYERS,
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

import enLocale from './locales/en.json'
import ptBrLocale from './locales/pt-BR.json'

registerGroundItems()
registerPermeableGround('lawn', 'dirt')
registerLocale('en', enLocale)
registerLocale('pt-BR', ptBrLocale)

export const version = '0.1.0'

/**
 * The engine as a single object. Content packs take it as an argument (`register(engine)`), so that
 * several bundles (ESM or IIFE) always fill the same registries.
 */
export const engine = {
  version,
  generate,
  slots,
  validate,
  palette,
  limitsOf,
  listTemplates,
  listStates,
  // content registration
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
  registerViewerLayer,
  viewerLayers: VIEWER_LAYERS,
  blocksWindow,
  // zoning
  defineZone,
  getZone,
  listZones,
  checkLot,
  registerPermeableGround,
  // kits and data
  slotKit,
  translate,
  listLocales,
  templates: TEMPLATES,
  catalog: CATALOG,
  libraries: LIBRARIES,
  styles: STYLES,
  paletteStyles: PALETTE_STYLES,
  createRng,
  mulberry32,
  hashString,
  overlaps,
  windowZone,
  openingZones,
  color: { lstar, hex: hexString, hsl: intToHsl, HIGH_SATURATION, MIN_WALL_FLOOR_CONTRAST, MIN_FABRIC_FLOOR_CONTRAST },
  constants: { WALL_THICKNESS, DOOR_CLEARANCE, PLAYER_RADIUS, DOOR_EDGE_CLEARANCE, WINDOW_EDGE_CLEARANCE, OVERHEAD_TOP, CAR_CLEARANCE },
}
export type FloorplanEngine = typeof engine

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
