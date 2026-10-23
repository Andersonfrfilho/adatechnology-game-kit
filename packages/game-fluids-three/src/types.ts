import type * as THREE_NS from 'three'
import type { FluidWorld, Vec3 } from '@adatechnology/game-fluids'

/** The only three.js members the renderer needs at runtime. Pass your own `THREE` instance (the whole namespace works). */
export type ThreeLib = Pick<
  typeof THREE_NS,
  | 'BufferAttribute'
  | 'BufferGeometry'
  | 'Color'
  | 'DoubleSide'
  | 'DynamicDrawUsage'
  | 'Group'
  | 'InstancedMesh'
  | 'Matrix4'
  | 'Mesh'
  | 'MeshStandardMaterial'
  | 'Points'
  | 'ShaderMaterial'
  | 'SphereGeometry'
  | 'Vector3'
>

/** Detail level. It sets the budgets (stains, streams, particles) and the mesh resolution. */
export type FluidQuality = 'low' | 'medium' | 'high'

export interface FluidRendererOptions {
  /** Where the effects live (stains, streams, particles are added under one group). */
  scene: THREE_NS.Object3D
  /** The simulation to draw. The renderer only reads its state and listens to `splash` events: it never changes the world. */
  fluids: FluidWorld
  /** Default `medium`. */
  quality?: FluidQuality
  /** Environment map the wet surfaces and liquids reflect. When omitted they use `scene.environment` if the host set one. */
  envMap?: THREE_NS.Texture | null
  /** Pixel scale of the round point sprites (about half the canvas height in pixels). Default 600. */
  pointScale?: number
}

export interface BindOptions {
  /**
   * Offset, in the bound object's space, of the container's inner bottom centre (the origin of the shape given to `addContainer`).
   * The world transform you give `fluids.setTransform` must be that point's world position and the object's rotation. Default `[0, 0, 0]`.
   */
  innerOffset?: Vec3
}

/** Counts of what is alive right now, plus the budgets of the chosen quality. */
export interface FluidRendererStats {
  quality: FluidQuality
  /** Bound containers with a visible liquid volume. */
  containers: number
  /** Streams drawn, including the ones that are breaking into drops after the world ended them. */
  streams: number
  /** Stain meshes in use (a stain uses an outer film and an inner glossy wet fan). */
  stains: number
  /** Droplet and steam particles alive. */
  particles: number
  /** Triangles currently drawn by the fluids. */
  triangles: number
  budget: { stains: number; streams: number; particles: number }
}

export interface FluidRenderer {
  /** Draw the liquid of a world container inside `object` (a volume clipped by the liquid surface, plus steam). */
  bindContainer(containerId: string, object: THREE_NS.Object3D, options?: BindOptions): void
  unbindContainer(containerId: string): void
  /** Advance the visuals (call it after `fluids.update(dt)`). */
  update(dt: number): void
  /** Remove every stain, stream and particle (the bindings stay). */
  clear(): void
  /** Remove everything from the scene and release geometries and materials. */
  dispose(): void
  stats(): FluidRendererStats
}
