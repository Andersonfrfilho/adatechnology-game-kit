import type {
  DecorPass,
  GroundOverlayRule,
  ItemDef,
  ItemInput,
  Json,
  RoomColorDef,
  SlotLibrary,
  StateContext,
  StatePlugin,
  StyleDef,
  TemplateDef,
} from './types'
import type { PaletteStyleDef } from './palette'

/** All content registries of the engine. Content packs fill them through the `register*` functions. */
export const CATALOG: Record<string, ItemDef> = {}
export const LIBRARIES: Record<string, SlotLibrary> = {}
export const LIBRARY_ALIAS: Record<string, string> = {}
export const TEMPLATES: Record<string, TemplateDef> = {}
export const STYLES: Record<string, StyleDef> = {}
export const STYLE_ALIAS: Record<string, string> = {}
export const PALETTE_STYLES: Record<string, PaletteStyleDef> = {}
export const ROOM_COLORS: RoomColorDef[] = []
export const PASSES: { name: string; run: DecorPass }[] = []
export const DECOR_PROFILES: Record<string, Json> = {}
export const GROUND_OVERLAYS: GroundOverlayRule[] = []
export const STATE_PLUGINS: Record<string, StatePlugin> = { normal: { apply: () => [] } }
export const WALL_TOP_HEIGHTS: Record<string, number> = { none: 0 }
export const SEED_KEYS: { rooms: Record<string, string>; items: Record<string, string> } = { rooms: {}, items: {} }
export const stateDistribution: { weights: Record<string, number> | null; seedKey: string } = { weights: null, seedKey: 'state' }

export function registerItem(def: ItemInput): ItemDef {
  const h = def.h
  const item: ItemDef = Object.assign({ front: '+z', window: h <= 0.95, low: h <= 0.5, flat: false, deck: false, rim: 0 }, def) as ItemDef
  CATALOG[def.type] = item
  return item
}
export function registerItems(list: ItemInput[]): void {
  for (const d of list) registerItem(d)
}

export function registerLibrary(id: string, library: SlotLibrary): void {
  LIBRARIES[id] = library
}
export function registerLibraryAlias(alias: string, id: string): void {
  LIBRARY_ALIAS[alias] = id
}

export function registerTemplate<T extends TemplateDef>(t: T): T {
  TEMPLATES[t.id] = t
  return t
}

export function registerStyle(style: StyleDef): void {
  STYLES[style.id] = style
  for (const a of style.aliases || []) STYLE_ALIAS[a] = style.id
}
export function registerPaletteStyle(id: string, def: PaletteStyleDef): void {
  PALETTE_STYLES[id] = def
}
export function registerRoomColors(list: RoomColorDef[]): void {
  for (const d of list) {
    const i = ROOM_COLORS.findIndex((x) => x.type === d.type)
    if (i >= 0) ROOM_COLORS.splice(i, 1)
    ROOM_COLORS.push(d)
  }
  ROOM_COLORS.sort((a, b) => a.order - b.order)
}

export function registerDecorProfile(styleId: string, profile: Json): void {
  DECOR_PROFILES[styleId] = profile
}
export function registerPass(name: string, run: DecorPass): void {
  const i = PASSES.findIndex((p) => p.name === name)
  if (i >= 0) PASSES[i] = { name, run }
  else PASSES.push({ name, run })
}
export function registerGroundOverlay(rule: GroundOverlayRule): void {
  GROUND_OVERLAYS.push(rule)
}
export function registerWallTop(id: string, height: number): void {
  WALL_TOP_HEIGHTS[id] = height
}
/** Legacy RNG stream names for rooms and items, so seeds recorded before the English ids still reproduce. */
export function registerSeedKeys(keys: { rooms?: Record<string, string>; items?: Record<string, string> }): void {
  Object.assign(SEED_KEYS.rooms, keys.rooms)
  Object.assign(SEED_KEYS.items, keys.items)
}

/** Registers a house state. The engine only ships `normal`. */
export function registerState(name: string, plugin: StatePlugin): void {
  STATE_PLUGINS[name] = plugin
}
/** Default state draw when `options.state` is absent: `{ state: weight }` on its own seeded stream. */
export function setStateDistribution(weights: Record<string, number> | null, seedKey = 'state'): void {
  stateDistribution.weights = weights
  stateDistribution.seedKey = seedKey
}
export const listStates = (): string[] => Object.keys(STATE_PLUGINS)

export function resolveStyleId(id: string | undefined): string {
  const s = id ?? ''
  return STYLE_ALIAS[s] ?? s
}
export function styleOf(id: string): StyleDef {
  return STYLES[id] || STYLES.budget || Object.values(STYLES)[0]
}

export type { StateContext }
