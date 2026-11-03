import type { EffectSink, Vec3 } from '@adatechnology/game-contracts'
import type { VehicleKit } from '@adatechnology/game-vehicles'

import type { VehicleFleetContent } from '../build'

/** The fleet the area runs on: its palettes and sizes, and how it is installed in a kit (`defaultVehicleFleet()` of `game-kit-defaults`). */
export type VehiclesTestFleet = VehicleFleetContent & { installFleet(kit: VehicleKit): void }

/** What the module needs of a document (canvas textures of the kit): a real `document`, or a stub in Node. */
export type DocumentLike = { createElement(tag: string): unknown }

/** The host's effects (`host.effects`, an `EffectSink` of the contracts: `game-vfx-three` is one): the module asks by id and writes no particle code. */
export type EffectsLike = EffectSink

/** The events the module turns into effect requests, and the effect id each one asks for. A game maps its own ids over these. */
export type VehicleEffectIds = {
  readonly ignite: string
  readonly explode: string
  readonly glass: string
  readonly sparks: string
  readonly leak: string
  /** The leak of a pierced tank caught fire: the whole sequence (fire along the pool, then the blast). `leak` is only the pool and the drips. */
  readonly leakIgnited: string
  readonly exhaust: string
}

export const defaultEffectIds: VehicleEffectIds = {
  ignite: 'vehicle_fire',
  explode: 'car_fuel_tank',
  glass: 'glass_burst',
  sparks: 'impact_metal',
  leak: 'vehicle_leak',
  leakIgnited: 'vehicle_leak_ignited',
  exhaust: 'vehicle_exhaust',
}

/** The sounds the module asks of `host.audio`, by id of the host's banks. `engine` is a loop (the game's saw through a 400 Hz low-pass), `horn` and `crash` one-shots. */
export type VehicleSoundIds = { readonly engine: string; readonly horn: string; readonly crash: string }

export const defaultSoundIds: VehicleSoundIds = { engine: 'engine_saw', horn: 'horn', crash: 'sfx_impact' }

/** A damaged vehicle of the area: the item id, the fleet vehicle it is built from and the scenario of the kit applied while building. */
export type VehicleWreck = { readonly key: string; readonly vehicle: string; readonly scenario: string }

export const DEFAULT_TEST_WRECKS: readonly VehicleWreck[] = [
  { key: 'sedan_burnt', vehicle: 'midsize_sedan', scenario: 'burnt' },
  { key: 'hatch_burnt', vehicle: 'compact_hatch', scenario: 'burnt' },
]

export type VehiclesTestOptions = {
  /**
   * The fleet content: paint palettes, measured sizes and the install into the default kit (`defaultVehicleFleet()` of `game-kit-defaults`). Default the ones of `game-vehicles-fleet`.
   * @deprecated pass `fleet`; the default is removed in the next major.
   */
  readonly fleet?: VehiclesTestFleet
  /** `en` or `pt-BR` (default). */
  readonly locale?: string
  /** The kit the vehicles are built with, per three.js namespace. Default: `createVehicleKit` with the fleet installed (`fleet.installFleet`). */
  readonly createKit?: (THREE: unknown) => VehicleKit
  readonly document?: DocumentLike
  /** The three.js namespace the door, hood and trunk clips are computed with (they are plain numbers, so any copy works). Default: the global `THREE`; without either the items bring no clips. */
  readonly three?: unknown
  /** The vehicles to lay out, as fleet ids (default the 8 of the Frota test: hatch, sedan, pickup, sport bike, box truck, city bus, battle tank, attack helicopter). */
  readonly vehicles?: readonly string[]
  /** Wrecks laid out after the vehicles: item `key` is the fleet vehicle `vehicle` built with the registered damage `scenario` (default `sedan_burnt` and `hatch_burnt`, the fleet's `burnt`; an empty list lays none). */
  readonly wrecks?: readonly VehicleWreck[]
  /** Effect ids requested through `host.effects` (the defaults are ids of `game-vfx`: the Garagem's `car_fuel_tank` blast, the `vehicle_fire`, `vehicle_leak` (pool and drips only), `vehicle_leak_ignited` (the whole sequence) and `vehicle_exhaust` recipes written around a car from `engine_smoke` and `fuel_leak`, and the point-based `glass_burst` and `impact_metal`). */
  readonly effects?: Partial<VehicleEffectIds>
  /** Sound ids requested through `host.audio` (the defaults are the `game-audio` ones: `engine_saw`, `horn`, `sfx_impact`). */
  readonly sounds?: Partial<VehicleSoundIds>
}

/** The part of the test room the scenarios use (the room's `ScenarioContext.room` has all of it). */
export type PartView = {
  holes: { through?: boolean }[]
  cracks: unknown[]
  dents: unknown[]
  status: string
  hp: number
  maxHp: number
  temperature: number
  burning: boolean
  liters: number
  melt: number
}

export type SpawnedVehicle = { objectId: string; root: { userData: Record<string, unknown> } }

export type VehiclesRoom = {
  spawn(item: string, position?: Vec3, rotationY?: number): SpawnedVehicle
  setTool(weaponId: string): void
  /** Lets the tool in hand finish its draw time (the room's rule: a weapon cannot fire the moment it is taken). */
  waitUntilReady(): void
  look(position: Vec3, target: Vec3): void
  use(hold?: number): void
  playAnimation(clipId: string, objectId?: string): boolean
  world: {
    part(object: string, part: string): PartView
    hit(object: string, hit: Record<string, unknown>): unknown
    disassemble(object: string, joint: string, tool: string, dt: number): number
    state(object: string): { joints: { id: string; open: boolean }[]; groups: unknown[][] }
  }
  log: { entries(filter: { type?: string; objectId?: string }): readonly unknown[] }
}

/** What a scenario needs of the room: the pass/fail line, time, and the room for the ones that shoot and hit. */
export type VehiclesContext = {
  room: VehiclesRoom
  expect(condition: boolean, label: string, data?: Record<string, unknown>): void
  step(seconds: number): void
}
