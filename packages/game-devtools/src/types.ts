import type * as ThreeNamespace from 'three'
import type { DevtoolsLocale, DevtoolsStrings } from './locale'

/** The only three.js member the devtools need at runtime. Pass your own `THREE` instance. */
export type ThreeLib = Pick<typeof ThreeNamespace, 'Vector3'>

/** A camera that can project world points to the screen. */
export type ProjectionCamera = ThreeNamespace.Camera

/** Where the player is. Yaw 0 looks toward -z (north); positive pitch looks down. */
export interface PlayerPosition {
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
}

/** `[team id, team label]` pairs shown in the mark form. */
export type Team = [id: string, label: string]

export interface Bounds {
  x: [number, number]
  y: [number, number]
  z: [number, number]
}

export interface DevtoolsOptions {
  /** localStorage key where marks are kept when there is no server database. */
  marksStorageKey?: string
  /** Database collection used when a `window.claude` database is available. */
  collection?: string
  /** File name of the downloaded marks file (default comes from the locale). */
  fileName?: string
  /** Teams offered in the mark form (default: one team `general`). */
  teams?: Team[]
  /** Name of the area at world (x, z). */
  area?: (x: number, z: number) => string
  /** Time-of-day text shown in the HUD and stored in marks. */
  time?: () => string
  /** Short message to the player: `notify(text, seconds)`. */
  notify?: (text: string, seconds?: number) => void
  /** `pause(true)` when a panel opens, `pause(false)` when it closes. */
  pause?: (paused: boolean) => void
  /** Current player position. */
  position?: () => PlayerPosition
  /** Free-fly limits. */
  bounds?: Bounds
  /** Initial free-fly speed (m/s). */
  speed?: number
  /** Pool size of the entity labels. */
  labelsMax?: number
  /** Kept for compatibility; not read by the devtools. */
  labelsDistance?: number
  locale?: DevtoolsLocale | (string & {})
  /** Overrides for individual user-facing strings. */
  strings?: Partial<DevtoolsStrings>
}

/** Snapshot of "here": position, area, heading, time. */
export interface HereInfo {
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  area: string
  /** Compass heading, e.g. `NE`. */
  heading: string
  /** Heading in degrees, 0..359. */
  degrees: number
  /** Look angle in degrees (positive = up). */
  look: number
  time: string
  flying: boolean
}

/** A saved note. */
export interface Mark extends HereInfo {
  id: string
  team: string
  text: string
  /** Epoch milliseconds. */
  at: number
  /** User id when saved on a server. */
  by?: string
}

export interface FlyKeys {
  /** -1..1 */
  forward: number
  /** -1..1 */
  strafe: number
  /** -1..1 */
  up: number
  /** 4x speed when truthy. */
  fast?: boolean | number
}

export interface EntityLabel {
  x: number
  y: number
  z: number
  text: string
  /** CSS colour, default `#9fd0ff`. */
  color?: string
}

/** `[group name, [[place name, go()]]]` */
export type PlaceGroup = [name: string, places: Array<[name: string, go: () => void]>]

export interface Scenario {
  id: string
  [extra: string]: unknown
}
/** Result of a scenario check: criterion -> verdict. */
export type ScenarioResult = Record<string, { ok: boolean; note?: string }>

export interface Devtools {
  /** Whether free-fly is on. Set it from your own key handler. */
  flying: boolean
  x: number
  y: number
  z: number
  /** Free-fly speed (m/s); the mouse wheel changes it while flying. */
  speed: number
  /** Whether the position HUD is visible. */
  hud: boolean
  /** Which panel is open (`null` when none). */
  openPanel: 'form' | 'list' | null
  /** Whether entity labels are shown. */
  showLabels: boolean
  /** Server database handle when `window.claude` offers one. */
  db: any
  marks: Mark[]
  scenarioList: Scenario[]
  activeScenario: Scenario | null
  /** Set by the game: teleport to a mark. */
  goTo: ((x: number, y: number, z: number, yaw: number, pitch: number) => void) | null
  /** Set by the game: extra text appended to the HUD line. */
  extras: () => string

  /** Compass heading and degrees for a yaw. */
  compass(yaw: number): [heading: string, degrees: number]
  here(): HereInfo
  /** One-line text for a mark. */
  line(mark: Pick<Mark, 'team' | 'area' | 'x' | 'y' | 'z' | 'heading' | 'degrees' | 'time'> & { text?: string }): string
  /** Moves the free-fly position for this frame. */
  fly(dt: number, yaw: number, pitch: number, keys: FlyKeys): void
  /** Places the camera at the free-fly position. */
  flyCamera(camera: ProjectionCamera, yaw: number, pitch: number): void

  /** Registers an on/off switch in the panel; `set` returns true to close the panel. */
  toggle(id: string, label: string, get: () => boolean, set: (on: boolean) => boolean | void): Devtools
  /** Registers a button; `fn` returns true to keep the panel open. */
  action(id: string, label: string | (() => string), fn: () => boolean | void): Devtools
  /** Registers time-of-day buttons: `[[label, value]]`. */
  timesOfDay(list: Array<[string, unknown]>, set: (value: unknown) => void): Devtools
  /** Registers test places. */
  places(fn: () => PlaceGroup[]): Devtools
  /** Registers the entity label source. */
  labelsFor(fn: (camera: ProjectionCamera) => EntityLabel[]): Devtools
  /** Registers scenarios with an `apply` and an automatic `check`. */
  scenarios<S extends Scenario>(list: S[], apply: (scenario: S) => void, check: (scenario: S) => ScenarioResult): Devtools
  /** Applies a scenario; false if the id is unknown. */
  scenario(id: string): boolean
  /** Checks a scenario (or the active one). */
  check(id?: string): ScenarioResult

  open(which: 'form' | 'list'): void
  close(): void
  /** Re-renders the list panel. */
  render(): void
  /** Call every frame. */
  update(dt: number, camera: ProjectionCamera, visible?: boolean): void
  /** Exposes `window.__scenario`, `__scenarioCheck`, `__scenarioList`, `__devtools` for automated browser tests. */
  expose(): void
  /** Removes the DOM, styles and listeners. */
  dispose(): void
}
