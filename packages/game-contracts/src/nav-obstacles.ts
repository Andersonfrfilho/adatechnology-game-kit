/** What an obstacle on the ground is to a walker: a solid (a wall, a lot wall, a fence, a board) or a door (a door or a gate, which opens and can be broken). */
export const NAV_OBSTACLE_KIND = { SOLID: 'solid', DOOR: 'door' } as const
export type NavObstacleKind = (typeof NAV_OBSTACLE_KIND)[keyof typeof NAV_OBSTACLE_KIND]

/** A box of an obstacle on the ground: world metres `[x0, z0, x1, z1]` and how high it stands over the ground (a low remnant of a wall can be climbed). */
export type NavObstacleBox = {
  readonly rect: readonly [number, number, number, number]
  readonly height: number
}

/**
 * One thing that stops a walker on the ground, as the SDK that builds it publishes it for a navigation grid (the crowd's): a whole wall is one box, a wall a blast
 * cut stands in the boxes of what is left of it, a wall that is gone has none. A door is one box, passable while `open`.
 */
export type NavObstacle = {
  /** Stable for the life of the source: a change names the same obstacle again. */
  readonly id: string
  readonly kind: NavObstacleKind
  readonly boxes: readonly NavObstacleBox[]
  /** A door or a gate that lets walkers through now (always false for a solid). */
  readonly open: boolean
  /** A door the barricade's boards cover, each making it harder to break (0 for none). */
  readonly boards: number
}

/**
 * The obstacles one or more SDKs put on the ground (the houses' walls, doors, lot walls and gates), for whoever keeps a navigation grid. Pulled once per fixed step, so a
 * grid that follows it changes at the same step on every run.
 */
export type NavObstacleSource = {
  /** Every obstacle as it stands now. */
  obstacles(): readonly NavObstacle[]
  /** The obstacles that changed since the last call (a door opened or closed, a wall cut or gone); empty when none did. */
  changes(): readonly NavObstacle[]
  /** A walker broke the door `id` open (the horde hit it until it gave way): the owner shows it open. */
  breakDoor(id: string): void
}
