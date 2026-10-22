import type * as ThreeNamespace from 'three'
import type { CameraLocale } from './locale'

/** The only three.js members the rig needs at runtime. Pass your own `THREE` instance. */
export type ThreeLib = Pick<typeof ThreeNamespace, 'Vector3' | 'Quaternion'>

/** Anything that behaves like a `THREE.Camera` for the rig. */
export type CameraLike = Pick<ThreeNamespace.Camera, 'position' | 'quaternion' | 'lookAt' | 'updateMatrixWorld'>

/** The weapon/hand group glued to the camera in first person (barrel along local +z). */
export type ViewmodelTarget = Pick<ThreeNamespace.Object3D, 'position' | 'quaternion'>

export type CameraMode = 'shoulder' | 'third' | 'first'

export interface ShoulderConfig {
  /** Distance behind the target. */
  distance: number
  /** Distance while aiming. */
  aimDistance: number
  /** Lateral offset (sign is flipped by `flipSide`). */
  side: number
  height: number
  crouchHeight: number
}

export interface ThirdConfig {
  distance: number
  aimDistance: number
  height: number
  crouchHeight: number
}

export interface FirstConfig {
  /** Eye height. */
  eyes: number
  /** Eye height while crouching. */
  crouchEyes: number
  /** How far in front of the target the eye sits. */
  forward: number
}

export interface ViewmodelConfig {
  x: number
  y: number
  z: number
  /** Extra yaw (radians) applied to the weapon group. */
  twist: number
}

export interface CameraConfig {
  modes: CameraMode[]
  /** Display names per mode; defaults come from the locale table. */
  labels: Record<CameraMode, string>
  shoulder: ShoulderConfig
  third: ThirdConfig
  first: FirstConfig
  viewmodel: ViewmodelConfig
  /** Kept for compatibility; not read by the rig. */
  smoothing: number
  /** Gap kept between the camera and a wall. */
  wallClearance: number
  /** Closest the camera may be pulled to the target. */
  minDistance: number
  /** localStorage key where the mode is persisted (`null` = do not persist). */
  storageKey: string | null
  locale: CameraLocale | (string & {})
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : Partial<T[K]>) : T[K] }

/** Options accepted by `create`: every field is optional, nested objects are shallow-merged. */
export type CameraOptions = DeepPartial<CameraConfig>

/** What the game tells the rig every frame. Yaw 0 looks toward -z; positive pitch looks down. */
export interface CameraTarget {
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  aiming?: boolean
  crouching?: boolean
}

/** Returns the distance to the first obstacle along the ray, or `null` when the way is clear. */
export type CollideFn = (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number) => number | null
/** Returns the maximum camera height at (x, z), or `Infinity`. */
export type CeilingFn = (x: number, z: number, y: number) => number

export interface CameraRig {
  /** Current mode (read-only). */
  readonly mode: CameraMode
  /** Current shoulder side: 1 or -1 (read-only). */
  readonly side: number
  /** The merged configuration. */
  config: CameraConfig
  setMode(mode: CameraMode): void
  /** Advances to the next mode in `config.modes`. */
  cycle(): void
  /** Swaps the shoulder side. */
  flipSide(): void
  /** Subscribes to mode changes. */
  onChange(listener: (mode: CameraMode) => void): void
  isFirstPerson(): boolean
  /** Places the camera for this frame. */
  update(camera: CameraLike, target: CameraTarget, dt: number, collide?: CollideFn | null, ceiling?: CeilingFn | null): void
  /** Glues the weapon group to the camera (use in first person). */
  viewmodel(group: ViewmodelTarget, camera: CameraLike): void
  /** Builds a ready-made `<select>` for a menu. */
  selector(parent: HTMLElement, label?: string): HTMLLabelElement
}
