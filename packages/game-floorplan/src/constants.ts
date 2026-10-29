/** Structural wall thickness in metres. */
export const WALL_THICKNESS = 0.15
/** Half a wall: the gap between a room rectangle and its usable interior. */
export const MARGIN = WALL_THICKNESS / 2
export const EPS = 1e-6
export const TOL = 1e-3
/** Clear zone in front of doors and gates, in metres. */
export const DOOR_CLEARANCE = 0.9
/** Radius of the player body: a disc this wide must still pass between doors and rooms once the furniture is placed. */
export const PLAYER_RADIUS = 0.24
/** Clear wall from the edge of a door opening to a corner or a junction (measured from the wall axis). */
export const DOOR_EDGE_CLEARANCE = 0.12
/** Clear wall from a window to a corner, a junction or a door. */
export const WINDOW_EDGE_CLEARANCE = 0.3
/** Top of the wall cabinet (it hangs between 1.55 and 2.15 m). */
export const OVERHEAD_TOP = 2.15
/** Room types that may stay without a window. */
export const WINDOWLESS_ROOM_TYPES: ReadonlySet<string> = new Set([
  'stockroom', 'kitchen', 'laundry', 'bathroom', 'void', 'elevator', 'stairs', 'pantry', 'closet', 'corridor', 'hall', 'balcony', 'terrace', 'garage', 'storage', 'porch', 'tent', 'outhouse',
])
/** Default clearances of a parked car, in metres (driver side is the left of whoever looks along the front). */
export const CAR_CLEARANCE = { driver: 0.8, side: 0.6, end: 0.6 } as const
