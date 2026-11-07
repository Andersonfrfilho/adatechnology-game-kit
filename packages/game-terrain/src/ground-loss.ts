import type { GroundLoss } from '@adatechnology/game-contracts'
import type { TerrainVoid } from './types'

/** A loss shallower than this (m below the untouched surface) is a scuff, not a void anything bears over. */
export const GROUND_LOSS_MIN_DEPTH = 0.02
/** Sand that slid tells the host only where it lowered the ground by at least this much (m). */
export const SLIDE_LOSS_MIN_LOWERING = 0.05
/** Under this depth (m) a vertex still counts as ground in `voidUnder`. */
export const VOID_MIN_DEPTH = 0.02

export interface HeightGrid {
  readonly x0: number
  readonly z0: number
  readonly cellSize: number
  readonly stride: number
  readonly columns: number
  readonly rows: number
  readonly dug: Float32Array
}

/** What one event lowered, by vertex (metres of the column, not of the loose heap on it). Lowerings of the same vertex add up; a fill counts against them. */
export type LossTally = Map<number, number>

export function tallyLowered(tally: LossTally, index: number, amount: number): void {
  if (amount !== 0) tally.set(index, (tally.get(index) ?? 0) + amount)
}

/**
 * The disc the tally lowered, or null when it is shallower than `GROUND_LOSS_MIN_DEPTH`. Vertices lowered less than `minLowering` are left out. `depth` is
 * the deepest the ground is now under its untouched surface there. A `bowl` (a crater, sand that slid) is told as the paraboloid that is half as deep
 * where the ground is now half as deep, so a wide shallow scrape around a deep hole does not pass for a wide deep one; a `flat` hole (a slab that opened)
 * keeps its edge.
 */
export function lossOf(grid: HeightGrid, tally: LossTally, spec: { source: string; minLowering: number; shape: 'bowl' | 'flat' }): GroundLoss | null {
  let weight = 0
  let centerX = 0
  let centerZ = 0
  let depth = 0
  let deepest = 0
  const kept: number[] = []
  for (const [index, amount] of tally) {
    if (amount < spec.minLowering || amount <= 0) continue
    const column = index % grid.stride
    const row = (index - column) / grid.stride
    weight += amount
    centerX += (grid.x0 + column * grid.cellSize) * amount
    centerZ += (grid.z0 + row * grid.cellSize) * amount
    depth = Math.max(depth, grid.dug[index]!)
    deepest = Math.max(deepest, amount)
    kept.push(index)
  }
  if (weight <= 0 || depth < GROUND_LOSS_MIN_DEPTH || deepest < GROUND_LOSS_MIN_DEPTH) return null
  centerX /= weight
  centerZ /= weight
  let radius = 0
  for (const index of kept) {
    if (spec.shape === 'bowl' && grid.dug[index]! < depth / 2) continue
    const column = index % grid.stride
    const row = (index - column) / grid.stride
    radius = Math.max(radius, Math.hypot(grid.x0 + column * grid.cellSize - centerX, grid.z0 + row * grid.cellSize - centerZ))
  }
  const reach = spec.shape === 'bowl' ? Math.SQRT2 * (radius + grid.cellSize / 2) : radius + grid.cellSize / 2
  return { x: centerX, z: centerZ, radius: reach, depth, removed: weight * grid.cellSize * grid.cellSize, source: spec.source }
}

/** How much of the disc (x, z, radius) has no ground under where it was: the vertices inside it, or the nearest one when the disc is smaller than a cell. */
export function voidUnder(grid: HeightGrid, spec: { x: number; z: number; radius: number }): TerrainVoid {
  const { x, z, radius } = spec
  const clamp = (value: number, top: number): number => Math.max(0, Math.min(top, value))
  const column0 = clamp(Math.ceil((x - radius - grid.x0) / grid.cellSize), grid.columns)
  const column1 = clamp(Math.floor((x + radius - grid.x0) / grid.cellSize), grid.columns)
  const row0 = clamp(Math.ceil((z - radius - grid.z0) / grid.cellSize), grid.rows)
  const row1 = clamp(Math.floor((z + radius - grid.z0) / grid.cellSize), grid.rows)
  let count = 0
  let sum = 0
  let depth = 0
  let open = 0
  for (let row = row0; row <= row1; row++) {
    for (let column = column0; column <= column1; column++) {
      if (Math.hypot(grid.x0 + column * grid.cellSize - x, grid.z0 + row * grid.cellSize - z) > radius) continue
      const here = grid.dug[row * grid.stride + column]!
      count++
      sum += here
      depth = Math.max(depth, here)
      if (here >= VOID_MIN_DEPTH) open++
    }
  }
  if (count === 0) {
    const here = grid.dug[clamp(Math.round((z - grid.z0) / grid.cellSize), grid.rows) * grid.stride + clamp(Math.round((x - grid.x0) / grid.cellSize), grid.columns)]!
    return { depth: here, mean: here, fraction: here >= VOID_MIN_DEPTH ? 1 : 0 }
  }
  return { depth, mean: sum / count, fraction: open / count }
}
