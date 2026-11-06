/**
 * What the house reads of the adapters the game hands it, by shape: one domain adapter does not import another (layer rule
 * `no-domain-adapter-to-adapter`), nor a content pack (`adapter-not-content`). The game passes `game-interactables-three`'s
 * `createThreeAdapter`, `game-destruction-three`'s renderer and `game-vegetation-species` by option; these types hold only what
 * the house calls, so the real modules fit them.
 */
import type * as THREE_NS from 'three'
import type { catenary } from '@adatechnology/game-shapes-three'
import type { PlantSpec } from '@adatechnology/game-vegetation'
import type { ObjectSpec, World } from '@adatechnology/game-interactables'
import type { FloorplanAdapter } from '@adatechnology/game-floorplan-interactables'
import type { Vec3 } from './kernel-types.js'

/** A TV screen of the interactables adapter (`createScreen`): a canvas material that turns on and changes channel. */
export interface InteractablesScreen {
  material: THREE_NS.MeshStandardMaterial
  readonly on: boolean
  readonly channel: number
  setOn(on: boolean): void
  setChannel(channel: number): void
  update(dt: number): void
  dispose(): void
}

/** The particle effects of the interactables adapter (`createEffects`): water, steam, sparks and flames of the objects. */
export interface InteractablesEffects {
  update(dt: number, emitters: readonly unknown[], camera?: unknown): void
  stats(): { alive: number }
  dispose(): void
}

/** What `finish` of a mesh api gives back: the object's groups, its moving parts and the lights its builders asked for. */
export interface InteractablesMeshResult {
  group: THREE_NS.Group
  parts: Record<string, THREE_NS.Group>
  lights: THREE_NS.Light[]
}

/** The interactables adapter bound to the house's three.js (`createThreeAdapter(THREE, options)` of game-interactables-three). */
export interface InteractablesGfx {
  createMeshApi(options?: { quality?: string; materials?: Record<string, THREE_NS.Material | undefined>; shadows?: boolean; mergeParts?: boolean; swayAmplitude?: number }): {
    api: Parameters<FloorplanAdapter['household']['build']>[2]
    finish(spec?: ObjectSpec): InteractablesMeshResult
  }
  syncObject(world: World, objectId: string, parts: Record<string, THREE_NS.Object3D>, options?: { time?: number }): void
  createEffects(scene: THREE_NS.Object3D, options?: Record<string, unknown>): InteractablesEffects
  createScreen(options?: { w?: number; h?: number; seed?: number }): InteractablesScreen
  createCord(points: readonly Vec3[], radius: number, material: THREE_NS.Material): THREE_NS.Mesh
  catenary: typeof catenary
}

/** What draws a part of a bound object: a mesh or group, or a vertex range `[v0, v1)` of a mesh. */
export type BoundMeshes = THREE_NS.Object3D | { mesh: THREE_NS.Mesh; range: [number, number] }

/** The destruction renderer the game hands the house (`createDestructionRenderer(THREE, { scene, world })` of game-destruction-three). */
export interface HouseDestructionRenderer {
  bind(objectId: string, root: THREE_NS.Object3D, options?: { parts?: Record<string, BoundMeshes | BoundMeshes[]>; onFrame?: (dt: number) => void }): void
  unbind(objectId: string): void
  restore(objectId: string): void
}

/** The species pack the game hands the house's vegetation (`game-vegetation-species`): a plant spec by species id. */
export interface SpeciesLibrary {
  toSpec(species: string): PlantSpec
}
