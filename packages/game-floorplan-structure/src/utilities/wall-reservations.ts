import type { ResultItem } from '@adatechnology/game-floorplan'
import type { WallPoint } from './wall-points'

/** A box on a wall: plan rect `[u0, v0, u1, v1]` and its height `y0`..`y1` over the storey's floor. */
export interface WallBox {
  readonly rect: readonly [number, number, number, number]
  readonly y0: number
  readonly y1: number
}

/** A point on a wall's face and the way it faces (a socket, a switch, the panel). */
export interface WallSpot {
  readonly u: number
  readonly v: number
  readonly axis: 'u' | 'v'
  readonly frontU: number
  readonly frontV: number
}

/** A candidate point of `wallPointsOf` as a spot facing out of its wall. */
export const spotOf = (point: WallPoint): WallSpot => ({ u: point.u, v: point.v, axis: point.axis, frontU: point.nu, frontV: point.nv })

/**
 * What the distribution panel takes on its wall, metres: the box as both drawings make it (the kit's `electrical_panel` 0.36 x 0.52 standing on `y`,
 * the plain drawing 0.4 tall centred on `y`) and the sweep of its hinged door, which opens past 90 degrees: `doorReach` out of the box's front and
 * `doorSide` past either side (the hinge side depends on how the wall faces).
 */
export const PANEL_ENVELOPE = { halfWidth: 0.18, below: 0.2, above: 0.52, depth: 0.12, doorReach: 0.36, doorSide: 0.3 } as const

/** Plate of a socket or a switch (`WALL_PLATE` of `game-interactables-household`): 7.5 x 12 cm, 1.5 cm off the wall's face at most. */
export const WALL_PLATE_BOX = { halfWidth: 0.0375, halfHeight: 0.06, depth: 0.015 } as const

/** Gap kept between two things on a wall. */
export const WALL_MOUNT_GAP = 0.02

/** How far a fixture's point (`wallPointsOf`) stands in front of the wall's face. */
const POINT_OFF_FACE = 0.012

/** The box `along` either side of a spot, from its wall's face to `out` in front of it, `y0` to `y1` high. */
export function boxOffWall(spot: WallSpot, along: number, y0: number, y1: number, out: number): WallBox {
  if (spot.axis === 'u') {
    const face = spot.v - spot.frontV * POINT_OFF_FACE
    const front = face + spot.frontV * out
    return { rect: [spot.u - along, Math.min(face, front), spot.u + along, Math.max(face, front)], y0, y1 }
  }
  const face = spot.u - spot.frontU * POINT_OFF_FACE
  const front = face + spot.frontU * out
  return { rect: [Math.min(face, front), spot.v - along, Math.max(face, front), spot.v + along], y0, y1 }
}

/** The plate of a socket or a switch centred `y` high at `spot`. */
export const plateBox = (spot: WallSpot, y: number): WallBox => boxOffWall(spot, WALL_PLATE_BOX.halfWidth, y - WALL_PLATE_BOX.halfHeight, y + WALL_PLATE_BOX.halfHeight, WALL_PLATE_BOX.depth)

/** The panel at `spot`, `y` high, with the sweep of its open door. */
export const panelBox = (spot: WallSpot, y: number): WallBox =>
  boxOffWall(spot, PANEL_ENVELOPE.halfWidth + PANEL_ENVELOPE.doorSide, y - PANEL_ENVELOPE.below, y + PANEL_ENVELOPE.above, PANEL_ENVELOPE.depth + PANEL_ENVELOPE.doorReach)

/** The boxes of the items hung on the walls and at the windows of a storey (pictures, mirrors, split air conditioners, curtains, blinds). */
export const wallItemBoxesOf = (items: readonly ResultItem[], floor: number): WallBox[] =>
  items.filter((m) => m.floor === floor && !m.outdoor && (m.mount === 'wall' || m.mount === 'window') && m.aabb).map((m) => ({ rect: m.aabb as WallBox['rect'], y0: m.y ?? 0, y1: (m.y ?? 0) + m.h }))

/** The two boxes come closer than the gap a wall keeps between its things. */
export const clashes = (a: WallBox, b: WallBox): boolean => {
  const g = WALL_MOUNT_GAP
  return a.rect[0] < b.rect[2] + g && a.rect[2] > b.rect[0] - g && a.rect[1] < b.rect[3] + g && a.rect[3] > b.rect[1] - g && a.y0 < b.y1 + g && a.y1 > b.y0 - g
}
