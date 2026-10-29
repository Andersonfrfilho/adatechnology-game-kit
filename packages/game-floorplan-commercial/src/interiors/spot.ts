export type RoomSize = { w: number; d: number }

const WALL_MARGIN = 0.075

/** Centre-slot fractions that put the centre of an item `u` metres along and `v` metres deep from the room corner (the slot fill insets the room by half a wall). */
export function spot(room: RoomSize, u: number, v: number): { fx: number; fz: number } {
  return { fx: (u - WALL_MARGIN) / (room.w - 2 * WALL_MARGIN), fz: (v - WALL_MARGIN) / (room.d - 2 * WALL_MARGIN) }
}

/** Wall-slot `pos` (0 to 1 along the free stretch) that puts an item of `width` with its centre `centre` metres from the room corner. */
export function along(length: number, width: number, centre: number): number {
  return (centre - WALL_MARGIN - width / 2) / (length - 2 * WALL_MARGIN - width)
}
