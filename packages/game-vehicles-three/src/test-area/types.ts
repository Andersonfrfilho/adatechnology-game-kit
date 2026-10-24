import type { Vec3 } from '@adatechnology/game-contracts'
import type { VehicleKit } from '@adatechnology/game-vehicles'

/** What the module needs of a document (canvas textures of the kit): a real `document`, or a stub in Node. */
export type DocumentLike = { createElement(tag: string): unknown }

/** The host's effects, when it has them (`host.effects` of `game-vfx-three`): the module asks by id and writes no particle code. */
export type EffectsLike = { play(id: string, options?: { readonly position?: Vec3; readonly direction?: Vec3; readonly scale?: number; readonly [key: string]: unknown }): unknown }

/** The events the module turns into effect requests, and the effect id each one asks for. A game maps its own ids over these. */
export type VehicleEffectIds = {
  readonly ignite: string
  readonly explode: string
  readonly glass: string
  readonly sparks: string
  readonly leak: string
  readonly exhaust: string
}

export const defaultEffectIds: VehicleEffectIds = {
  ignite: 'vehicle.fire',
  explode: 'vehicle.explosion',
  glass: 'vehicle.glass',
  sparks: 'vehicle.sparks',
  leak: 'vehicle.leak',
  exhaust: 'vehicle.exhaust',
}

export type VehiclesTestOptions = {
  /** `en` or `pt-BR` (default). */
  readonly locale?: string
  /** The kit the vehicles are built with, per three.js namespace. Default: `createVehicleKit` with the fleet installed (`installFleet`). */
  readonly createKit?: (THREE: unknown) => VehicleKit
  readonly document?: DocumentLike
  /** The three.js namespace the door, hood and trunk clips are computed with (they are plain numbers, so any copy works). Default: the global `THREE`; without either the items bring no clips. */
  readonly three?: unknown
  /** The vehicles to lay out, as fleet ids (default the 8 of the Frota test: hatch, sedan, pickup, sport bike, box truck, city bus, battle tank, attack helicopter). */
  readonly vehicles?: readonly string[]
  /** Effect ids requested through `host.effects` (the defaults are the ids the vfx recipes of the vehicles use). */
  readonly effects?: Partial<VehicleEffectIds>
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
