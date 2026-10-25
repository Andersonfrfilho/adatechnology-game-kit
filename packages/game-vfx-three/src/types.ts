import type * as THREE_NS from 'three'
import type { EffectSink, WarmUpProbes } from '@adatechnology/game-contracts'
import type { ScreenState, VfxOptions, VfxProfileName, VfxWorld } from '@adatechnology/game-vfx'

/** The only three.js members the renderer needs at runtime. Pass your own `THREE` instance (the whole namespace works). */
export type ThreeLib = Pick<
  typeof THREE_NS,
  | 'AdditiveBlending'
  | 'BufferAttribute'
  | 'BufferGeometry'
  | 'BoxGeometry'
  | 'CanvasTexture'
  | 'CircleGeometry'
  | 'Color'
  | 'ConeGeometry'
  | 'DodecahedronGeometry'
  | 'DynamicDrawUsage'
  | 'Euler'
  | 'Float32BufferAttribute'
  | 'Group'
  | 'IcosahedronGeometry'
  | 'InstancedBufferAttribute'
  | 'InstancedBufferGeometry'
  | 'InstancedMesh'
  | 'LineBasicMaterial'
  | 'LineSegments'
  | 'LinearSRGBColorSpace'
  | 'Matrix4'
  | 'Mesh'
  | 'MeshBasicMaterial'
  | 'MeshStandardMaterial'
  | 'NormalBlending'
  | 'PlaneGeometry'
  | 'Points'
  | 'PointLight'
  | 'Quaternion'
  | 'RepeatWrapping'
  | 'RingGeometry'
  | 'SRGBColorSpace'
  | 'DoubleSide'
  | 'ShaderMaterial'
  | 'SphereGeometry'
  | 'Vector3'
>

/** A canvas the marks draw their textures on. A browser has one; a test supplies a fake. */
export interface CanvasLike {
  width: number
  height: number
  getContext(kind: '2d'): CanvasContextLike | null
}

/** The drawing calls the scorch and dirt textures use. */
export interface CanvasContextLike {
  fillStyle: unknown
  strokeStyle: unknown
  lineWidth: number
  globalAlpha: number
  clearRect(x: number, y: number, w: number, h: number): void
  fillRect(x: number, y: number, w: number, h: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
  arc(x: number, y: number, radius: number, start: number, end: number): void
  fill(): void
  strokeRect(x: number, y: number, w: number, h: number): void
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): { addColorStop(offset: number, color: string): void }
}

export interface VfxRendererOptions {
  /** Where the effects live: everything is added under one group. */
  scene: THREE_NS.Object3D
  camera: THREE_NS.Camera
  /** A shared world (the test room lends one to every renderer) or the options of the world to create. */
  vfx?: VfxWorld | VfxOptions
  /** Pool sizes when the world is created here (`vfx` given as options without a profile). Default `medium`. */
  quality?: VfxProfileName
  /** Where the screen flash goes (the room's container). Without it nothing is drawn on the screen. */
  overlay?: HTMLElement
  /** Skips the flash and the camera shake. Default: what the browser says (`prefers-reduced-motion`). */
  reducedMotion?: boolean
  /** Canvas factory for the textures of the marks. Default `document.createElement('canvas')`. */
  createCanvas?: () => CanvasLike
  /** Direction towards the light the puffs are shaded with. Default the Lab's moon. */
  lightDirection?: readonly [number, number, number]
  /** Pixels of point size per metre at a distance of one metre for the sprite kinds; roughly `viewportHeight / (2 * tan(fov / 2))`. Default 700. */
  pointScale?: number
  /** Multiplies the blast and fire lights. Default `Math.PI`: three.js r155+ lights are physical, the Lab's were not (r128). */
  lightScale?: number
}

/** The world's counters flattened (`lastBlast` becomes `last_puffs`, `last_sparks`, `last_chunks`, `last_lights`), plus `drawCalls`. */
export type VfxRendererStats = Readonly<Record<string, number>>

export interface VfxRenderer extends EffectSink {
  readonly world: VfxWorld
  /** Steps the world, then redraws everything from it. Call once per frame (a shared world is stepped here, nowhere else). */
  update(dt: number): void
  /** Meshes that use the materials of the solid particles, to render once so that the first effect does not build their shader programs in the middle of a frame. */
  warmUpProbes(): WarmUpProbes
  /** Shakes the camera for the render that follows (the Lab's L1092) and answers the function that puts it back. */
  applyCamera(): () => void
  stats(): VfxRendererStats
  /** The screen state the overlay draws (shake, flash...). */
  screen(): Readonly<ScreenState>
  dispose(): void
}
