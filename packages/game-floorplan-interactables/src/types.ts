import type { MessageKey } from './locale.js'
import type { TypeMapEntry } from './tables.js'

/** Loosely typed data: the plan of the engine (`result` of `generate`), the kit objects and the specs of the household pack. */
export type Json = any

export type Registry<T> = Readonly<Record<string, T | null | undefined>>

export interface AdapterOptions {
  /** The `game-interactables` module (or its global): `createWorld`, `fitsSlot`, `hashString`. Required. */
  GameInteractables?: Json
  /** The `game-interactables-household` module (or its global): `createHousehold`, `createRecorder`. Required. */
  GameInteractablesHousehold?: Json
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
  preference?: Registry<(stack: Json, context: { frozen(stack: Json): boolean; group(stack: Json): string | null; drawerItem(stack: Json): boolean }) => string[]>
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
  household: Json
  /** Plans the objects of a plan; pure data, nothing is drawn. Options: `floor`, `externals`, `seed`, `night`, `lightsOn`, `chairs`, `originX`, `originZ`, `inw`, `base`. */
  plan(result: Json, options?: Json): Json
  /** Creates the kit world with texts, items, loot and the water network. Options: `water` (`{ consume(point, liters) }`), `seed`, `grid`, `onEvent`, `canInteract`, `lightsOn`. */
  createWorld(result: Json, options?: Json): Json
  /** Adds the planned objects to the world and fits the doors against the walls. Options: `build(type, item)`, `isBlocked(x, z, floor)`, `lightsOn`. */
  add(world: Json, plan: Json, options?: Json): Json
  /** `(x, z, floor)` to true inside a wall of the plan. Options: `originX`, `originZ`, `inw`, `margin`. */
  blockedOf(result: Json, options?: Json): (x: number, z: number, floor?: number | null) => boolean
  /** The plumbing point behind a global fixture id (`object:fixture`) of a world made by `createWorld`. */
  pointOf(world: object, fixtureId: string): string | undefined
  /** The spec of an object the adapter builds itself (`lamp`, `gas_piped`). */
  ownSpec(entry: Json): Json
  /** The registries in use (defaults with the overrides of the game). */
  registries: Record<string, Json>
}
