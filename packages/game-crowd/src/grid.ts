/** Occupancy codes of a grid cell (G 62162: 0 free, 1 solid, 2 low wall that can be climbed, 3 open door, 4 glass; 5 closed door, G 63816). */
export const CELL = { FREE: 0, SOLID: 1, LOW_WALL: 2, OPEN_DOOR: 3, GLASS: 4, CLOSED_DOOR: 5 } as const

export type NavGridOptions = {
  /** Side of the square world in metres, centred on the origin (default 768, the game's world). */
  readonly size?: number
  /** Cell side in metres (default 0.5). */
  readonly cell?: number
  /** Fill a solid border of `borderWidth` m and `borderHeight` m around the world, as the game does (default true). */
  readonly border?: boolean
}

/**
 * The navigation and collision grid of the game (G 62158-62170): a square world of cells with an occupancy code and a height. Agents, the player,
 * the flow field and line of sight all read it. Buildings write it with `fillRect`.
 */
export type NavGrid = {
  readonly size: number
  readonly half: number
  readonly cell: number
  /** Cells per side. */
  readonly n: number
  readonly occ: Uint8Array
  readonly occH: Float32Array
  cellOf(x: number, z: number): number
  /** Solid for a body at height `y` (default 0.5): outside the world, or an occupied cell that is not an open door and is taller than `y`. */
  solidAt(x: number, z: number, y?: number): boolean
  /** The occupancy code at (x, z), -1 outside. */
  cellKind(x: number, z: number): number
  fillRect(x0: number, z0: number, x1: number, z1: number, kind: number, height: number): void
  /** Blocked for a walking agent: outside, or anything but free and open door (G 66826 `zBlocked`). */
  blocked(x: number, z: number): boolean
  /** Nothing solid and taller than 1.5 m between the two points, sampled every 0.5 m (G 66828 `losClear`). */
  losClear(x0: number, z0: number, x1: number, z1: number): boolean
}

/** The cell index of a world position for a square grid of `n` cells of `cell` metres centred on the origin, -1 outside. */
export const createCellOf =
  (half: number, cell: number, n: number) =>
  (x: number, z: number): number => {
    const gx = Math.floor((x + half) / cell)
    const gz = Math.floor((z + half) / cell)
    return gx < 0 || gz < 0 || gx >= n || gz >= n ? -1 : gz * n + gx
  }

const BORDER_WIDTH = 1
const BORDER_HEIGHT = 50
const LOS_STEP = 0.5
const LOS_HEIGHT = 1.5

export function createNavGrid(options: NavGridOptions = {}): NavGrid {
  const size = options.size ?? 768
  const half = size / 2
  const cell = options.cell ?? 0.5
  const n = size / cell
  const occ = new Uint8Array(n * n)
  const occH = new Float32Array(n * n)
  const cellOf = createCellOf(half, cell, n)
  const solidAt = (x: number, z: number, y = 0.5): boolean => {
    const c = cellOf(x, z)
    return c < 0 || (occ[c] !== 0 && occ[c] !== 3 && occH[c]! > y)
  }
  const fillRect = (x0: number, z0: number, x1: number, z1: number, kind: number, h: number): void => {
    const a = Math.floor((x0 + half) / cell)
    const b = Math.ceil((x1 + half) / cell)
    const c = Math.floor((z0 + half) / cell)
    const d = Math.ceil((z1 + half) / cell)
    for (let gz = Math.max(0, c); gz < Math.min(n, d); gz++)
      for (let gx = Math.max(0, a); gx < Math.min(n, b); gx++) {
        const i = gz * n + gx
        occ[i] = kind
        occH[i] = h
      }
  }
  if (options.border ?? true) {
    fillRect(-half, -half, half, -half + BORDER_WIDTH, 1, BORDER_HEIGHT)
    fillRect(-half, half - BORDER_WIDTH, half, half, 1, BORDER_HEIGHT)
    fillRect(-half, -half, -half + BORDER_WIDTH, half, 1, BORDER_HEIGHT)
    fillRect(half - BORDER_WIDTH, -half, half, half, 1, BORDER_HEIGHT)
  }
  return {
    size,
    half,
    cell,
    n,
    occ,
    occH,
    cellOf,
    solidAt,
    cellKind: (x, z) => {
      const c = cellOf(x, z)
      return c < 0 ? -1 : occ[c]!
    },
    fillRect,
    blocked(x, z) {
      const c = cellOf(x, z)
      return c < 0 || (occ[c] !== 0 && occ[c] !== 3)
    },
    losClear(x0, z0, x1, z1) {
      const d = Math.hypot(x1 - x0, z1 - z0)
      const steps = Math.ceil(d / LOS_STEP)
      for (let k = 1; k < steps; k++) {
        const t = k / steps
        const c = cellOf(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)
        if (c < 0 || (occ[c] === 1 && occH[c]! > LOS_HEIGHT)) return false
      }
      return true
    },
  }
}
