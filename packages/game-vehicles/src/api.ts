/**
 * Public types of `@adatechnology/game-vehicles`.
 * three.js objects are typed `any` on purpose: the host passes its own `THREE` namespace at runtime, so the package does not bind to one version.
 */
import type { LocaleStrings, PartialLocaleStrings, Translate } from './locale'

/** A three.js `Vector3`, `Object3D`, `Mesh`, ... of the host's `THREE`. */
export type ThreeObject = any
/** A three.js `Vector3` of the host's `THREE`. */
export type ThreeVector = any

export type BuildState = 'intact' | 'damaged' | 'modified'

/** Index of a damage band: 0 intact, 1 scratched, 2 dented, 3 destroyed, 4 torn off. */
export type BandIndex = 0 | 1 | 2 | 3 | 4

export type BandId = 'intact' | 'scratched' | 'dented' | 'destroyed' | 'torn_off'

export interface Band {
  id: BandId
  /** Display name (from the locale). */
  name: string
  /** Lowest health that still belongs to the band. */
  min: number
  /** Health a button/scenario uses to put a zone in this band. */
  health: number
  /** CSS colour used by the UI widgets. */
  color: string
}

/** Where a vehicle is built: the context returned by {@link VehicleKit.build}. */
export interface VehicleContext {
  /** Add this to the scene. */
  root: ThreeObject
  /** The vehicle itself (a child of `root`); zones, parts and meshes live here. */
  vehicle: ThreeObject
  key: string
  state: BuildState
  spec: VehicleSpec
  meta: VehicleMeta
  zones: DamageZone[]
  zoneState: ZoneState
  /** Deterministic random generator seeded from the vehicle key and state. */
  rand: () => number
  parts: VehiclePart[]
  log: unknown[]
  zoneErrors?: string[]
  [key: string]: any
}

export interface VehicleMeta {
  kind?: 'car' | 'bike' | 'truck' | 'bus' | 'tank' | 'boat' | 'plane' | 'heli' | string
  /** x of the front / rear of the bounding body (+x is forward). */
  front?: number
  rear?: number
  length?: number
  width?: number
  /** Ground clearance and height of the body above it. */
  clearance?: number
  bodyHeight?: number
  belt?: number
  top?: number
  /** Optional text for the body zone label; `bodyKind: 'box'` makes the single body zone a box. */
  bodyLabel?: string
  bodyKind?: 'box' | 'body'
  exhaust?: ThreeVector | false
  exhaustDir?: ThreeVector
  /** Replaces the default armour (state `modified`). */
  armor?: (c: VehicleContext, kit: VehicleKit) => void
  [key: string]: any
}

export interface VehicleSpec {
  /** Unique id of the vehicle. */
  key: string
  /** Seeds the random streams (look and damage) instead of `key`. Lets a vehicle be renamed without changing how it looks. */
  seedKey?: string
  /** Display name. */
  name?: string
  /** Fleet group (see `configure({ groups })`). */
  group?: string
  /** Fuel id (a key of `configure({ fuels })`) or `'electric'` / `'none'`. */
  fuel?: string
  build?: BuildFunction
  [key: string]: any
}

/** Builds the geometry of a vehicle into the context. */
export type BuildFunction = (c: VehicleContext, kit: VehicleKit) => void

export interface VehiclePart {
  kind: string
  label: string
  key?: string
  pos: ThreeVector
  [key: string]: any
}

/** A part label: a plain string, or a locale key (`parts.<key>`) with an optional text override. */
export type PartLabel = string | { key: string; label?: string }

/** A damage zone of a built vehicle. */
export interface DamageZone {
  id: string
  /** Display name. */
  name: string
  /** Relative weight in the overall health. */
  weight: number
  /** Health (0..100) when the zone is untouched. */
  health: number
  band: number
  internal?: boolean
  owned?: boolean
  tags: string[]
  /** `[xMin, xMax, zMin, zMax]` rectangle on the top-down damage map. */
  map: [number, number, number, number]
  box: ThreeObject
  /** Overrides the id used to seed the random damage (keeps the output of an earlier pack identical). */
  seedId?: string
  [key: string]: any
}

/** Health per zone id (0..100) and scenario flags. */
export interface ZoneState {
  health: Record<string, number>
  flags: Record<string, boolean>
}

export interface ScenarioResult {
  health: Record<string, number>
  flags: Record<string, boolean>
  scenario: string
}

/** The object a scenario's `zone` / `init` callbacks receive. */
export interface ScenarioContext {
  c: VehicleContext
  meta: VehicleMeta
  front: number
  rear: number
  length: number
  width: number
  clearance: number
  top: number
  /** Deterministic random in [0, 1). */
  rand: () => number
  /** Stores the health (0..100, rounded) of a zone. */
  set(zone: DamageZone, health: number): void
  flags: Record<string, boolean>
  health: Record<string, number>
  /** Body types that count as bodywork (`panel`, `door`, `roof`, `lid`, `hood`, `bumper`). */
  bodyTypes: Record<string, number>
  clamp(v: number, lo: number, hi: number): number
  /** Centre of the zone being visited. */
  center: ThreeVector | null
  /** True when the zone being visited is a windshield. */
  isWindshield: boolean
  /** Scratch space: `init` can store values here for `zone` to read. */
  [key: string]: any
}

export interface ScenarioDefinition {
  id: string
  /** Seeds the random stream of the scenario instead of `id`. Lets a scenario be renamed without changing its result. */
  seedId?: string
  /** Display name. */
  name: string
  init?(x: ScenarioContext): void
  zone(zone: DamageZone, x: ScenarioContext): void
}

/** Visual effect of a scenario flag (`flipped`, `burnt`, `abandoned` or a plugin's own). */
export interface FlagEffect {
  /** Lower runs first (default 50). */
  order?: number
  /** Run the settle step after applying (default true). */
  settle?: boolean
  apply(c: VehicleContext, flags: Record<string, boolean>, kit: VehicleKit): void
}

export interface FluidDefinition {
  fresh?: string
  dry?: string
  /** Seconds until dry. */
  dryTime?: number
  roughFresh?: number
  roughDry?: number
  metalFresh?: number
  metalDry?: number
  /** Wipers and rain remove it while fresh. */
  wipeable?: boolean
  /** Fully custom fluid: return `true` to remove it. */
  update?(c: VehicleContext, fluid: any, dt: number, index: number): boolean | void
  [key: string]: any
}

export interface ZoneEffect {
  [key: string]: any
}

export interface BandOverride {
  name?: string
  color?: string
  min?: number
  health?: number
}

/** Text overrides. Anything left out comes from the locale. */
export interface KitTexts {
  /** Placeholder for the party that caused a damage (`{who}` in zone texts). */
  who?: string
  /** Text when a zone has no visible effect. */
  noEffect?: string
  plate?: string
  /** Overrides of the `ui.*` locale strings. */
  ui?: Record<string, string>
}

/** Everything a content pack can set; also accepted by `createVehicleKit`. */
export interface KitConfiguration {
  bands?: BandOverride[]
  zoneEffects?: Record<string, ZoneEffect | ((z: DamageZone, health: number) => unknown)>
  partEffects?: Record<string, string>
  scenarios?: ScenarioDefinition[]
  flagEffects?: Record<string, FlagEffect>
  fluids?: Record<string, FluidDefinition>
  /** Fuel id to its definition (flammability, colour, label, ...). */
  fuels?: Record<string, any>
  groups?: string[]
  waterGroups?: Record<string, any>
  palette?: { rust?: string | number }
  plate?: string
  texts?: KitTexts
  /** Fluid type of the stain an impact leaves (null: none). */
  impactStain?: string | null
  defaultSplat?: string
  defaultGroup?: string
  /** Scenario applied to a `'damaged'` build when no zone state is given. */
  damagedScenario?: string | null
}

/** The live configuration of a kit (what `configure` has set so far). */
export interface ResolvedConfiguration {
  defaultGroup: string
  plate: string
  defaultSplat: string
  impactStain: string | null
  damagedScenario: string | null
  texts: KitTexts & { who: string; noEffect: string }
}

export interface Plugin {
  name?: string
  configure?: KitConfiguration
  install?(kit: VehicleKit): void
}

export interface VehicleKitOptions extends KitConfiguration {
  /** The three.js namespace (`import * as THREE from 'three'` or `window.THREE`). */
  THREE: any
  /** A registered locale code (`'en'`, `'pt-BR'`), or a partial string table overriding English. Default `'en'`. */
  locale?: string | PartialLocaleStrings
  /** Document used for canvas textures and the UI. Defaults to the global `document`. */
  document?: Document
  plugins?: Plugin[]
}

export interface ImpactOptions {
  /** Do not leave a stain. */
  noStain?: boolean
  [key: string]: any
}

export interface SplatOptions {
  fluid?: string
  glass?: boolean
  obj?: ThreeObject
}

export interface ExplodeOptions {
  /** Explode immediately. */
  now?: boolean
  /** Seconds of fire before the blast (default 3..8 at random). */
  delay?: number
}

export interface OverallHealth {
  health: number
  band: number
  name: string
}

export interface ZoneDamageEntry {
  id: string
  name: string
  damage: number
}

export interface DamageMapOptions {
  /** Id of the selected zone. */
  selected?: string
  onSelect?(zoneId: string): void
}

export interface UiHelpers {
  damageMap(host: HTMLElement, c: VehicleContext, o?: DamageMapOptions): SVGElement | null
  bandButtons(host: HTMLElement, onPick?: (health: number, band: number) => void): HTMLButtonElement[]
  legend(host: HTMLElement): void
  healthBar(els: { text?: HTMLElement; bar?: HTMLElement }, c: VehicleContext): OverallHealth
  scenarioButtons(host: HTMLElement, onRun: (id: string) => void): HTMLButtonElement[]
  zoneLabel(z: DamageZone): string
  bandRange(i: number): string
  css(): string
  injectStyles(): void
}

/** Helpers for plugins that implement their own flag effects. */
export interface KitInternals {
  rng(seed: number): () => number
  strHash(text: string): number
  zonesOf(c: VehicleContext): DamageZone[]
  [key: string]: any
}

/** Low-level builders of the engine; see the JSDoc of each. They take and return three.js objects. */
type Builder = (...args: any[]) => any

export interface VehicleKit {
  readonly THREE: any
  /** Translated strings in use. */
  readonly strings: LocaleStrings
  /** Looks up a locale key (`'zones.hood'`) and fills variables. */
  readonly t: Translate
  readonly bands: Band[]
  readonly fleet: VehicleSpec[]
  readonly scenarios: ScenarioDefinition[]
  readonly plugins: string[]
  readonly fluidTypes: Record<string, FluidDefinition>
  readonly flagEffects: Record<string, FlagEffect>
  readonly fuels: Record<string, any>
  readonly groups: string[]
  readonly config: ResolvedConfiguration
  readonly internals: KitInternals
  readonly ui: UiHelpers

  /* registry */
  register(spec: VehicleSpec, build: BuildFunction): VehicleSpec
  find(key: string): VehicleSpec | null
  configure(options: KitConfiguration): VehicleKit
  /**
   * Registers a locale table (any top-level key, so a content pack can add its own) and refreshes the strings of this kit,
   * which keeps the locale it was created with. English is the fallback for every locale.
   */
  registerLocale(code: string, strings: Record<string, any>): VehicleKit
  plugin(plugin: Plugin): VehicleKit
  scenario(def: ScenarioDefinition): ScenarioDefinition
  defineFluid(key: string, def: FluidDefinition): FluidDefinition
  on(event: string, fn: (...args: any[]) => void): VehicleKit
  hook(event: string, ...args: any[]): void

  /* build and lifecycle */
  build(key: string, state?: BuildState, zoneState?: Partial<ZoneState>): VehicleContext
  dispose(c: VehicleContext): void
  /** Advances particles, fluids, hood, blast and rollover animations by `dt` seconds. */
  tick(c: VehicleContext, dt: number): void
  /** Runs `sec` seconds of `tick` in one go. */
  settle(c: VehicleContext, sec: number): void
  defaultDamage(c: VehicleContext): void

  /* zones and damage */
  bandOf(health: number): BandIndex
  zonesOf(c: VehicleContext): DamageZone[]
  applyZones(c: VehicleContext, state: Partial<ZoneState>): void
  zoneScenario(c: VehicleContext, idOrName: string): ScenarioResult
  zoneOverall(c: VehicleContext): OverallHealth
  zoneAt(c: VehicleContext, point: ThreeVector, object?: ThreeObject): DamageZone | null
  zoneDamageAt(c: VehicleContext, point: ThreeVector, dir: ThreeVector, force: number, object?: ThreeObject): ZoneDamageEntry[]
  zonePoint(c: VehicleContext, zone: DamageZone): ThreeVector
  zoneImpact(c: VehicleContext, side: 'front' | 'rear' | 'left' | 'right' | string, force: number): unknown
  impact(c: VehicleContext, point: ThreeVector, dir: ThreeVector, force: number, options?: ImpactOptions): unknown[]
  splat(
    c: VehicleContext,
    point: ThreeVector,
    normal: ThreeVector,
    radius: number,
    options?: SplatOptions,
  ): { grp: ThreeObject; [key: string]: any }
  explode(c: VehicleContext, options?: ExplodeOptions): number | false
  blastDamage(c: VehicleContext, amount: number): 'fire' | 'explosion' | null
  roll(c: VehicleContext, side?: number): boolean
  applyArmor(c: VehicleContext): void

  /* particles */
  spawn: Builder
  burst: Builder
  addEmitter: Builder

  /* everything else the content packs may need to compose vehicles (shells, glass, lights, wheels, ...) */
  readonly geo: Record<string, Builder>
  readonly materials: Record<string, any>
  [builder: string]: any
}
