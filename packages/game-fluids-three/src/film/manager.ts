import type * as THREE_NS from 'three'
import { FILM_PROFILES, filmProfileOf, layoutFromSurfaces } from '@adatechnology/game-fluids'
import type { FilmLayout, FilmProfile, FilmRandom, FluidWorld, LiquidId, StainTint, SurfaceSpec, Vec3 } from '@adatechnology/game-fluids'
import type { ThreeLib } from '../types'
import { FilmGrid } from './grid'
import type { CellRect } from './grid'

/** What the manager keeps from the page's budget text: up to 6 grids, only within 30 m, about 0.3 ms of simulation each (W711, W text "a mais de 30 m não anima"). */
const DEFAULT_MAX_GRIDS = 6
const DEFAULT_RANGE = 30
const DEFAULT_BUDGET_MS = 1.2
const DEFAULT_SETTLE_SECONDS = 20
const DEFAULT_MAX_STAGING = 16
const DEFAULT_GRID_METRES = 2
const DEFAULT_CELL = 0.0125
const BAKE_RANGE_FACTOR = 1.25
const EDGE_MARGIN = 0.35
const FLOOR_REACH = 0.3
/** A drop thrown from higher than this above a strip is not counted as over it. */
const DROP_HEIGHT = 2.5
const DEFAULT_DROP_RADIUS = 3
const FALL_SPEED = 2
const VISIBLE_THICKNESS = 0.035
const DEFAULT_HALF = 50
const FREE_AFTER_EMPTY = 2

/** The surfaces a grid is laid over: the floor, and optionally a wall the film folds up and a curb it folds down. */
export interface FilmSurfaces {
  floor: SurfaceSpec
  wall?: SurfaceSpec
  curb?: SurfaceSpec
}

/** The part of the renderer the manager uses to upload only the dirty rectangle of a texture (three 0.160 `copyTextureToTexture`). */
export interface FilmGpu {
  copyTextureToTexture(position: THREE_NS.Vector2, source: THREE_NS.Texture, destination: THREE_NS.Texture, level?: number): void
}

export interface FilmViewer {
  position: Vec3
  forward: Vec3
}

/** What a baked grid leaves behind in the host's stain decals. */
export interface FilmBake {
  fluid: LiquidId
  /** Where the film was thickest (world), litres of it, and the colours of its wet and dry look. */
  point: Vec3
  liters: number
  tint: StainTint
  /** Radius in metres of the wet cells around `point`. */
  radius: number
  reason: 'range' | 'settled' | 'budget' | 'clear'
}

export interface FilmManagerOptions {
  /** Where the grids are added (one group). */
  scene: THREE_NS.Object3D
  /** The host's random stream: the film never calls `Math.random`. */
  random: FilmRandom
  /** The player's eye: grids are simulated near it and drawn lit from it. A camera works; or give `viewer`. */
  camera?: THREE_NS.Camera
  viewer?: () => FilmViewer
  /** The surfaces under a world point (floor, wall, curb), or null for none. Default: the ground plane at `groundAt`. */
  surfaceAt?: (point: Vec3) => FilmSurfaces | null
  groundAt?: (x: number, z: number) => number
  /** The world whose stain decals take the film when a grid is baked (`fluids.splash`). Without it a bake only calls `onBake`. */
  fluids?: FluidWorld
  onBake?: (bake: FilmBake) => void
  /** Profiles by liquid id (default the film profiles of `game-fluids`); override one to tune it. */
  profiles?: Readonly<Record<string, FilmProfile>>
  /** Colour of the surface under the film (default the page's grey). */
  base?: number
  maxGrids?: number
  /** Metres from the player past which a grid is not simulated and is baked. */
  range?: number
  /** Milliseconds of film simulation per frame; the grids left out wait for the next frame. */
  budgetMs?: number
  /** Seconds without change after which a grid is baked and freed. */
  settleSeconds?: number
  /** Side of a grid in metres (cells are 1.25 cm) and the cell size. */
  gridMetres?: number
  cellSize?: number
  /** Seconds of drying clock that pass in one second of real time (the host scales it; default 1). */
  dryingSpeed?: number
  /** The renderer, for the partial texture uploads. Without it the whole texture goes up when it changes. */
  gpu?: FilmGpu
  /** A clock in milliseconds (default `performance.now`). */
  now?: () => number
}

export interface FilmStats {
  grids: number
  drops: number
  wetCells: number
  /** Milliseconds the last update spent simulating. */
  simMs: number
  /** Grids left out of the last update by the budget. */
  starved: number
  baked: number
  /** Texels written by partial uploads in the last update. */
  uploadedTexels: number
}

export interface FilmLaunch {
  fluid: LiquidId
  point: Vec3
  /** Default straight down at 2 m/s. */
  velocity?: Vec3
  /** Millimetres (default 3). */
  radius?: number
  surfaces?: FilmSurfaces
}

export interface FilmDripSpec {
  fluid: LiquidId
  point: Vec3
  /** Average seconds between drops. */
  every: number
  radius?: number
  surfaces?: FilmSurfaces
}

const distance = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/**
 * Keeps the running films near the player: at most `maxGrids` grids of 2 x 2 m, only within `range`, simulated inside a millisecond budget and uploaded by their
 * dirty rectangle. A grid that is out of range, still, or squeezed out by a newer one is baked: its film becomes a stain of the host's world with the same
 * colours and amount, and the grid is freed.
 */
export class FilmManager {
  readonly group: THREE_NS.Group
  private readonly grids: FilmGrid[] = []
  private readonly profiles: Readonly<Record<string, FilmProfile>>
  private readonly staging = new Map<string, THREE_NS.DataTexture>()
  private readonly now: () => number
  private rain = 0
  private time = 0
  private bakedCount = 0
  private last: FilmStats = { grids: 0, drops: 0, wetCells: 0, simMs: 0, starved: 0, baked: 0, uploadedTexels: 0 }
  private empties = new Map<FilmGrid, number>()

  constructor(
    private readonly THREE: ThreeLib,
    private readonly options: FilmManagerOptions,
  ) {
    this.group = new THREE.Group()
    this.group.name = 'film_manager'
    options.scene.add(this.group)
    this.profiles = options.profiles ?? Object.fromEntries(FILM_PROFILES.map((profile) => [profile.id, profile]))
    this.now = options.now ?? (() => (typeof performance === 'undefined' ? Date.now() : performance.now()))
  }

  get gridCount(): number {
    return this.grids.length
  }

  /** The grids, for a host that wants to look at them (a bench, a test). */
  list(): readonly FilmGrid[] {
    return this.grids
  }

  setWeather(weather: { rain: number }): void {
    this.rain = Math.min(1, Math.max(0, weather.rain))
    for (const grid of this.grids) grid.film.setWeather({ rain: this.rain })
  }

  /** Throws a drop of a liquid: it lands in the grid under it (made on the spot) and leaves the impact splash. Null when it is out of range or has no surface. */
  launch(request: FilmLaunch): FilmGrid | null {
    const grid = this.gridFor(request.fluid, request.point, request.surfaces)
    if (!grid) return null
    const velocity = request.velocity ?? [0, -FALL_SPEED, 0]
    grid.film.launch(request.point, velocity, request.radius ?? DEFAULT_DROP_RADIUS)
    return grid
  }

  /** A drip: a bead swells at `point`, detaches and falls every `every` seconds on average. Replaces the grid's drip. */
  drip(spec: FilmDripSpec): FilmGrid | null {
    const grid = this.gridFor(spec.fluid, spec.point, spec.surfaces)
    if (!grid) return null
    grid.film.drip = { position: [spec.point[0], spec.point[1], spec.point[2]], every: spec.every, base: spec.every, elapsed: 0, radius: spec.radius ?? DEFAULT_DROP_RADIUS }
    return grid
  }

  /** The grid of a liquid that covers `point`, made when there is none. Null when `point` is out of range or has no surface under it. */
  gridFor(fluid: LiquidId, point: Vec3, surfaces?: FilmSurfaces): FilmGrid | null {
    const viewer = this.viewer()
    if (viewer && distance(viewer.position, point) > (this.options.range ?? DEFAULT_RANGE)) return null
    const existing = this.grids.find((grid) => grid.profile.id === fluid && this.covers(grid, point))
    if (existing) return existing
    const profile = this.profiles[fluid] ?? filmProfileOf(fluid)
    if (!profile) return null
    const found = surfaces ?? this.surfacesAt(point)
    if (!found) return null
    const layout = layoutFromSurfaces({ ...found, center: point, columns: this.columns(), rows: this.columns(), cellSize: this.options.cellSize ?? DEFAULT_CELL })
    if (this.grids.length >= (this.options.maxGrids ?? DEFAULT_MAX_GRIDS)) this.evict(point)
    const grid = new FilmGrid(this.THREE, { layout, profile, random: this.options.random, center: point, ...(this.options.base === undefined ? {} : { base: this.options.base }) })
    grid.film.setWeather({ rain: this.rain })
    this.grids.push(grid)
    this.group.add(grid.group)
    return grid
  }

  /** One frame: simulates the grids near the player inside the budget, uploads what changed, bakes the ones that are far or still. */
  update(dt: number): FilmStats {
    this.time += dt
    const viewer = this.viewer()
    const range = this.options.range ?? DEFAULT_RANGE
    const budget = this.options.budgetMs ?? DEFAULT_BUDGET_MS
    const drying = dt * (this.options.dryingSpeed ?? 1)
    const order = [...this.grids].sort((a, b) => (viewer ? distance(viewer.position, a.center) - distance(viewer.position, b.center) : 0))
    const start = this.now()
    let starved = 0
    let uploaded = 0
    for (const grid of order) {
      if (viewer && distance(viewer.position, grid.center) > range * BAKE_RANGE_FACTOR) {
        this.release(grid, 'range')
        continue
      }
      if (this.now() - start > budget) {
        starved++
        continue
      }
      if (viewer) grid.setView(viewer.position, viewer.forward, this.time)
      const rect = grid.update(dt, drying)
      grid.syncDrops()
      if (rect) uploaded += this.upload(grid, rect)
      if (this.emptyFor(grid, dt) || grid.idle > (this.options.settleSeconds ?? DEFAULT_SETTLE_SECONDS)) this.release(grid, 'settled')
    }
    let drops = 0
    let wet = 0
    for (const grid of this.grids) {
      const { active } = grid.film.drops
      for (let i = 0; i < active.length; i++) drops += active[i]!
      wet += grid.film.wetCells()
    }
    this.last = { grids: this.grids.length, drops, wetCells: wet, simMs: this.now() - start, starved, baked: this.bakedCount, uploadedTexels: uploaded }
    return this.last
  }

  stats(): FilmStats {
    return this.last
  }

  /** Frees every grid. `bake` leaves each one's film as a stain first. */
  clear(bake = false): void {
    for (const grid of [...this.grids]) {
      if (bake) this.release(grid, 'clear')
      else this.free(grid)
    }
  }

  dispose(): void {
    this.clear()
    for (const texture of this.staging.values()) texture.dispose()
    this.staging.clear()
    this.options.scene.remove(this.group)
  }

  // ---- internals ----

  private columns(): number {
    return Math.round((this.options.gridMetres ?? DEFAULT_GRID_METRES) / (this.options.cellSize ?? DEFAULT_CELL))
  }

  private viewer(): FilmViewer | null {
    if (this.options.viewer) return this.options.viewer()
    const camera = this.options.camera
    if (!camera) return null
    const forward = new this.THREE.Vector3()
    camera.getWorldDirection(forward)
    return { position: [camera.position.x, camera.position.y, camera.position.z], forward: [forward.x, forward.y, forward.z] }
  }

  private surfacesAt(point: Vec3): FilmSurfaces | null {
    if (this.options.surfaceAt) return this.options.surfaceAt(point)
    const y = this.options.groundAt?.(point[0], point[2]) ?? 0
    return { floor: { id: 'film_ground', point: [point[0], y, point[2]], normal: [0, 1, 0], halfSize: [DEFAULT_HALF, DEFAULT_HALF], porosity: 0 } }
  }

  /** Whether `point` is over the grid, away from its edge, so a splash there does not fall off the strip. */
  private covers(grid: FilmGrid, point: Vec3): boolean {
    const layout: FilmLayout = grid.film.layout
    const wide = layout.width * layout.cellSize
    for (const region of layout.regions) {
      const local: Vec3 = [point[0] - region.origin[0], point[1] - region.origin[1], point[2] - region.origin[2]]
      const above = local[0] * region.normal[0] + local[1] * region.normal[1] + local[2] * region.normal[2]
      if (above < -FLOOR_REACH || above > DROP_HEIGHT) continue
      const sideways = local[0] * region.columnAxis[0] + local[1] * region.columnAxis[1] + local[2] * region.columnAxis[2]
      const down = local[0] * region.rowAxis[0] + local[1] * region.rowAxis[1] + local[2] * region.rowAxis[2]
      const length = region.rowCount * layout.cellSize
      if (sideways > EDGE_MARGIN && sideways < wide - EDGE_MARGIN && down > EDGE_MARGIN && down < length - EDGE_MARGIN) return true
    }
    return false
  }

  /** The grid squeezed out for a new one at `point`: the one that has been still the longest, then the farthest from the player. */
  private evict(point: Vec3): void {
    const viewer = this.viewer()
    const score = (grid: FilmGrid): number => grid.idle * 10 + (viewer ? distance(viewer.position, grid.center) : distance(point, grid.center))
    const victim = [...this.grids].sort((a, b) => score(b) - score(a))[0]
    if (victim) this.release(victim, 'budget')
  }

  /** A grid that has nothing wet for two seconds goes without a trace. */
  private emptyFor(grid: FilmGrid, dt: number): boolean {
    if (grid.film.wetCells() > 0 || grid.dropsInFlight() || grid.film.drip || grid.film.sources.length > 0) {
      this.empties.delete(grid)
      return false
    }
    const seconds = (this.empties.get(grid) ?? 0) + dt
    this.empties.set(grid, seconds)
    return seconds > FREE_AFTER_EMPTY
  }

  private free(grid: FilmGrid): void {
    const at = this.grids.indexOf(grid)
    if (at < 0) return
    this.grids.splice(at, 1)
    this.empties.delete(grid)
    this.group.remove(grid.group)
    grid.dispose()
  }

  /** Bakes the film of a grid into the host's stain decals and frees the grid. */
  private release(grid: FilmGrid, reason: FilmBake['reason']): void {
    const bake = this.measure(grid, reason)
    this.free(grid)
    if (!bake) return
    this.bakedCount++
    this.options.fluids?.splash(bake.fluid, bake.point, bake.liters, undefined, { tint: bake.tint })
    this.options.onBake?.(bake)
  }

  /** The film's centre of volume, its litres (millimetres of film times cell area) and the radius of the wet cells. */
  private measure(grid: FilmGrid, reason: FilmBake['reason']): FilmBake | null {
    const { thickness } = grid.film.field
    const { width, cellSize } = grid.film.layout
    let volume = 0
    let x = 0
    let y = 0
    let z = 0
    const wet: number[] = []
    for (let i = 0; i < thickness.length; i++) {
      const h = thickness[i]!
      if (h <= VISIBLE_THICKNESS) continue
      const at = grid.film.layout.cellToWorld(Math.floor(i / width) + 0.5, (i % width) + 0.5)
      volume += h
      x += at[0] * h
      y += at[1] * h
      z += at[2] * h
      wet.push(i)
    }
    if (volume === 0) return null
    const point: Vec3 = [x / volume, y / volume, z / volume]
    let radius = 0
    for (const i of wet) radius = Math.max(radius, distance(grid.film.layout.cellToWorld(Math.floor(i / width) + 0.5, (i % width) + 0.5), point))
    const profile = grid.profile
    return { fluid: profile.id, point, liters: volume * cellSize * cellSize, tint: { fresh: profile.thin, dry: profile.dry }, radius, reason }
  }

  /** Copies the dirty rectangle to the GPU texture; answers the texels written. */
  private upload(grid: FilmGrid, rect: CellRect): number {
    const gpu = this.options.gpu
    const width = rect.lastColumn - rect.firstColumn + 1
    const height = rect.lastRow - rect.firstRow + 1
    const whole = grid.film.layout.width * grid.film.layout.height
    if (!gpu || !grid.uploaded || width * height >= whole * 0.6) {
      grid.texture.needsUpdate = true
      return whole
    }
    const staging = this.stagingFor(width, height)
    const target = staging.image.data as unknown as Uint8Array
    const stride = grid.film.layout.width * 4
    for (let row = 0; row < height; row++) {
      const from = (rect.firstRow + row) * stride + rect.firstColumn * 4
      target.set(grid.data.subarray(from, from + width * 4), row * width * 4)
    }
    staging.needsUpdate = true
    gpu.copyTextureToTexture(new this.THREE.Vector2(rect.firstColumn, rect.firstRow), staging, grid.texture)
    return width * height
  }

  private stagingFor(width: number, height: number): THREE_NS.DataTexture {
    const key = `${width}x${height}`
    let texture = this.staging.get(key)
    if (!texture) {
      if (this.staging.size >= DEFAULT_MAX_STAGING) {
        const oldest = this.staging.keys().next().value as string
        this.staging.get(oldest)?.dispose()
        this.staging.delete(oldest)
      }
      texture = new this.THREE.DataTexture(new Uint8Array(new ArrayBuffer(width * height * 4)), width, height, this.THREE.RGBAFormat)
      texture.magFilter = this.THREE.LinearFilter
      texture.minFilter = this.THREE.LinearFilter
      this.staging.set(key, texture)
    }
    return texture
  }
}

export function createFilmManager(THREE: ThreeLib, options: FilmManagerOptions): FilmManager {
  return new FilmManager(THREE, options)
}
