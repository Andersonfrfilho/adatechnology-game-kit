import type * as ThreeNamespace from 'three'
import type { CameraLocale } from './locale'

/** The only three.js members the rig needs at runtime. Pass your own `THREE` instance. */
export type ThreeLib = Pick<typeof ThreeNamespace, 'Vector3' | 'Quaternion'>

/** Anything that behaves like a `THREE.Camera` for the rig. */
export type CameraLike = Pick<ThreeNamespace.Camera, 'position' | 'quaternion' | 'lookAt' | 'updateMatrixWorld'> & {
  /** Vertical field of view in degrees (a `PerspectiveCamera` has it): the rig drives it when the target gives a `zoom`. */
  fov?: number
  /** Called after the rig changes `fov`. */
  updateProjectionMatrix?: () => void
}

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

export interface AimConfig {
  /** Vertical field of view in degrees at zoom 1. */
  fov: number
  /** The field of view is `fov / zoom`. */
  fovPower: number
  /** The look is slowed by `1 / zoom ** zoomPower` while aiming. */
  zoomPower: number
  /** Radians of look per pixel of mouse. */
  sensitivity: number
  /** The field of view is only moved when it is farther than this (degrees) from the wanted one. */
  fovTolerance: number
}

export interface DeathOrbitConfig {
  /** Distance from the body. */
  radius: number
  /** Height of the camera. */
  height: number
  /** Radians per second of `deathT` (the angle is `deathT * speed`). */
  speed: number
  /** Height the camera looks at on the body. */
  lookHeight: number
}

export interface LookConfig {
  pitchMin: number
  pitchMax: number
}

export interface ShakeConfig {
  /** The fever sways the look: `yaw += sin(time * yawSpeed) * yaw`, `pitch += cos(time * pitchSpeed) * pitch`. */
  fever: { yawSpeed: number; yaw: number; pitchSpeed: number; pitch: number }
  /** Panic jitters the yaw by `(random() - 0.5) * amplitude` each frame. */
  panic: { amplitude: number }
}

export interface CameraConfig {
  modes: CameraMode[]
  /** Display names per mode; defaults come from the locale table. */
  labels: Record<CameraMode, string>
  shoulder: ShoulderConfig
  third: ThirdConfig
  first: FirstConfig
  viewmodel: ViewmodelConfig
  /**
   * Rate (per second) at which the boom length, the shoulder side, the height and the field of view ease towards what the target asks for:
   * a share `1 - exp(-smoothing * dt)` of the gap is closed each frame (the field of view closes `min(1, smoothing * dt)`). `0` is instant,
   * as before the rig read it. Default 12.
   */
  smoothing: number
  /** Aiming: the field of view without zoom, and how a weapon's zoom shortens it and slows the look. */
  aim: AimConfig
  /** How quickly the camera comes back out after a wall has pushed it in (per second; the push itself is instant). */
  wallRecovery: number
  /** The camera that circles a dead target. */
  deathOrbit: DeathOrbitConfig
  /** The look: limits of the pitch. */
  look: LookConfig
  /** The look shake of fever and panic. */
  shake: ShakeConfig
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
  /** The zoom of the weapon in hand. With it the rig eases the camera's field of view to `aim.fov / zoom` while `aiming` and back to `aim.fov` otherwise. */
  zoom?: number
  /** False once the target is dead: the camera circles the body (see `deathOrbit`). Default true. */
  alive?: boolean
  /** Seconds since the death, for the orbit. */
  deathT?: number
}

/** What the player did with the mouse and what shakes the look this frame (see `CameraRig.look`). */
export interface LookInput {
  /** Pixels of mouse to the right and down. */
  dx: number
  dy: number
  /** The weapon's zoom and whether the sights were up when the frame began (the one before this frame's own input). */
  zoom?: number
  aiming?: boolean
  /** Seconds on the host's clock, for the fever's sway. */
  time?: number
  /** The target is feverish / panicking: the host's rules decide when. */
  fever?: boolean
  panic?: boolean
  /** The host's random numbers in [0, 1); without it the panic does not jitter (the rig never calls `Math.random`). */
  random?: () => number
}

/** The look of the player, turned by `CameraRig.look`. */
export interface LookState {
  yaw: number
  pitch: number
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
  /** Radians of look per pixel of mouse at this zoom (`aim.sensitivity`, divided by `zoom ** aim.zoomPower` while aiming). */
  lookSensitivity(zoom?: number, aiming?: boolean): number
  /** The yaw and pitch the fever and the panic add this frame. */
  lookShake(input: Pick<LookInput, 'time' | 'fever' | 'panic' | 'random'>): { yaw: number; pitch: number }
  /** Turns a look by the mouse and the shake of this frame, and keeps the pitch inside `look.pitchMin..pitchMax`. */
  look(state: LookState, input: LookInput): LookState
  /** Places the camera for this frame. */
  update(camera: CameraLike, target: CameraTarget, dt: number, collide?: CollideFn | null, ceiling?: CeilingFn | null): void
  /** Glues the weapon group to the camera (use in first person). */
  viewmodel(group: ViewmodelTarget, camera: CameraLike): void
  /** Builds a ready-made `<select>` for a menu. */
  selector(parent: HTMLElement, label?: string): HTMLLabelElement
}
