/** A world rectangle `[x0, z0, x1, z1]`, metres. */
export type RainCoverBounds = readonly [x0: number, z0: number, x1: number, z1: number]

/**
 * Something with a roof or a slab over it (a house, a shed, a bus stop, a car): it says, for a point on the ground plan, how high the cover over it is.
 * The rain asks before it falls, splashes or wets the ground: under a cover there is none.
 */
export interface RainCoverSource {
  /** Where the source may cover anything; a point outside is never asked. */
  bounds(): RainCoverBounds
  /** Top (world y, metres) of the highest intact roof or slab over (x, z); `undefined` for open sky, or for a hole a blast or a collapse opened. */
  coverTopAt(x: number, z: number): number | undefined
  /** Grows whenever the covers change (a roof panel broke, a hole opened): whoever caches reads it. */
  version(): number
}

/** What the rain reads (`ModuleHost.rainCover`): every source of the host together. */
export interface RainCover {
  /** The highest cover over (x, z) among the sources, or `undefined` for open sky. */
  coverTopAt(x: number, z: number): number | undefined
  /** Changes whenever a source is added or removed or one of them changes. */
  version(): number
  /** True while there is no source: the rain skips the test. */
  isEmpty(): boolean
  /** Adds a source; returns the function that takes it away. */
  add(source: RainCoverSource): () => void
}

export function createRainCover(): RainCover {
  const sources = new Set<RainCoverSource>()
  let list: RainCoverSource[] = []
  let membership = 0
  return {
    coverTopAt(x, z) {
      let top: number | undefined
      for (const source of list) {
        const [x0, z0, x1, z1] = source.bounds()
        if (x < x0 || x > x1 || z < z0 || z > z1) continue
        const value = source.coverTopAt(x, z)
        if (value !== undefined && (top === undefined || value > top)) top = value
      }
      return top
    },
    version() {
      let sum = membership
      for (const source of list) sum += source.version()
      return sum
    },
    isEmpty: () => list.length === 0,
    add(source) {
      sources.add(source)
      list = [...sources]
      membership++
      return () => {
        if (!sources.delete(source)) return
        list = [...sources]
        membership++
      }
    },
  }
}

export type GridRainCoverOptions = {
  readonly bounds: RainCoverBounds
  /** Side of a cell, metres (default 0.25: a blast hole is bigger). */
  readonly cellSize?: number
  /** The exact answer at a cell centre; called again for every cell only after `invalidate`. */
  readonly coverTopAt: (x: number, z: number) => number | undefined
}

export type GridRainCoverSource = RainCoverSource & {
  /** The covers changed (a roof panel broke): the grid is cut again on the next question, and `version` grows. */
  invalidate(): void
}

const NO_COVER = -Infinity

/** A source answered from a grid cut once from `coverTopAt`: a question is two array reads, however many panels the roof has. */
export function createGridRainCover(options: GridRainCoverOptions): GridRainCoverSource {
  const [x0, z0, x1, z1] = options.bounds
  const cell = options.cellSize ?? 0.25
  const columns = Math.max(1, Math.ceil((x1 - x0) / cell))
  const rows = Math.max(1, Math.ceil((z1 - z0) / cell))
  const cells = new Float32Array(columns * rows)
  let revision = 0
  let isCut = false
  const cut = (): void => {
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const top = options.coverTopAt(x0 + (column + 0.5) * cell, z0 + (row + 0.5) * cell)
        cells[row * columns + column] = top === undefined ? NO_COVER : top
      }
    }
    isCut = true
  }
  return {
    bounds: () => options.bounds,
    coverTopAt(x, z) {
      if (!isCut) cut()
      const column = Math.floor((x - x0) / cell)
      const row = Math.floor((z - z0) / cell)
      if (column < 0 || row < 0 || column >= columns || row >= rows) return undefined
      const top = cells[row * columns + column]!
      return top === NO_COVER ? undefined : top
    },
    version: () => revision,
    invalidate() {
      isCut = false
      revision++
    },
  }
}

/** A roof or slab seen from above: the rectangle it covers and the height of its top. */
export type RainCoverRect = { readonly bounds: RainCoverBounds; readonly top: number }

/** A round opening in a cover (a blast hole), centre and radius in the ground plan. */
export type RainCoverHole = { readonly x: number; readonly z: number; readonly radius: number }

/** The exact answer for a list of rectangles with holes: the highest rectangle over the point whose hole does not take the point. */
export function rainCoverTopOf(rects: readonly RainCoverRect[], holes: readonly RainCoverHole[], x: number, z: number): number | undefined {
  let top: number | undefined
  for (const rect of rects) {
    if (x < rect.bounds[0] || x > rect.bounds[2] || z < rect.bounds[1] || z > rect.bounds[3]) continue
    if (top !== undefined && rect.top <= top) continue
    if (holes.some((hole) => (x - hole.x) ** 2 + (z - hole.z) ** 2 <= hole.radius ** 2)) continue
    top = rect.top
  }
  return top
}

/** A roof seen from above as a turned rectangle: its centre on the ground plan, half sides along its own axes, the turn about y and the height of its top. */
export type RainCoverFootprint = { readonly x: number; readonly z: number; readonly halfX: number; readonly halfZ: number; readonly yaw: number; readonly top: number }

export type FootprintRainCoverSource = RainCoverSource & {
  /**
   * Puts the roofs and the openings where they are now (a car moved, a window broke). The answer follows at once; the version grows only with `bumpVersion`,
   * which a mover asks once it has gone far enough for whoever caches (the far curtain) to cut again.
   */
  set(footprints: readonly RainCoverFootprint[], openings: readonly RainCoverFootprint[], bumpVersion: boolean): void
}

type Prepared = { readonly x: number; readonly z: number; readonly halfX: number; readonly halfZ: number; readonly cos: number; readonly sin: number; readonly top: number }

const prepare = (f: RainCoverFootprint): Prepared => ({ x: f.x, z: f.z, halfX: f.halfX, halfZ: f.halfZ, cos: Math.cos(f.yaw), sin: Math.sin(f.yaw), top: f.top })

const insideTurned = (f: Prepared, x: number, z: number): boolean => {
  const dx = x - f.x
  const dz = z - f.z
  return Math.abs(dx * f.cos + dz * f.sin) <= f.halfX && Math.abs(-dx * f.sin + dz * f.cos) <= f.halfZ
}

/**
 * A source of turned rectangles with openings (a car's cabin, a tent, a kiosk): a question is a few multiplications per rectangle, no allocation, so the near rain
 * asks it for every drop. `set` moves the rectangles whenever the thing moves; nothing else is cut or cached.
 */
export function createFootprintRainCover(): FootprintRainCoverSource {
  let roofs: Prepared[] = []
  let openings: Prepared[] = []
  let bounds: RainCoverBounds = [0, 0, 0, 0]
  let revision = 0
  return {
    bounds: () => bounds,
    version: () => revision,
    coverTopAt(x, z) {
      let top: number | undefined
      for (const roof of roofs) {
        if ((top !== undefined && roof.top <= top) || !insideTurned(roof, x, z)) continue
        top = roof.top
      }
      if (top === undefined) return undefined
      for (const opening of openings) if (insideTurned(opening, x, z)) return undefined
      return top
    },
    set(footprints, cutouts, bumpVersion) {
      roofs = footprints.map(prepare)
      openings = cutouts.map(prepare)
      let x0 = Infinity
      let z0 = Infinity
      let x1 = -Infinity
      let z1 = -Infinity
      for (const roof of roofs) {
        const reach = Math.abs(roof.halfX * roof.cos) + Math.abs(roof.halfZ * roof.sin)
        const reachZ = Math.abs(roof.halfX * roof.sin) + Math.abs(roof.halfZ * roof.cos)
        x0 = Math.min(x0, roof.x - reach)
        x1 = Math.max(x1, roof.x + reach)
        z0 = Math.min(z0, roof.z - reachZ)
        z1 = Math.max(z1, roof.z + reachZ)
      }
      bounds = roofs.length === 0 ? [0, 0, 0, 0] : [x0, z0, x1, z1]
      if (bumpVersion) revision++
    },
  }
}

/** The most cells a fixed footprint cover cuts: a wide district gets a coarser cell instead of a bigger grid. */
const FIXED_COVER_MAX_CELLS = 1_000_000

/** A source of turned rectangles that never move (the buildings of a district, a tent, a kiosk): answered from a grid cut once, two array reads a question however many roofs there are. */
export function createFixedFootprintRainCover(footprints: readonly RainCoverFootprint[], cellSize = 0.5): RainCoverSource {
  const roofs = footprints.map(prepare)
  if (roofs.length === 0) return { bounds: () => [0, 0, 0, 0], coverTopAt: () => undefined, version: () => 0 }
  const x0 = Math.min(...roofs.map((r) => r.x - Math.abs(r.halfX * r.cos) - Math.abs(r.halfZ * r.sin)))
  const x1 = Math.max(...roofs.map((r) => r.x + Math.abs(r.halfX * r.cos) + Math.abs(r.halfZ * r.sin)))
  const z0 = Math.min(...roofs.map((r) => r.z - Math.abs(r.halfX * r.sin) - Math.abs(r.halfZ * r.cos)))
  const z1 = Math.max(...roofs.map((r) => r.z + Math.abs(r.halfX * r.sin) + Math.abs(r.halfZ * r.cos)))
  const cell = Math.max(cellSize, Math.sqrt(((x1 - x0) * (z1 - z0)) / FIXED_COVER_MAX_CELLS))
  return createGridRainCover({
    bounds: [x0, z0, x1, z1],
    cellSize: cell,
    coverTopAt(x, z) {
      let top: number | undefined
      for (const roof of roofs) if ((top === undefined || roof.top > top) && insideTurned(roof, x, z)) top = roof.top
      return top
    },
  })
}
