import { NAV_OBSTACLE_KIND } from '@adatechnology/game-contracts'
import type { NavObstacle, NavObstacleBox, NavObstacleSource } from '@adatechnology/game-contracts'

import type { Doors } from './doors'
import { CELL } from './grid'
import type { NavGrid } from './grid'

/** Below this height (m) what is left of a wall is a low wall an agent can climb (`CELL.LOW_WALL`); from it up, a solid. */
const LOW_WALL_MAX_HEIGHT = 1.2

export type NavObstacleBindingOptions = {
  /** Height (m) from which a box is a solid instead of a low wall (default 1.2). */
  readonly lowWallMaxHeight?: number
}

export type NavObstacleBinding = {
  /** Applies what changed in the source since the last call (a door opened or closed, a wall cut or gone): call it once per fixed step, before the crowd's. */
  sync(): void
  /** The crowd door an obstacle door became, -1 for none. */
  doorOf(id: string): number
  /** Stops following the source (the grid keeps what it has). */
  dispose(): void
}

type CellRange = readonly [gx0: number, gz0: number, gx1: number, gz1: number]

/** The cells a rectangle touches, as `NavGrid.fillRect` writes them (end exclusive). */
const rangeOf = (grid: NavGrid, rect: NavObstacleBox['rect']): CellRange => [
  Math.max(0, Math.floor((rect[0] + grid.half) / grid.cell)),
  Math.max(0, Math.floor((rect[1] + grid.half) / grid.cell)),
  Math.min(grid.n, Math.ceil((rect[2] + grid.half) / grid.cell)),
  Math.min(grid.n, Math.ceil((rect[3] + grid.half) / grid.cell)),
]

const covers = (range: CellRange, gx: number, gz: number): boolean => gx >= range[0] && gx < range[2] && gz >= range[1] && gz < range[3]

/**
 * Writes the obstacles an SDK publishes (`NavObstacleSource` of `game-contracts`: the houses' walls, lot walls, fences, doors and gates) into the crowd's grid and doors,
 * and keeps them there: a solid is a wall (or a low wall, when only a stub of it stands), a door a crowd door that agents push against and hit until it breaks
 * (then the source is told, and shows it open); a door the source opens or closes, and a wall a blast cuts, change the cells at the next `sync`.
 * Only the cells of what changed are written again, from what was under them before the binding and every solid still standing there.
 */
export function bindNavObstacles(target: { readonly grid: NavGrid; readonly doors: Doors }, source: NavObstacleSource, options: NavObstacleBindingOptions = {}): NavObstacleBinding {
  const { grid, doors } = target
  const lowMax = options.lowWallMaxHeight ?? LOW_WALL_MAX_HEIGHT
  const solids = new Map<string, readonly NavObstacleBox[]>()
  const doorIndex = new Map<string, number>()
  const doorId: string[] = []
  const baseKind = new Map<number, number>()
  const baseHeight = new Map<number, number>()

  const writeCell = (cell: number, kind: number, height: number): void => {
    if (!baseKind.has(cell)) {
      baseKind.set(cell, grid.occ[cell]!)
      baseHeight.set(cell, grid.occH[cell]!)
    }
    const x = (cell % grid.n) * grid.cell - grid.half
    const z = Math.floor(cell / grid.n) * grid.cell - grid.half
    grid.fillRect(x, z, x + grid.cell, z + grid.cell, kind, height)
  }
  const kindOf = (height: number): number => (height >= lowMax ? CELL.SOLID : CELL.LOW_WALL)

  const stampBox = (box: NavObstacleBox): void => {
    const [gx0, gz0, gx1, gz1] = rangeOf(grid, box.rect)
    for (let gz = gz0; gz < gz1; gz++)
      for (let gx = gx0; gx < gx1; gx++) {
        const cell = gz * grid.n + gx
        if (doors.at(cell) >= 0) continue
        // two boxes on one cell (a wall meets a lot wall): the taller stands
        const height = baseKind.has(cell) ? Math.max(grid.occH[cell]!, box.height) : box.height
        writeCell(cell, kindOf(height), height)
      }
  }

  const addDoor = (obstacle: NavObstacle): void => {
    const box = obstacle.boxes[0]
    if (!box) return
    const [x0, z0, x1, z1] = box.rect
    const alongX = x1 - x0 >= z1 - z0
    const index = doors.add((x0 + x1) / 2, (z0 + z1) / 2, alongX ? 'x' : 'z', alongX ? x1 - x0 : z1 - z0, { obstacle: obstacle.id })
    doorIndex.set(obstacle.id, index)
    doorId[index] = obstacle.id
    for (let board = 0; board < obstacle.boards; board++) doors.plank(index)
    if (obstacle.open) doors.set(index, true)
  }

  /** Writes the cells of `ranges` again: the solids standing on each, the tallest, or what was there before the binding. */
  const restamp = (ranges: readonly CellRange[]): void => {
    if (ranges.length === 0) return
    const bound: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const range of ranges) {
      bound[0] = Math.min(bound[0], range[0])
      bound[1] = Math.min(bound[1], range[1])
      bound[2] = Math.max(bound[2], range[2])
      bound[3] = Math.max(bound[3], range[3])
    }
    const near: Array<{ readonly range: CellRange; readonly height: number }> = []
    for (const boxes of solids.values())
      for (const box of boxes) {
        const range = rangeOf(grid, box.rect)
        if (range[2] > bound[0] && range[0] < bound[2] && range[3] > bound[1] && range[1] < bound[3]) near.push({ range, height: box.height })
      }
    for (const range of ranges)
      for (let gz = range[1]; gz < range[3]; gz++)
        for (let gx = range[0]; gx < range[2]; gx++) {
          const cell = gz * grid.n + gx
          if (doors.at(cell) >= 0) continue
          let height = 0
          for (const box of near) if (covers(box.range, gx, gz)) height = Math.max(height, box.height)
          if (height > 0) writeCell(cell, kindOf(height), height)
          else if (baseKind.has(cell)) writeCell(cell, baseKind.get(cell)!, baseHeight.get(cell)!)
        }
  }

  for (const obstacle of source.obstacles()) {
    if (obstacle.kind !== NAV_OBSTACLE_KIND.SOLID) continue
    solids.set(obstacle.id, obstacle.boxes)
    for (const box of obstacle.boxes) stampBox(box)
  }
  // the doors after the walls: a door's cells are the door's, whatever wall cell the rounding put there
  for (const obstacle of source.obstacles()) if (obstacle.kind === NAV_OBSTACLE_KIND.DOOR) addDoor(obstacle)

  const offBroken = doors.on('broken', (event) => {
    const id = doorId[event.door]
    if (id !== undefined) source.breakDoor(id)
  })

  return {
    sync() {
      const changed = source.changes()
      if (changed.length === 0) return
      const ranges: CellRange[] = []
      for (const obstacle of changed) {
        if (obstacle.kind === NAV_OBSTACLE_KIND.DOOR) {
          const index = doorIndex.get(obstacle.id)
          if (index === undefined) addDoor(obstacle)
          else doors.set(index, obstacle.open)
          continue
        }
        for (const box of solids.get(obstacle.id) ?? []) ranges.push(rangeOf(grid, box.rect))
        for (const box of obstacle.boxes) ranges.push(rangeOf(grid, box.rect))
        solids.set(obstacle.id, obstacle.boxes)
      }
      restamp(ranges)
    },
    doorOf: (id) => doorIndex.get(id) ?? -1,
    dispose: offBroken,
  }
}
