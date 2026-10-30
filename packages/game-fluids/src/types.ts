/**
 * Public types of @adatechnology/game-fluids.
 *
 * Renderer-free liquids. Three things:
 * - Containers: a cup, a bottle, a jerrycan, a fuel tank, a water tank. They hold one liquid with a level and a temperature, know their opening
 *   and their tilt, and can be filled, poured, drunk from, spilled (tilted past the lip) or leak through holes (from a damage model).
 * - Streams: liquid leaving a container or a hole. Each stream is a falling jet that ends on a surface.
 * - Stains: what a stream or a spill leaves on a surface. A stain grows from a flow front (never a perfect disc), soaks into porous surfaces,
 *   and dries from the edge in. Each liquid is its own material (water, coffee, fuel, oil, blood...).
 *
 * Units: metres, litres, seconds, °C. Deterministic from the seed (a LAN host can run it and send events).
 */

import type { ContainerSpec, ItemUseDef, LiquidId, Quat, Vec3 } from '@adatechnology/game-contracts'

// `ContainerSpec`, `LiquidId` and `ItemUseDef` are contracts: they live in @adatechnology/game-contracts and are re-exported here so that no import breaks.
export type { ContainerSpec, ItemUseDef, LiquidId, Quat, Vec3 }

export interface LiquidDef {
  id: LiquidId
  /** Colour `0xRRGGBB` and opacity 0..1 of the body of liquid. */
  color: number
  opacity: number
  /** Colour of a wet/dried stain (default darker `color`). */
  stainColor?: number
  /** Viscosity relative to water (water 1, oil 60, honey 3000). Slows streams and stain spread, thickens drops. */
  viscosity: number
  density: number
  /** Seconds a thin stain takes to dry at 20 °C (water 600, fuel 120, oil never = 0). */
  dryTime: number
  /** Leaves a permanent mark after drying (coffee, blood, oil, paint). */
  leavesMark?: boolean
  flammable?: boolean
  /** Gloss of a wet surface 0..1 (water 0.9, oil 1, milk 0.5). */
  gloss: number
  /** Steams when hotter than this (default 60 for drinks). */
  steamC?: number
  /** Drinkable: thirst points per litre (positive) and any effect key the host maps (e.g. `caffeine`, `alcohol`, `poison`). */
  drink?: { thirst: number; effects?: string[] }
  tags?: string[]
}

/** Colours of one splash: the wet film (`fresh`) and what it dries to (`dry`). A game uses it for what the liquid depends on (the age of an infection) while the liquid stays generic. */
export interface StainTint {
  fresh: number
  dry: number
}

export interface SplashOptions {
  /** Overrides the colours the liquid's definition gives the stain this splash makes (or joins; the latest tint wins). */
  tint?: StainTint
}

export interface ContainerState {
  id: string
  liquid: LiquidId | null
  liters: number
  capacity: number
  temperature: number
  closed: boolean
  /** Height of the liquid surface above the inner bottom along world up, metres (with tilt). */
  surfaceHeight: number
  /** Liquid surface plane in world space (for the renderer): a point and the normal (always world up while still; sloshes when moved). */
  surfacePoint: Vec3
  surfaceNormal: Vec3
  /** Holes from damage, in local space. */
  holes: Array<{ point: Vec3; normal: Vec3; diameter: number }>
  /** Flowing out now (litres per second) through the opening (pour/spill) and holes. */
  outflow: number
  steaming: boolean
  /** Inner shape and effective lip radius (metres), so a renderer can draw the liquid body without knowing the spec. */
  shape?: ContainerSpec['shape']
  lipRadius?: number
  /** World transform the container was last given with `setTransform`. */
  position?: Vec3
  rotation?: Quat
}

export type StreamCause = 'pour' | 'spill' | 'leak' | 'tap'

/** A fixed water source (a tap, a pipe, a hose end) that runs a stream while it is on. See `FluidWorld.addTap`. */
export interface TapSpec {
  /** Id (default `tap_<n>`). Adding a tap with an id that already exists replaces it. */
  id?: string
  /** World position of the nozzle. */
  position: Vec3
  /** Direction the liquid leaves in (normalised; default straight down `[0, -1, 0]`). */
  direction?: Vec3
  liquid: LiquidId
  /** Litres per second while on (a kitchen tap is about 0.1). */
  rate: number
  /** Temperature of the liquid in °C (default the ambient temperature). */
  temperature?: number
  /** Starts running (default `true`). */
  on?: boolean
}

export interface TapState {
  id: string
  position: Vec3
  direction: Vec3
  liquid: LiquidId
  rate: number
  temperature: number
  on: boolean
  /** Id of the `tap` stream while it runs. */
  stream?: string
}

export interface StreamState {
  id: string
  liquid: LiquidId
  cause: StreamCause
  container?: string
  /** The tap that feeds it (`cause: 'tap'`). */
  tap?: string
  /** World start point and initial velocity. */
  origin: Vec3
  velocity: Vec3
  /** Litres per second. */
  rate: number
  /** Where it lands (null while still in the air or nothing below). */
  landing: Vec3 | null
  /** Thin trickle (drops) or a jet. */
  thin: boolean
  /** Seconds the jet flies before it lands (capped when it lands nowhere). Sample the path with `sampleStream`. */
  flightTime?: number
}

export interface SurfaceSpec {
  id: string
  /** Horizontal rectangle (floors, tables) or any plane: a point, a normal and its half extents along two axes. */
  point: Vec3
  normal: Vec3
  /** Half extents along `tangent` and normal × tangent. */
  halfSize: [number, number]
  tangent?: Vec3
  /** 0 = sealed (tile, glass, metal), 1 = soaks fast (fabric, soil, wood). Soaking shrinks the stain area and darkens it. */
  porosity: number
  /** Slope makes stains run downhill (computed from `normal`). */
}

export interface StainState {
  id: string
  surface: string
  liquid: LiquidId
  /** Centre in world space and the flow front: radii per direction (16 samples around the centre) so the outline is irregular. */
  center: Vec3
  front: number[]
  /** Litres on the surface (pooled) and soaked. */
  liters: number
  soaked: number
  /** 0..1: 1 = wet, 0 = dry; a dried `leavesMark` stain stays as a mark. */
  wetness: number
  /** The wet area recedes from the edge in: radius fraction still wet. */
  wetRadius: number
  /** Surface normal and tangent of the plane the stain lies on; `front[i]` points along `cos(2πi/16)·tangent + sin(2πi/16)·(normal × tangent)`. */
  normal?: Vec3
  tangent?: Vec3
  /** Unit direction (in the surface plane) the liquid arrived from moving towards, when it landed with horizontal speed (the impact shows where it came from). */
  flow?: Vec3
  /** True once the wet part dried and only the permanent mark of a `leavesMark` liquid remains. */
  mark?: boolean
  /** Seconds since the stain was created. */
  age?: number
  /** The colours of the splash that made it, when it was given a `tint`. */
  tint?: StainTint
}

export type FluidEvent =
  | { type: 'fill'; container: string; liquid: LiquidId; liters: number }
  | { type: 'pour'; container: string; liquid: LiquidId; rate: number; stream: string }
  | { type: 'spill'; container: string; liquid: LiquidId; rate: number; stream: string }
  | { type: 'leak'; container: string; liquid: LiquidId; rate: number; stream: string; point: Vec3 }
  | { type: 'drink'; container: string; liquid: LiquidId; liters: number; temperature: number; thirst: number; effects: string[]; burn: boolean; eaten?: boolean }
  | { type: 'empty'; container: string }
  | { type: 'stream_end'; stream: string }
  | { type: 'splash'; liquid: LiquidId; point: Vec3; intensity: number }
  | { type: 'stain'; stain: string; surface: string; liquid: LiquidId; point: Vec3 }
  | { type: 'dried'; stain: string; mark: boolean }
  | { type: 'steam'; container: string; on: boolean }
  | { type: 'mix'; container: string; from: LiquidId; into: LiquidId }
  /** A tap was switched on or off (`setTap`, `addTap` with `on`). */
  | { type: 'tap'; tap: string; on: boolean }

export interface FluidOptions {
  /** Extra or replacing liquid definitions (matched by `id`) on top of the built-in `LIQUIDS`. */
  liquids?: LiquidDef[]
  /** Locale of the strings returned by `describe` (`en` default, `pt-BR`; unknown locales fall back to `en`). */
  locale?: string
  seed?: number
  ambientC?: number
  gravity?: number
  /** Ground height for streams that hit no surface (default 0). */
  groundAt?: (x: number, z: number) => number
  /** Merge stains closer than this (default 0.15 m). Upper bound of live stains (default 64; oldest dry ones go first). */
  mergeDistance?: number
  maxStains?: number
  onEvent?: (event: FluidEvent) => void
}

export interface FluidWorld {
  readonly liquids: ReadonlyMap<LiquidId, LiquidDef>
  /** Gravity in m/s² used by streams (so a renderer can sample the same path). */
  readonly gravity: number
  /** Human readable one-liner of an event in the configured locale, for logs and debug panels. */
  describe(event: FluidEvent): string
  addContainer(spec: ContainerSpec, options?: { id?: string; position?: Vec3; rotation?: Quat }): string
  removeContainer(id: string): void
  /** Keep in sync with the object that carries it (tilt decides spilling and the surface plane; velocity makes it slosh). */
  setTransform(id: string, position: Vec3, rotation: Quat, velocity?: Vec3): void
  open(id: string): void
  close(id: string): void
  /** Add liquid (from a tap, another container); mixing different liquids keeps the bigger one and emits `mix`. Returns litres accepted. */
  fill(id: string, liquid: LiquidId, liters: number, temperature?: number): number
  /** Pour on purpose for `dt` seconds (tilts the flow out of the opening even when not tilted far). Returns litres out. */
  pour(id: string, dt: number, into?: string): number
  /** Drink `liters` (sip ~0.03 l); returns the drink event or null when empty/closed. Too hot (> 65 °C) sets `burn`. */
  /** Takes `liters` out of an open container into the mouth. `eaten`: it is the liquid packed with food, eaten with it (no drinking effects). */
  drink(id: string, liters: number, options?: { eaten?: boolean }): Extract<FluidEvent, { type: 'drink' }> | null
  /** Punch a hole (local space) — call it from a damage model's `hole`/`leak` events. */
  puncture(id: string, point: Vec3, normal: Vec3, diameter: number): void
  /** Heat or cool the content (a stove under a kettle, a fire). */
  heat(id: string, deltaC: number): void
  addSurface(spec: SurfaceSpec): void
  removeSurface(id: string): void
  /**
   * Add a tap: while `on` it runs a `tap` stream (cause `'tap'`) from `position` along `direction` at `rate` litres per second. The stream fills any
   * container whose opening it lands in (the same logic as a pour) and otherwise makes a stain on the surface below. Returns the tap id.
   * Switching on or off emits a `tap` event.
   */
  addTap(spec: TapSpec): string
  /** Switch a tap on or off, optionally changing its `rate`. Unknown ids are ignored. */
  setTap(id: string, on: boolean, rate?: number): void
  /** Remove a tap (and end its stream). */
  removeTap(id: string): void
  taps(): TapState[]
  /** Pour liquid straight onto a point (a broken bottle, a blood splash). `options.tint` colours the stain for this splash only. */
  splash(liquid: LiquidId, point: Vec3, liters: number, velocity?: Vec3, options?: SplashOptions): void
  /** Wipe or burn stains in a radius (fire dries water and burns fuel stains). */
  clearStains(point: Vec3, radius: number): void
  update(dt: number): FluidEvent[]
  container(id: string): ContainerState | null
  containers(): ContainerState[]
  streams(): StreamState[]
  stains(): StainState[]
  on(type: FluidEvent['type'] | '*', fn: (event: FluidEvent) => void): () => void
  serialize(): unknown
  load(snapshot: unknown): void
}

export interface ItemUsePlayer {
  readonly def: ItemUseDef
  readonly time: number
  readonly done: boolean
  /** Current hand-relative pose (interpolated). */
  pose(): { position: Vec3; rotation: Vec3 }
  /** Advance; applies the container actions to the fluid world and returns the events it produced. */
  update(dt: number): FluidEvent[]
  cancel(): void
}
