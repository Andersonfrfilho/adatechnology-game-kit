import type * as THREE_NS from 'three'
import type { VfxWorld } from '@adatechnology/game-vfx'
import type { ThreeLib as VfxThreeLib } from '@adatechnology/game-vfx-three'
import type { FluidWorld, Vec3 } from '@adatechnology/game-fluids'

/** The only three.js members the renderer needs at runtime. Pass your own `THREE` instance (the whole namespace works). */
export type ThreeLib = VfxThreeLib &
  Pick<
    typeof THREE_NS,
    | 'BufferAttribute'
    | 'PerspectiveCamera'
    | 'BufferGeometry'
    | 'Color'
    | 'DataTexture'
    | 'DoubleSide'
    | 'DynamicDrawUsage'
    | 'Group'
    | 'LinearFilter'
    | 'InstancedMesh'
    | 'Matrix4'
    | 'Mesh'
    | 'MeshStandardMaterial'
    | 'Points'
    | 'RGBAFormat'
    | 'ShaderMaterial'
    | 'SphereGeometry'
    | 'Vector2'
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
  /** Pixel scale of the round point sprites (about half the canvas height in pixels). Default 600. Only read when `vfx` is not given. */
  pointScale?: number
  /**
   * The effects world that holds the droplets and steam (a host lends one to every renderer and steps it once per frame). Without it the renderer
   * makes its own world and its own three layer and steps them in `update`.
   */
  vfx?: VfxWorld
  /** Camera of the own effects world (distance LOD); only read when `vfx` is not given. Default a camera at the origin. */
  camera?: THREE_NS.Camera
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
