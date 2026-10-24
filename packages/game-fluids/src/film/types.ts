import type { LiquidId, Vec3 } from '../types'

/** A seeded source of numbers in [0, 1). The film never calls `Math.random`: the host owns the stream, so a replay gets the same film. */
export type FilmRandom = () => number

/** Which shader branch draws the liquid (the pages' `uFl`: blood 0, bile 2, oil 3, fuel 4). */
export type FilmLook = 'blood' | 'bile' | 'oil' | 'fuel'

/** Colours are `0xRRGGBB` integers, thickness is in millimetres (one cell holds that much film). */
export interface FilmProfile {
  id: LiquidId
  look: FilmLook
  /** Flow rate of the thin-film step. */
  flow: number
  /** Thickness that stays behind when the film runs (scaled per cell by the layout's pinning noise). */
  pin: number
  /** Thickness a dry cell needs to be wetted: it makes the bulb at the tip of a rivulet. */
  front: number
  referenceThickness: number
  /** Largest bed height difference the flow sees across one edge. */
  slopeCap: number
  /** Seconds a thin film takes to dry (0 = never). */
  dryTime: number
  /** Thickness lost per second at the edge (fuel). */
  evaporation: number
  opacityRate: number
  reflectance: number
  normalScale: number
  thin: number
  thick: number
  dry: number
  dryThin: number
  dropColor: number
  dropOpacity: number
  /** Volume factor of a landing drop. */
  volume: number
  /** 1 = the Fluid Standard's long spikes and satellites; below 1 = short spikes and thicker blobs (bile in the Workshop). */
  spikes: number
  /** A drop of this liquid lands as one rounded blob instead of an impact splash (oil and fuel in the Workshop). */
  landsAsBlob: boolean
  /** Cap of the thickness a landing drop deposits at its centre. */
  maxAmount: number
  sources?: Record<string, string>
}

/** The plane of one folded strip of the grid: cell `(row, column)` sits at `origin + column * columnAxis * cell + (row - firstRow) * rowAxis * cell`. */
export interface FilmRegion {
  id: string
  firstRow: number
  rowCount: number
  origin: Vec3
  columnAxis: Vec3
  rowAxis: Vec3
  /** Unit normal pointing out of the surface (towards the air). */
  normal: Vec3
  /** True for walls and curb faces: the film runs sideways more slowly and keeps less behind. */
  isVertical: boolean
}

/** Where a drop hit a region, in grid terms. `along` is the travel direction on the surface in (column, row) axes; `normalSpeed` is the speed into the surface. */
export interface FilmImpact {
  row: number
  column: number
  along: [number, number]
  normalSpeed: number
}

/** The rules that differ between the Fluid Standard and the Workshop (and between host scenes). */
export interface FilmRules {
  /** Drops in flight at once (the ring is reused, oldest overwritten). */
  dropCapacity: number
  /** A drop falling past the curb edge lands on the curb face. */
  curbCatch: boolean
  /** A drop below the sidewalk height only counts as on the sidewalk when it is in front of the wall. */
  guardBehindWall: boolean
  /** Drops landing beyond the end of the road strip are ignored. */
  clipRoadEnd: boolean
  /** Drops that leave this box are dropped (x and z limits). */
  escapeBox?: { minX: number; maxX: number; maxZ: number }
  /** How the drip draws its bead and jitter: the Standard's formulas or the Workshop's. */
  dripStyle: 'padrao' | 'workshop'
}

export interface FilmLayout {
  id: string
  width: number
  height: number
  /** Metres per cell. */
  cellSize: number
  /** Bed height of each cell in mm (what the film runs down), pinning factor and 1/0.95 vertical flag. */
  bed: Float32Array
  pin: Float32Array
  vertical: Float32Array
  regions: readonly FilmRegion[]
  rules: FilmRules
  /** World position of a (possibly fractional) cell centre-corner. */
  cellToWorld(row: number, column: number): Vec3
  /** Which region a drop that moved from `previous` to `position` hit (`-1` = none). May snap `position` onto the surface. */
  collide(previous: Vec3, position: Vec3): number
  impact(region: number, position: Vec3, velocity: Vec3): FilmImpact
  /** Whether a landing point is on the strip (inside its width and, for the Standard, before the end of the road). */
  contains(position: Vec3): boolean
  /** Whether a drop that hit nothing has left the area for good. */
  escaped(position: Vec3): boolean
}

/** The grids a film simulates. Flat arrays, `row * width + column`. */
export interface FilmField {
  readonly width: number
  readonly height: number
  /** Thickness in mm. */
  readonly thickness: Float32Array
  /** Dryness 0..1. */
  readonly dryness: Float32Array
  /** Wet-ground mark 0..1 (gasoline darkens the ground while its film evaporates). */
  readonly dampness: Float32Array
}

export interface FilmBounds {
  firstRow: number
  lastRow: number
  firstColumn: number
  lastColumn: number
}

export interface FilmAdvanceInput {
  /** Seconds of real time since the last call. */
  dt: number
  /** Seconds of drying clock that pass in `dt` (simulation time, scaled by the host). */
  dryingSeconds: number
}

/** Steps and dries the film. The CPU version is the reference golden; a GPU version can replace it behind the same interface. */
export interface FilmSimulator {
  /** Wet bounding box used by the last advance (`lastRow < 0` = nothing wet). */
  readonly bounds: FilmBounds
  /** Recompute the wet bounding box. Call it after anything wrote to the field outside `advance`. */
  refreshBounds(): void
  /** Runs the flow steps the elapsed time owes (at most `maxSteps`) and the drying. Returns the steps run. */
  advance(input: FilmAdvanceInput): number
  /** Drops the leftover step time (a new scene). */
  resetClock(): void
}

export interface FilmDrip {
  /** World point of the dripping fingertip, moved by the host each frame. */
  position: Vec3
  /** Seconds to the next drop: `every` is the current wait and `base` the average. */
  every: number
  base: number
  elapsed: number
  /** Drop radius in mm. */
  radius: number
}

export interface FilmBead {
  visible: boolean
  position: Vec3
  /** Radius in mm of the swelling bead. */
  radius: number
  /** 0..1 of the way to detaching. */
  swell: number
}

export interface FilmSource {
  row: number
  column: number
  /** Thickness added per second. */
  rate: number
  /** Seconds since the start (may start negative to delay it). */
  elapsed: number
  duration: number
  /** Radius in cells the deposit scatters over. */
  radius: number
}

export interface FilmDrag {
  elapsed: number
  duration: number
  /** Half width in cells. */
  width: number
  amount: number
  /** One load factor per half-cell across the width (`width * 4 + 1` of them). */
  stripes: number[]
  path(progress: number): { row: number; column: number }
  /** Throws drops from the moving hand: `height` is the world y they start at, `speed` the travel speed. */
  hand?: { height: number; speed: number }
  done: boolean
}

export interface FilmDropState {
  /** Number of slots (the ring). */
  readonly capacity: number
  /** Drops launched since the pool was made. */
  readonly launched: number
  readonly active: Uint8Array
  /** x, y, z per slot. */
  readonly position: Float64Array
  readonly velocity: Float64Array
  /** Radius in mm. */
  readonly radius: Float64Array
}

export interface FilmWeather {
  /** 0..1. While it rains drying stops and the film spreads 1.5 times faster. */
  rain: number
}

export interface FilmOptions {
  layout: FilmLayout
  profile: FilmProfile
  random: FilmRandom
  /** Flow steps per second of real time (default 180). */
  stepRate?: number
  /** Most steps in one advance (default 6). */
  maxSteps?: number
  /** Replace the CPU simulator, for a GPU version. */
  simulator?: (field: FilmField, layout: FilmLayout, profile: () => FilmProfile, options: { stepRate: number; maxSteps: number; weather: () => FilmWeather }) => FilmSimulator
}

export interface Film {
  readonly layout: FilmLayout
  readonly field: FilmField
  readonly drops: FilmDropState
  readonly bead: FilmBead
  readonly simulator: FilmSimulator
  profile: FilmProfile
  drip: FilmDrip | undefined
  readonly sources: FilmSource[]
  readonly drags: FilmDrag[]
  /** Throw a drop of `radius` mm from `position` with `velocity`. */
  launch(position: Vec3, velocity: Vec3, radius: number): void
  /** The impact splash: a body stretched by `1 / sin(angle)`, spikes, satellites and tails. `row`/`column` and `size` are in cells. */
  splat(row: number, column: number, size: number, directionColumn: number, directionRow: number, sinAngle: number, amount: number): void
  /** A filled ellipse with a noisy outline. */
  blob(row: number, column: number, along: number, across: number, directionColumn: number, directionRow: number, amount: number, roughness: number): void
  /** A tapered stroke between two cells. */
  stroke(fromRow: number, fromColumn: number, toRow: number, toColumn: number, startWidth: number, endWidth: number, amount: number): void
  deposit(row: number, column: number, amount: number): void
  /** One frame: drops, drip, sources, drags, then the flow steps and the drying. */
  update(input: FilmAdvanceInput): void
  setWeather(weather: Partial<FilmWeather>): void
  weather(): FilmWeather
  /** Empties the film, drops, drip, sources and drags. The ring cursor and the leftover step time stay, as in the pages. */
  clear(): void
  /** Number of cells above the visible thickness (0.035 mm). */
  wetCells(): number
}
