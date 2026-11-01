import type {
  DecorPass,
  FindsProvider,
  ResultExtensionOptions,
  ResultExtensionRun,
  GroundOverlayRule,
  FurnitureDef,
  ItemInput,
  Json,
  RoomColorDef,
  SlotLibrary,
  StateContext,
  StatePlugin,
  StyleDef,
  TemplateDef,
  ViewerLayer,
  FloorplanLocale,
  ZoneDef,
} from './types'
import type { PaletteStyleDef } from './palette'

/** All content registries of one engine instance. Content packs fill them through the `register*` functions. */
export type Registries = {
  CATALOG: Record<string, FurnitureDef>
  LIBRARIES: Record<string, SlotLibrary>
  LIBRARY_ALIAS: Record<string, string>
  TEMPLATES: Record<string, TemplateDef>
  STYLES: Record<string, StyleDef>
  STYLE_ALIAS: Record<string, string>
  PALETTE_STYLES: Record<string, PaletteStyleDef>
  ROOM_COLORS: RoomColorDef[]
  PASSES: { name: string; run: DecorPass }[]
  DECOR_PROFILES: Record<string, Json>
  GROUND_OVERLAYS: GroundOverlayRule[]
  STATE_PLUGINS: Record<string, StatePlugin>
  WALL_TOP_HEIGHTS: Record<string, number>
  SEED_KEYS: { rooms: Record<string, string>; items: Record<string, string> }
  stateDistribution: { weights: Record<string, number> | null; seedKey: string }
  RESULT_EXTENSIONS: ResultExtension[]
  FINDS_PROVIDERS: FindsProvider[]
  VIEWER_LAYERS: ViewerLayer[]
  LOCALES: Record<string, FloorplanLocale>
  ZONES: Record<string, ZoneDef>
  PERMEABLE_GROUNDS: Set<string>
}

export const createRegistries = (): Registries => ({
  CATALOG: {},
  LIBRARIES: {},
  LIBRARY_ALIAS: {},
  TEMPLATES: {},
  STYLES: {},
  STYLE_ALIAS: {},
  PALETTE_STYLES: {},
  ROOM_COLORS: [],
  PASSES: [],
  DECOR_PROFILES: {},
  GROUND_OVERLAYS: [],
  STATE_PLUGINS: { normal: { apply: () => [] } },
  WALL_TOP_HEIGHTS: { none: 0 },
  SEED_KEYS: { rooms: {}, items: {} },
  stateDistribution: { weights: null, seedKey: 'state' },
  RESULT_EXTENSIONS: [],
  FINDS_PROVIDERS: [],
  VIEWER_LAYERS: [],
  LOCALES: {},
  ZONES: {},
  PERMEABLE_GROUNDS: new Set(),
})

let defaultRegistries: Registries | undefined
let activeRegistries: Registries | undefined

/** The registries of the global (deprecated) engine, created on first use. */
export const getDefaultRegistries = (): Registries => (defaultRegistries ??= createRegistries())

/** The registries the running call reads: the instance it was made through, or the default. */
export const registries = (): Registries => activeRegistries ?? getDefaultRegistries()

/** Runs `run` with `scope` as the registries every module reads. Everything the engine does is synchronous, so the scope cannot leak between instances. */
export function withRegistries<TResult>(scope: Registries, run: () => TResult): TResult {
  const previous = activeRegistries
  activeRegistries = scope
  try {
    return run()
  } finally {
    activeRegistries = previous
  }
}

export function registerItem(def: ItemInput): FurnitureDef {
  const h = def.h
  const item: FurnitureDef = Object.assign({ front: '+z', window: h <= 0.95, low: h <= 0.5, flat: false, deck: false, rim: 0 }, def) as FurnitureDef
  registries().CATALOG[def.type] = item
  return item
}
export function registerItems(list: ItemInput[]): void {
  for (const d of list) registerItem(d)
}

export function registerLibrary(id: string, library: SlotLibrary): void {
  registries().LIBRARIES[id] = library
}
export function registerLibraryAlias(alias: string, id: string): void {
  registries().LIBRARY_ALIAS[alias] = id
}

export function registerTemplate<T extends TemplateDef>(t: T): T {
  registries().TEMPLATES[t.id] = t
  return t
}

export function registerStyle(style: StyleDef): void {
  registries().STYLES[style.id] = style
  for (const a of style.aliases || []) registries().STYLE_ALIAS[a] = style.id
}
export function registerPaletteStyle(id: string, def: PaletteStyleDef): void {
  registries().PALETTE_STYLES[id] = def
}
export function registerRoomColors(list: RoomColorDef[]): void {
  for (const d of list) {
    const i = registries().ROOM_COLORS.findIndex((x) => x.type === d.type)
    if (i >= 0) registries().ROOM_COLORS.splice(i, 1)
    registries().ROOM_COLORS.push(d)
  }
  registries().ROOM_COLORS.sort((a, b) => a.order - b.order)
}

export function registerDecorProfile(styleId: string, profile: Json): void {
  registries().DECOR_PROFILES[styleId] = profile
}
export function registerPass(name: string, run: DecorPass): void {
  const i = registries().PASSES.findIndex((p) => p.name === name)
  if (i >= 0) registries().PASSES[i] = { name, run }
  else registries().PASSES.push({ name, run })
}
export function registerGroundOverlay(rule: GroundOverlayRule): void {
  registries().GROUND_OVERLAYS.push(rule)
}
export function registerWallTop(id: string, height: number): void {
  registries().WALL_TOP_HEIGHTS[id] = height
}
/** Legacy RNG stream names for rooms and items, so seeds recorded before the English ids still reproduce. */
export function registerSeedKeys(keys: { rooms?: Record<string, string>; items?: Record<string, string> }): void {
  Object.assign(registries().SEED_KEYS.rooms, keys.rooms)
  Object.assign(registries().SEED_KEYS.items, keys.items)
}

/** Registers a house state. The engine only ships `normal`. */
export function registerState(name: string, plugin: StatePlugin): void {
  registries().STATE_PLUGINS[name] = plugin
}
/** Default state draw when `options.state` is absent: `{ state: weight }` on its own seeded stream. */
export function setStateDistribution(weights: Record<string, number> | null, seedKey = 'state'): void {
  registries().stateDistribution.weights = weights
  registries().stateDistribution.seedKey = seedKey
}
export const listStates = (): string[] => Object.keys(registries().STATE_PLUGINS)

export function resolveStyleId(id: string | undefined): string {
  const s = id ?? ''
  return registries().STYLE_ALIAS[s] ?? s
}
export function styleOf(id: string): StyleDef {
  return registries().STYLES[id] || registries().STYLES.budget || Object.values(registries().STYLES)[0]
}

export type { StateContext }

export interface ResultExtension {
  name: string
  run: ResultExtensionRun
  after: string[]
  seedKey: string
}

/** Adds a named piece to every result, after the state and before the zoning report; its output lands in `result[name]`. */
export function registerResultExtension(name: string, run: ResultExtensionRun, options: ResultExtensionOptions = {}): void {
  const entry: ResultExtension = { name, run, after: options.after || [], seedKey: options.seedKey ?? name }
  const i = registries().RESULT_EXTENSIONS.findIndex((x) => x.name === name)
  if (i >= 0) registries().RESULT_EXTENSIONS[i] = entry
  else registries().RESULT_EXTENSIONS.push(entry)
}

/** Registers who answers what a container holds (the item packs, from phase 3 on). */
export function registerFindsProvider(provider: FindsProvider): void {
  registries().FINDS_PROVIDERS.push(provider)
}

/** Adds (or replaces, by id) a layer of the 2D viewer; drawn after the items, before the labels. */
export function registerViewerLayer(layer: ViewerLayer): void {
  const i = registries().VIEWER_LAYERS.findIndex((x) => x.id === layer.id)
  if (i >= 0) registries().VIEWER_LAYERS[i] = layer
  else registries().VIEWER_LAYERS.push(layer)
}
