import type { FloorNavigator, NavRect } from './floor-navigator.js'

/** The parts of a built house the binding reads: its structure (parts by id), its floors and its destruction adapter. */
export interface DestructibleHouse {
  r: { floors: { index: number; y0: number }[] }
  structure: { byId: Map<string, { role: string; floor: number; aabb: NavRect; y1: number }> }
  destruction: { onEvent(listener: (event: any) => void): () => void; restore?: () => void }
}

export interface NavigatorBinding {
  /** Stops listening. */
  off(): void
  /** Puts the grid back (after a world reset). */
  reset(): void
}

const WALL_ROLES = new Set(['wall', 'partition'])

/**
 * Connects a floor navigator to the destruction of a house, so the people walking in it follow what the world did to it:
 *  - a wall that reaches stage 2 opens the cells inside its opening (a circle on its floor);
 *  - a wall that fractures or collapses opens all the cells of its footprint;
 *  - a slab that supports a floor and fractures or collapses removes the cells of that floor under it (they become blocked).
 * The house has to be registered in the navigator under `houseId` (`navigationDefOf`). Events arrive once the house's destruction is active.
 * Returns the binding; `reset()` undoes the changes.
 */
export function bindNavigator(navigator: FloorNavigator, houseId: string, house: DestructibleHouse): NavigatorBinding {
  const level = (floor: number) => house.r.floors.find((f) => f.index === floor)?.y0
  const gone = (id: string) => {
    const part = house.structure.byId.get(id)
    if (!part) return
    if (WALL_ROLES.has(part.role)) navigator.openCells(houseId, part.floor, { rect: part.aabb })
    else if (part.role === 'slab') {
      const y = level(part.floor)
      // only the slab a floor stands on: its top is the floor level (a roof slab is not a floor)
      if (y !== undefined && Math.abs(part.y1 - y) < 0.1) navigator.closeCells(houseId, part.floor, { rect: part.aabb })
    }
  }
  const off = house.destruction.onEvent((event) => {
    if (event.type === 'stage' && event.stage === 2 && event.opening) {
      const part = house.structure.byId.get(event.part)
      if (part && WALL_ROLES.has(part.role)) navigator.openCells(houseId, part.floor, { circle: [event.opening.center[0], event.opening.center[2], event.opening.radius] })
    } else if (event.type === 'fracture') gone(event.part)
    else if (event.type === 'collapse') for (const id of event.parts) gone(id)
  })
  return { off, reset: () => navigator.undoChanges(houseId) }
}
