import type * as GameVegetationMain from '@adatechnology/game-vegetation'
import type * as GameVegetationAdapter from '@adatechnology/game-vegetation/three'
import type * as GameVegetationSpeciesMain from '@adatechnology/game-vegetation-species'
import type { DestructibleSpec, Vec3 } from '@adatechnology/game-contracts'

/** The vegetation engine with its three.js adapter, as the `GameVegetation` global of the IIFE build has it. */
export type VegetationSdk = typeof GameVegetationMain & typeof GameVegetationAdapter
/** The species pack. */
export type SpeciesSdk = typeof GameVegetationSpeciesMain

/** The shared materials of the plants (wind and the actors that bend them). */
export type MaterialsLike = GameVegetationAdapter.VegetationMaterials

export type VegetationTestOptions = {
  /** `en` or `pt-BR` (default). The room asks `items(locale)` and `scenarios(locale)` itself; this is the language of the bench and of the lines the module writes. */
  readonly locale?: string
  /** The vegetation engine (default: `@adatechnology/game-vegetation` with its three adapter). A game that brings its own build of it passes it here. */
  readonly GameVegetation?: VegetationSdk
  /** The species pack (default: `@adatechnology/game-vegetation-species`). */
  readonly GameVegetationSpecies?: SpeciesSdk
  /** The materials of the plants, when the game already has them (default: made from the first three.js namespace the module is built with). */
  readonly materials?: MaterialsLike
  /** Seed of the plants (the Viveiro's module uses 3, so the items are the same in every run). */
  readonly seed?: number
  /** Where the nursery lot stands in the room, the corner of its 12 x 20 m plot: `[x, z]` (default `[-6, 14]`). */
  readonly nurseryOrigin?: readonly [number, number]
}

/** The part of the test room the scenarios use (the room's `ScenarioContext.room` has all of it). */
export type VegetationRoom = {
  spawn(item: string, position?: Vec3, rotationY?: number): SpawnedPlant
  setTool(weaponId: string): void
  /** Lets the tool in hand finish its draw time (the room's rule: a tool cannot be used the moment it is taken). */
  waitUntilReady(): void
  look(position: Vec3, target: Vec3): void
  use(hold?: number): void
  walk(to: Vec3, seconds: number): void
  camera: { position: { x: number; y: number; z: number } }
  world: {
    raycast(origin: Vec3, direction: Vec3, max: number): { object: string; part?: string; point: Vec3 } | null
    nearestJoint(object: string, point: Vec3, range: number, tool?: string): { id: string } | null
    snapshot(object: string): WorldObjectState | null
    state(object: string): WorldObjectState | null
    part(object: string, part: string): WorldPartState | null
    ids(): string[]
  }
  log: { entries(filter: { type?: string; objectId?: string }): readonly WorldLogEntry[] }
}

/** What a scenario needs of the room: the pass/fail line, time, and the room for the ones that shoot, cut and burn. */
export type VegetationContext = {
  room: VegetationRoom
  expect(condition: boolean, label: string, data?: Record<string, unknown>): void
  step(seconds: number): void
}

/** A plant the room spawned: its id in the world and its root, which carries the destructible spec the module made (`userData.vegSpec`). */
export type SpawnedPlant = {
  objectId: string
  root: { position: { x: number; y: number; z: number }; userData: { vegSpec?: DestructibleSpec } & Record<string, unknown> }
}

/** A part of an object as the destruction world reports it (the fields the scenarios read). */
export type WorldPartState = {
  id: string
  status: string
  hp: number
  maxHp: number
  temperature: number
  burning: boolean
  char?: number
  fuel: number
  holes?: readonly unknown[]
  material: string
}

/** An object as the destruction world reports it: its parts and the groups they hold together in. */
export type WorldObjectState = { parts: WorldPartState[]; groups: string[][] }

/** A line of the room's log. */
export type WorldLogEntry = { type: string; objectId?: string; data?: { joint?: string; joints?: string[]; jointsOpened?: number } & Record<string, unknown> }
