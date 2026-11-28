import type { DebrisObstacle } from './types'

/** What a debris piece is to its neighbours: a flat box seen as a disc of its widest half side, as thick as its thinnest side. */
export interface ContactPiece {
  on: boolean
  x: number
  y: number
  z: number
  vx: number
  vz: number
  sx: number
  sy: number
  sz: number
  rest: boolean
}

/** Side of a cell of the grid of resting pieces, metres: a little more than the biggest chip, so a piece only looks at its own cell and the ones round it. */
const CELL = 0.12
/** Share of the speed across an obstacle's surface a piece keeps when it strikes it. */
const OBSTACLE_BOUNCE = 0.3

const radiusOf = (piece: ContactPiece): number => Math.max(piece.sx, piece.sz) * 0.5
const thicknessOf = (piece: ContactPiece): number => Math.min(piece.sx, piece.sy, piece.sz)
const cellKey = (i: number, k: number): number => (i + 4096) * 8192 + (k + 4096)

/**
 * The pieces at rest, by cell: what the moving pieces land on (a pile grows, a chip lies on a chip). Built once a frame, only when something moves, so a
 * floor of sleeping chips costs nothing.
 */
export class RestingGrid {
  private readonly cells = new Map<number, ContactPiece[]>()

  clear(): void {
    for (const list of this.cells.values()) list.length = 0
  }

  rebuild(pieces: readonly ContactPiece[]): void {
    this.clear()
    for (const piece of pieces) {
      if (!piece.on || !piece.rest) continue
      const key = cellKey(Math.floor(piece.x / CELL), Math.floor(piece.z / CELL))
      const list = this.cells.get(key)
      if (list) list.push(piece)
      else this.cells.set(key, [piece])
    }
  }

  /** The height a piece at `piece`'s place lands at on the pieces under it (the top of the highest one it overlaps), or `-Infinity` over none. */
  supportUnder(piece: ContactPiece): number {
    const i = Math.floor(piece.x / CELL)
    const k = Math.floor(piece.z / CELL)
    const reach = radiusOf(piece)
    let top = -Infinity
    for (let di = -1; di <= 1; di++) {
      for (let dk = -1; dk <= 1; dk++) {
        for (const other of this.cells.get(cellKey(i + di, k + dk)) ?? []) {
          if (other === piece) continue
          if (Math.hypot(other.x - piece.x, other.z - piece.z) > reach + radiusOf(other)) continue
          // only what lies below the piece holds it up (a piece already beside a pile does not climb it)
          const otherTop = other.y + thicknessOf(other) * 0.5
          if (otherTop <= piece.y + thicknessOf(piece) * 0.5) top = Math.max(top, otherTop + thicknessOf(piece) * 0.5)
        }
      }
    }
    return top
  }
}

/**
 * Keeps a piece out of the upright bodies (the player): a piece inside one is put back on its surface and its speed into it turned back. Answers whether it
 * was moved (a piece at rest that a foot pushes wakes up).
 */
export function pushOutOfObstacles(piece: ContactPiece, obstacles: readonly DebrisObstacle[]): boolean {
  let moved = false
  for (const body of obstacles) {
    if (piece.y < body.bottom || piece.y > body.top) continue
    const dx = piece.x - body.x
    const dz = piece.z - body.z
    const distance = Math.hypot(dx, dz)
    const reach = body.radius + radiusOf(piece)
    if (distance >= reach) continue
    const nx = distance > 1e-6 ? dx / distance : 1
    const nz = distance > 1e-6 ? dz / distance : 0
    piece.x = body.x + nx * reach
    piece.z = body.z + nz * reach
    const into = piece.vx * nx + piece.vz * nz
    if (into < 0) {
      piece.vx -= (1 + OBSTACLE_BOUNCE) * into * nx
      piece.vz -= (1 + OBSTACLE_BOUNCE) * into * nz
    }
    moved = true
  }
  return moved
}
