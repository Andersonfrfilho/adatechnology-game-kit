import type { Knock } from '@adatechnology/game-contracts'
import type { Vec3 } from '@adatechnology/game-destruction'
import type { BodyId } from '@adatechnology/game-physics'

/** Horizontal radius of the player, metres: what the colliders and a trip wire see. */
export const PLAYER_RADIUS = 0.3
/** Share of the radius the feet stand on: at the edge of a heap the player steps down instead of hovering on its corner. */
export const FOOT = 0.5

/** Slower than this (m/s) a thrown body meeting something only stops: no slam. */
export const SLAM_MIN_SPEED = 1.5

/** Below this fall speed (m/s) a touch of the floor is a step down, not a landing. */
export const LANDING_MIN_SPEED = 1

/** What the body's motion needs from the room: the places to stay out of, the ground, and what to tell when the feet hit something. */
export interface LocomotionContext {
  readonly colliders: Array<[number, number, number, number]>
  readonly blockers?: ReadonlySet<(x: number, z: number, radius: number) => boolean>
  readonly footing?: (x: number, z: number, radius: number, feet: number, bodiless?: boolean) => { floor: number; blocked: boolean }
  readonly limit: number
  readonly floorAt?: (x: number, z: number) => number
  readonly speedAt?: (x: number, z: number) => number
  readonly onSlam?: (event: LocomotionSlam) => void
  readonly onFeet?: (event: LocomotionFeet) => void
}

export type LocomotionSlam = { readonly against: 'obstacle' | 'ground'; readonly speed: number; readonly direction: Vec3 }
export type LocomotionFeet = { readonly type: 'jump' } | { readonly type: 'land'; readonly speed: number }

/** What the keys ask of one step on foot or in flight. */
export interface LocomotionInput {
  readonly walkX: number
  readonly walkZ: number
  /** Metres per second asked along `walk`, before the ground's own factor (flying: the whole speed). */
  readonly speed: number
  readonly running: boolean
  readonly jump: boolean
  readonly walkHeld: boolean
  readonly crouched: boolean
  /** Flying only: up (1), down (-1) or still (0). */
  readonly rise: number
}

/**
 * The point where the player's body moves: `own` (the room's colliders, footing and its own jump) or `engine` (a walker in the physics world). The view, the
 * keys and the knock's timeline stay in the player; this decides where the feet are.
 */
export interface Locomotion {
  readonly x: number
  readonly z: number
  /** Where the view stands: x and z of the feet as drawn (the same as `x`, `z` when nothing is interpolated). */
  readonly drawnX: number
  readonly drawnZ: number
  /** The feet's height: a jump lifts it. */
  readonly feet: number
  /** The feet as the body is drawn: after a step up they climb it over a few frames. */
  readonly drawnFeet: number
  readonly speed: number
  readonly running: boolean
  readonly grounded: boolean
  readonly flying: boolean
  readonly seated: boolean
  /** The body cannot stand up here (a low beam above a crouch): the player stays crouched. */
  readonly mustCrouch: boolean
  toggleFly(): boolean
  setFly(enabled: boolean): void
  /** Seated, the body stays where the pose put it: it does not fall and takes nothing from the floor. */
  setSeated(seated: boolean): void
  canStand(x: number, z: number): boolean
  moveBy(dx: number, dz: number): void
  takeWish(): [number, number]
  /** Puts the feet at `position` (x, z; the floor is under them) with no speed; returns the floor level there. */
  place(position: Vec3): number
  /** A module (a vehicle, an aircraft) holds the player and places it itself: the body leaves the world while it lasts. */
  hold(held: boolean): void
  /** The blast's throw joins the body: `knock` is the whole of the knock now, `added` the velocity this blast gave. */
  knocked(knock: Knock, added: readonly [number, number, number]): void
  /** One step of a knock: moves the body, tells the slam or the landing. True when the knock can be dropped. */
  stepKnock(knock: Knock, dt: number): boolean
  /** One step on foot or flying. */
  update(dt: number, input: LocomotionInput): void
  /** The feet at the display moment, `alpha` of the way between two fixed steps (engine only). */
  present?(alpha: number): void
  /** The body the world sees of the player (engine only): what a thrown piece or a casing must not hit on leaving the hand. */
  shadowBody?(): BodyId | undefined
  dispose(): void
}

export type FootingKind = 'all' | 'bodiless' | 'none'

export interface BlockedTest {
  readonly outside: (x: number, z: number) => boolean
  /**
   * Whether a body of `radius` cannot stand at (x, z): the arena's edge, the colliders, the blockers and, by `footing`, what is taller than the feet can step on: `all` of it,
   * only what the physics world has no body for (`bodiless`), or `none`.
   */
  readonly blocked: (x: number, z: number, radius: number, feet: number, footing: FootingKind) => boolean
}

export const createBlockedTest = (o: LocomotionContext): BlockedTest => {
  const outside = (x: number, z: number): boolean => Math.abs(x) > o.limit - PLAYER_RADIUS || Math.abs(z) > o.limit - PLAYER_RADIUS
  const blocked = (x: number, z: number, radius: number, feet: number, footing: FootingKind): boolean => {
    if (outside(x, z)) return true
    for (const c of o.colliders) if (x > c[0] - radius && x < c[2] + radius && z > c[1] - radius && z < c[3] + radius) return true
    if (o.blockers) for (const isBlocked of o.blockers) if (isBlocked(x, z, radius)) return true
    if (footing === 'none' || !o.footing) return false
    return footing === 'bodiless' ? o.footing(x, z, radius, feet, true).blocked : o.footing(x, z, radius, feet).blocked
  }
  return { outside, blocked }
}
