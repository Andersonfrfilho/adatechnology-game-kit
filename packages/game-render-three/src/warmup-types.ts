import type { Camera, Material, Object3D, Scene, Texture, WebGLRenderTarget } from 'three'

import type { FogState, LightBudget } from './lights/types'
import type { RendererState } from './lights/types'
import type { MaterialAnchors } from './pools/anchors'
import type { PropertiesReader } from './program-key'

/** What `warmUpProbes()` of the adapters already returns: a group to draw once. */
export interface WarmupProbe {
  readonly id: string
  /**
   * The group to draw once. `materials` are handed to the warmup's anchor set and are **never** disposed (their programs stay linked);
   * `dispose` frees only what is not a material (geometries of the probe meshes, the group).
   */
  build(): { readonly group: Object3D; readonly materials: readonly Material[]; dispose(): void }
}

/** An effect played once at load so its programs are linked and its buffers and textures reach the GPU before play. */
export interface EffectWarmup {
  readonly id: string
  /** Starts the effect where the camera sees it. */
  play(): void
  /** Advances it; the warmup renders after each step. */
  step(dtSeconds: number): void
  /** Stops and clears everything it left (world, log, sound), keeping the pools filled. */
  stop(): void
  /** Frames to render. Default 3. */
  readonly frames?: number
}

export interface WarmupOptions {
  readonly lights?: LightBudget
  /** Fog states to warm; passed on to `lights.seal`. Default: the state of the scene. */
  readonly fogStates?: readonly FogState[]
  /** Where the game really draws: the program key carries the target's colour space and tone mapping. Default null (the canvas). */
  readonly target?: WebGLRenderTarget | null
}

export interface WarmupReport {
  readonly programs: number
  readonly geometries: number
  readonly textures: number
  readonly milliseconds: number
  readonly lightSignature: string
  /** `MAX_FRAGMENT_UNIFORM_VECTORS` of this GPU. */
  readonly uniformVectors: number
  /** Anchors kept alive (one material per program family). */
  readonly anchors: number
}

export type WarmupContext = {
  getParameter(parameter: number): unknown
  readonly MAX_FRAGMENT_UNIFORM_VECTORS: number
  linkProgram(program: WebGLProgram): void
}

/** What the warmup needs of a WebGLRenderer: structural, so a counting fake works in Node. */
export type WarmupRenderer = RendererState &
  PropertiesReader & {
    compile(scene: Object3D, camera: Camera): unknown
    render(scene: Object3D, camera: Camera): void
    setRenderTarget(target: WebGLRenderTarget | null): void
    initTexture(texture: Texture): void
    getContext(): WarmupContext
    readonly info: { readonly programs?: ReadonlyArray<object> | null; readonly memory: { readonly geometries: number; readonly textures: number } }
  }

export interface ProgramWarmup {
  register(probe: WarmupProbe): () => void
  registerEffect(effect: EffectWarmup): () => void
  registerTexture(texture: Texture): () => void
  /** Seals the budget and the scene state, then warms. */
  warmUp(renderer: WarmupRenderer, scene: Scene, camera: Camera, options?: WarmupOptions): WarmupReport
  /** Calls to `gl.linkProgram` since warmUp: should stay 0. Counts the calls, not `info.programs.length`, which can hide a release and relink. */
  linkedSince(renderer: WarmupRenderer): number
  /** The anchor set: materials that are never disposed while the warmup lives. Pools and probes hand theirs here. */
  readonly anchors: MaterialAnchors
}
