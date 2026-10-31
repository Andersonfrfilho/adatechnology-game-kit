import type { Motion, World } from '@adatechnology/game-interactables'
import { createEffects, type Effects, type EffectsOptions } from './effects'
import { createCord, catenary } from '@adatechnology/game-shapes-three'
import { createMeshApi, type MeshApi, type MeshApiOptions } from './mesh'
import { createMirrors, type MirrorOptions, type Mirrors } from './mirrors'
import { applyPose, syncObject, type SyncOptions } from './pose'
import { createScreen, type Screen, type ScreenOptions } from './screen'
import { attachSway, swayMaterial, type SwayHandle, type SwayOptions } from './sway'
import type { CanvasFactory, Quality, ThreeLib, ThreeNS, Vec3 } from './types'

export interface ThreeAdapterOptions {
  /** Default for `createMeshApi` / `createScreen` / `createEffects`. */
  document?: CanvasFactory
  quality?: Quality
  materials?: MeshApiOptions['materials']
  /** `Reflector` and env map for `createMirrors`. */
  Reflector?: MirrorOptions['Reflector']
  envMap?: MirrorOptions['envMap']
}

/** The package functions with `THREE` and the common options already bound. */
export interface ThreeAdapter {
  THREE: ThreeLib
  createMeshApi(options?: MeshApiOptions): MeshApi
  applyPose<G extends ThreeNS.Object3D>(group: G, motion: Motion, t: number): G
  syncObject(world: World, objectId: string, parts: Record<string, ThreeNS.Object3D>, options?: SyncOptions): void
  swayMaterial(base: ThreeNS.Material, options?: SwayOptions): ReturnType<typeof swayMaterial>
  attachSway(mesh: ThreeNS.Mesh, options?: SwayOptions): SwayHandle
  createEffects(options: EffectsOptions): Effects
  /** @deprecated Pass `{ scene, camera, ... }`. */
  createEffects(scene: ThreeNS.Object3D, options?: Partial<EffectsOptions>): Effects
  createScreen(options?: Partial<ScreenOptions>): Screen
  createMirrors(options?: MirrorOptions): Mirrors
  createCord(points: readonly Vec3[], radius: number, material: ThreeNS.Material): ThreeNS.Mesh
  catenary: typeof catenary
}

/** Binds the host's `THREE` (and shared options) once, so the rest of the host code never passes it around. */
export function createThreeAdapter(THREE: ThreeLib, options: ThreeAdapterOptions = {}): ThreeAdapter {
  return {
    THREE,
    createMeshApi: (o = {}) => createMeshApi(THREE, { quality: options.quality, materials: options.materials, ...o }),
    applyPose: (group, motion, t) => applyPose(THREE, group, motion, t),
    syncObject: (world, objectId, parts, o) => syncObject(THREE, world, objectId, parts, o),
    swayMaterial: (base, o) => swayMaterial(THREE, base, o),
    attachSway: (mesh, o) => attachSway(THREE, mesh, o),
    createEffects: ((a: EffectsOptions | ThreeNS.Object3D, o: Partial<EffectsOptions> = {}) =>
      (a as ThreeNS.Object3D).isObject3D
        ? createEffects(THREE, a as ThreeNS.Object3D, { document: options.document, ...o })
        : createEffects(THREE, { document: options.document, ...(a as EffectsOptions) })) as ThreeAdapter['createEffects'],
    createScreen: (o = {}) => {
      const document = o.document ?? options.document
      if (!document) throw new Error('createScreen needs a document (option of createThreeAdapter or of the call)')
      return createScreen(THREE, { ...o, document })
    },
    createMirrors: (o = {}) => createMirrors(THREE, { Reflector: options.Reflector, envMap: options.envMap, ...o }),
    createCord: (points, radius, material) => createCord(THREE, points, radius, material),
    catenary,
  }
}
