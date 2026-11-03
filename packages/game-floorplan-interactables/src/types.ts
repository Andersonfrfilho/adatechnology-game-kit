import type { FloorplanResult, PlanWall, ResultFloor, ResultItem, ResultRoom } from '@adatechnology/game-floorplan'
import type { Chimney, Electrical, Gas, Plumbing } from '@adatechnology/game-floorplan-structure'
import type { ObjectSpec, World, WorldOptions, createWorld, fitsSlot, hashString } from '@adatechnology/game-interactables'
import type { Household, HouseholdItem, createHousehold, createRecorder } from '@adatechnology/game-interactables-household'
import type { MessageKey } from './locale.js'
import type { TypeMapEntry } from './tables.js'

/** An open value from a game or a plugin: narrow it before use. */
export type Json = unknown

/** What the adapter uses of `game-interactables` (the module or its global). */
export interface InteractablesKit {
  createWorld: typeof createWorld
  fitsSlot: typeof fitsSlot
  hashString: typeof hashString
}

/** What the adapter uses of `game-interactables-household` (the module or its global). */
export interface HouseholdKit {
  createHousehold: typeof createHousehold
  createRecorder: typeof createRecorder
}

/** A stack of content of the plan (the finds of a container). */
export interface ContentStack {
  itemId: string
  count?: number
  group?: string | null
  pickable?: boolean
}

/** The electric shower of the plan (the structure pack annotates the item). */
export interface ShowerHeater {
  electric: boolean
  powerW?: number
  outlet?: string
}

/** A furniture item of the plan, with the fields the structure pack adds (outlet, shower, gas). */
export interface SourceItem extends ResultItem {
  /** Outlet the appliance plugs into. */
  outlet?: string
  showerHeater?: ShowerHeater
  /** Gas of a stove: `piped` or `cylinder`. */
  gas?: string
  /** Cylinder of the stove. */
  cylinder?: string | null
  /** Where a gas cylinder stands (`under_counter`...). */
  placement?: string | null
}

/** The chimney of the structure pack; it may name its fireplace or stove. */
export interface SourceChimney extends Chimney {
  fireplace?: string
  stove?: string
}

/** The parts of a `generate` result the adapter reads (the plan with the structure pack). */
export interface AdapterSource {
  template?: string
  seed?: number | string
  state?: string
  items?: SourceItem[]
  floors?: Pick<ResultFloor, 'index' | 'y0' | 'ceiling'>[]
  rooms?: Pick<ResultRoom, 'id' | 'floor' | 'ceiling'>[]
  walls?: Pick<PlanWall, 'floor' | 'axis' | 'u0' | 'v0' | 'u1' | 'v1' | 'thickness'>[]
  colors?: Readonly<Record<string, number | string | undefined>>
  /** Stacks of content by item id (`<id>#overhead` for the wall cabinet over a counter). */
  contents?: Readonly<Record<string, ContentStack[]>>
  utilities?: { electrical?: Electrical | null; gas?: Gas | null; plumbing?: Plumbing | null } | null
  structureExtras?: { chimney?: SourceChimney } | null
}

/** A plan the adapter takes: a `generate` result (its extensions are read as above) or the same data written by hand. */
export type SourcePlan = AdapterSource | FloorplanResult

/** `lightsOn` of the options: one value for every lamp, or one per lamp. */
export type LightsOn = boolean | ((id: string, entry: PlanEntry) => unknown)

/** The item the household pack draws, with what the adapter adds. */
export type EntryItem = HouseholdItem

/** What the plan decided for an object: its outlet, gas, circuit, water. */
export interface EntryConnections {
  outlet?: string
  shower?: ShowerHeater
  gas?: string
  cylinder?: string | null
  /** Top of the outside chimney, world coordinates. */
  chimneyTop?: [number, number, number]
  circuit?: string | null
  controls?: string[]
  /** Global fuel id (`object:fuel`) of a stove. */
  fuel?: string
  flowLpm?: number
  outletCircuit?: string
}

/** An object of the kit planned from the plan. */
export interface PlanEntry {
  id: string
  type: string
  item: EntryItem
  /** Id of the furniture of the plan it came from. */
  origin: string
  floor: number
  floorY: number
  connections: EntryConnections
  watts?: number
  lit?: boolean
  /** Plumbing point of the object. */
  point?: string
  /** How far `add` moved it away from the wall. */
  moved?: number
}

export interface PlannedFixture {
  object: string
  fixture: string
  global: string
  point: string
  pointKind: string
}

export interface PlannedCylinder {
  id: string
  stove: string | null
  place: string | null
}

/** What `plan` returns: pure data, nothing drawn. */
export interface AdapterPlan {
  version: string
  template: string | undefined
  seed: number | string | undefined
  floor: number | null
  items: PlanEntry[]
  outlets: string[]
  switches: string[]
  lights: string[]
  lanterns: string[]
  canisters: string[]
  serviceEntrance: string | null
  panel: string | null
  meter: string | null
  conduits: string[]
  cylinders: PlannedCylinder[]
  stoves: string[]
  fixtures: PlannedFixture[]
  points: Record<string, string>
  mapped: string[]
  chairs: string[]
  unmapped: Record<string, number>
  discarded: number
  warnings: string[]
  origin: { x: number; z: number; inw: number; base: number }
}

export interface PlanOptions {
  floor?: number | null
  externals?: boolean
  seed?: number | string | null
  night?: boolean
  lightsOn?: LightsOn
  chairs?: boolean
  originX?: number
  originZ?: number
  inw?: number
  base?: number
}

/** The water network behind the fixtures. */
export interface WaterNetwork {
  consume(point: string, liters: number): number
}

export interface CreateWorldOptions {
  water?: WaterNetwork | null
  seed?: number | string | null
  grid?: boolean | null
  onEvent?: WorldOptions['onEvent']
  canInteract?: WorldOptions['canInteract']
  lightsOn?: LightsOn
}

export type BlockedFn = (x: number, z: number, floor?: number | null) => boolean

export interface AddOptions {
  build?: (type: string, item: EntryItem) => ObjectSpec | null | undefined
  isBlocked?: BlockedFn | null
  lightsOn?: LightsOn
}

export interface AddResult {
  added: number
  /** Parts that do not open fully (`t` < 1). */
  parts: { object: string; part: string; t: number }[]
  hinges: Record<string, string>
  moved: Record<string, number>
  warnings: string[]
}

export interface BlockedOptions {
  originX?: number
  originZ?: number
  inw?: number
  margin?: number
}

export type Registry<T> = Readonly<Record<string, T | null | undefined>>

export interface AdapterOptions {
  /** The `game-interactables` module (or its global): `createWorld`, `fitsSlot`, `hashString`. Required. */
  GameInteractables?: InteractablesKit
  /** The `game-interactables-household` module (or its global): `createHousehold`, `createRecorder`. Required. */
  GameInteractablesHousehold?: HouseholdKit
  /** Locale of the household pack and of the warnings (default `pt-BR`, the team's). */
  locale?: string
  /** Region of the household pack (default `br`, the team's). */
  region?: string
  /** `false`: no chairs around the tables (also a plan option). */
  chairs?: boolean
  /** Side of the dining chair (m, default 0.45, the chair of the pack). */
  chairSide?: number
  /** Maps the id of an object to the key of its seeded random (default: the id itself); the house renderer passes its `seedKey` to reproduce the team's seeds. */
  seedKey?: (id: string) => string | null | undefined
  /** Texts of the warnings and errors, by key. */
  messages?: Partial<Record<MessageKey, string>>
  /** Furniture type of the plan to object of the kit; `null` drops a default entry. */
  typeMap?: Registry<TypeMapEntry>
  /** Id of a content stack to household item. */
  contentMap?: Registry<string>
  /** Group of a content stack (`food`, `tool`...) to the household item used when no table entry exists. */
  contentByGroup?: Registry<string>
  /** Item for a stack that is in no table, is no household item and has no known group (default `crumpled_paper`). */
  contentFallback?: string
  /** Group of an item id, for stacks that carry none (the goods finds provider answers `{ itemId, count }` only). */
  groupOf?: (itemId: string) => string | null | undefined
  /** Tables that get chairs: furniture type to `dining` or `office`. */
  chairTables?: Registry<'dining' | 'office'>
  /** Kind of plumbing point to the fixtures of the household object. */
  fixturesOfPoint?: Registry<readonly string[]>
  /** Substitute items by object type, the last resort when nothing of the category fits. */
  substitutes?: Registry<readonly string[]>
  /** Order of the containers of an object for a stack, by household type. */
  preference?: Registry<(stack: ContentStack, context: { frozen(stack: ContentStack): boolean; group(stack: ContentStack): string | null; drawerItem(stack: ContentStack): boolean }) => string[]>
  /** Types the adapter builds itself (default `lamp`, `gas_piped`). */
  ownTypes?: Registry<true>
  /** Items that go to the freezer first (default `ice_cream`, `frozen_meat`). */
  frozenItems?: readonly string[]
  /** Items that go to the wardrobe drawers first (default `underwear`, `socks`). */
  drawerItems?: readonly string[]
}

export interface FloorplanAdapter {
  version: string
  /** The household pack the adapter was made with (`types`, `items`, `loot`, `strings`, `build`). */
  household: Household
  /** Plans the objects of a plan; pure data, nothing is drawn. */
  plan(result: SourcePlan, options?: PlanOptions | null): AdapterPlan
  /** Creates the kit world with texts, items, loot and the water network. */
  createWorld(result: SourcePlan, options?: CreateWorldOptions | null): World
  /** Adds the planned objects to the world and fits the doors against the walls. */
  add(world: World, plan: AdapterPlan, options?: AddOptions | null): AddResult
  /** `(x, z, floor)` to true inside a wall of the plan. */
  blockedOf(result: SourcePlan, options?: BlockedOptions | null): BlockedFn
  /** The plumbing point behind a global fixture id (`object:fixture`) of a world made by `createWorld`. */
  pointOf(world: object, fixtureId: string): string | undefined
  /** The spec of an object the adapter builds itself (`lamp`, `gas_piped`). */
  ownSpec(entry: PlanEntry): ObjectSpec
  /** The registries in use (defaults with the overrides of the game). */
  registries: AdapterRegistries
}

export interface AdapterRegistries {
  typeMap: Record<string, TypeMapEntry>
  contentMap: Record<string, string>
  contentByGroup: Record<string, string>
  chairTables: Record<string, 'dining' | 'office'>
  fixturesOfPoint: Record<string, readonly string[]>
  substitutes: Record<string, readonly string[]>
  preference: Record<string, (stack: ContentStack, context: { frozen(stack: ContentStack): boolean; group(stack: ContentStack): string | null; drawerItem(stack: ContentStack): boolean }) => string[]>
  ownTypes: Record<string, true>
}
