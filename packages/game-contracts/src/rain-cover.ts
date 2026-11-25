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
