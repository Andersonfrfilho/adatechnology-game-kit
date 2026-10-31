import type { Camera, Group, HemisphereLight, Object3D, Scene, WebGLRenderTarget } from 'three'

import type { ThreeLib } from '../three-lib'

export type LightKind = 'point' | 'spot'
export type LinearRgb = readonly [number, number, number]
export type FogState = 'none' | 'linear' | 'exp2'
export type ThreeForLights = Pick<
  ThreeLib,
  'Group' | 'PointLight' | 'SpotLight' | 'HemisphereLight' | 'Object3D' | 'Vector3' | 'Color' | 'LinearSRGBColorSpace'
>
/** What the budget reads of a renderer: a structural subset, so a fake works in Node. */
export type RendererState = {
  readonly toneMapping: number
  readonly outputColorSpace: string
  readonly shadowMap: { readonly type: number }
}

export interface LightBudgetOptions {
  /** Point lights created at boot. Default 16. */
  readonly point?: number
  /** Spot lights created at boot. Default 4. */
  readonly spot?: number
  /** How many of the point lights cast shadows (cube maps). Default 2. Fixed for the life of the budget. */
  readonly pointShadows?: number
  /** How many of the spot lights cast shadows. Default 0. */
  readonly spotShadows?: number
  /** Shadow map size of the shadow slots. Default 512. */
  readonly shadowMapSize?: number
  /** Bias, normal bias and camera near plane of the shadow slots. Defaults: three.js's (0, 0, 0.5). The house's room lights use -0.0012, 0.05 and 0.12. */
  readonly shadowSettings?: { readonly bias?: number; readonly normalBias?: number; readonly near?: number }
  /** Point slots only `urgent` requests may take while others are free. Default 2. */
  readonly urgentReserve?: number
  /** Milliseconds a light fades out when a source loses its slot, and fades in when it gets one. Default 120. */
  readonly fadeMs?: number
  /** A source keeps its slot until a challenger of the same priority is this much closer (0.15 = 15%). Default 0.15. */
  readonly hysteresis?: number
  /** HemisphereLights created at boot for adapters that flash the sky; leased with `leaseHemisphere`. Default 0. */
  readonly hemisphere?: number
}

/** A light that lives as long as the request: a blast, a rocket in flight, a muzzle flash, a flare in the hand. */
export interface LightRequest {
  readonly owner: string
  readonly kind?: LightKind
  /** Higher wins a slot; see LIGHT_PRIORITY. */
  readonly priority: number
  /** Hex (sRGB, like `new Color(hex)`) or linear RGB. */
  readonly color: number | LinearRgb
  readonly intensity: number
  readonly distance: number
  readonly decay?: number
  readonly position: readonly [number, number, number]
  /** Spot only. */
  readonly target?: readonly [number, number, number]
  readonly angle?: number
  readonly penumbra?: number
  /** Takes a slot at once: cuts the lowest victim instead of fading it, and may use the urgent reserve. */
  readonly urgent?: boolean
  /** Called once when a higher priority took the slot; the handle is dead from then on. */
  readonly onLost?: () => void
}

export type LightPatch = Partial<Pick<LightRequest, 'color' | 'intensity' | 'distance' | 'decay' | 'position' | 'target' | 'angle' | 'penumbra'>>

export interface LightHandle {
  /** Index of this light among the scene's point (or spot) lights in the shader; stable while the handle lives. */
  readonly slot: number
  readonly kind: LightKind
  readonly alive: boolean
  update(patch: LightPatch): void
  /** Gives the slot back; with fadeMs the light fades first. Idempotent. */
  release(options?: { readonly fadeMs?: number }): void
}

/** A light that exists in the world for a long time and competes for a slot every frame: a lamp, a street light, a headlight. */
export interface LightSource extends Omit<LightRequest, 'urgent' | 'onLost'> {
  /** Wants a shadow slot; a shadow source competes for shadow slots only. */
  readonly shadow?: boolean
  /**
   * The object the light sits on. Its world position (and, for a spot, its world -z as the direction when `target` is absent) is read
   * once per `present`; `position` is then an offset in its local space. A source whose `follow` left the scene counts as off.
   */
  readonly follow?: Object3D
}

export interface SourceHandle {
  /** Slot now, or -1 while it has none (its light is not drawn). */
  readonly slot: number
  update(patch: Partial<LightSource>): void
  remove(): void
}

/** Slots a client keeps for itself for good: the room lights of a house (their masks are indexed by slot). */
export interface LightLease {
  readonly handles: readonly LightHandle[]
  /** Redraws the shadow map of one leased slot (`handles[index]`), or of all of them, on the next render: the walls it shades changed. */
  invalidateShadow(index?: number): void
  release(): void
}

export interface SealOptions {
  /** Fog states the game will switch between at run time. Default: only the state at seal time. */
  readonly fogStates?: readonly FogState[]
  /** Cameras whose `far` must stay under the neutral fog's near (read at every `check`). */
  readonly cameras?: readonly Camera[]
  /** Where the game really draws; its colour space is part of the sealed state. */
  readonly target?: WebGLRenderTarget | null
}

export interface LightCheck {
  readonly ok: boolean
  readonly expected: string
  readonly actual: string
  /** Paths of PointLight/SpotLight found outside the budget's group. */
  readonly strays: readonly string[]
}

export interface LightBudgetStats {
  readonly lit: number
  readonly free: number
  readonly leased: number
  readonly sources: number
  readonly sourcesWithoutSlot: number
  readonly preempted: number
  readonly refused: number
}

export interface LightBudget {
  /** The group holding every light; first child of the scene. Never hidden, never removed while the budget lives. */
  readonly group: Group
  readonly sizes: { readonly point: number; readonly spot: number; readonly pointShadows: number; readonly spotShadows: number }
  acquire(request: LightRequest): LightHandle | null
  addSource(source: LightSource): SourceHandle
  /** Takes `point` slots (of which `shadows` shadow slots) for good. null when not enough unleased slots remain. */
  lease(options: { readonly owner: string; readonly point: number; readonly shadows?: number }): LightLease | null
  /** Takes one of the boot HemisphereLights for good. null when none is left. Its intensity starts at 0. */
  leaseHemisphere(owner: string): HemisphereLight | null
  /** Once per frame, with the camera (or the player) as focus. `dtSeconds` is real time: fades do not stop in pause. */
  present(focus: readonly [number, number, number], dtSeconds: number): void
  /** After this, any change in the program-key state of the scene is a bug and `check()` reports it. */
  seal(renderer: RendererState, scene: Scene, options?: SealOptions): void
  check(renderer: RendererState, scene: Scene): LightCheck
  stats(): LightBudgetStats
  dispose(): void
}

export const LIGHT_PRIORITY = {
  blast: 900,
  rocket: 800,
  muzzle: 750,
  fire: 600,
  flare: 500,
  headlight: 400,
  weaponLight: 400,
  lamp: 200,
  street: 150,
} as const
