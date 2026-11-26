import type { PartSpec, SoftSpec, Transform, Vec3 } from './types'

/** A movable part (door, drawer, lid) moved by a physics engine instead of by `t` stepping at `Motion.speed`. */
export interface PartDriver {
  /** Starts going to `target` (t, 0..1) at the part's speed, from wherever the part is (the world calls it when the target changed). */
  aim(target: number): void
  /** Puts the part at `t` at once (a load, an instant set), at rest. */
  snap(t: number): void
  /** Called every `World.update(dt)` before `read`. */
  update(dt: number): void
  /** Where the part is now, as t. */
  read(): number
  /** The part has reached its target (or was let go) and is free: a push moves it, a joint holds it. */
  readonly settled: boolean
  /** The joint broke (an impact over its limit): the part is a loose body now and `read` stays where it was. */
  readonly broken: boolean
  dispose(): void
}

/** A soft volume (curtain, strip, cloth) swung by a physics engine instead of the spring of the world. */
export interface SoftDriver {
  /** Rotation around the anchor line now, radians, as `World.sway` reports it: x (front/back) and z (sideways). */
  swing(out: [number, number]): void
  /** An actor pushes through it with this velocity, object-local. */
  push(velocity: Vec3): void
  dispose(): void
}

/**
 * The world's port to a physics engine (`WorldOptions.partPhysics`), duck-typed so this package does not depend on one: `createEnginePartPhysics`
 * implements it over `@adatechnology/game-physics`. An `attach` that returns undefined leaves that part or soft volume to the world, as without an engine.
 */
export interface PartPhysics {
  attachPart(object: string, part: PartSpec, transform: Transform): PartDriver | undefined
  attachSoft?(object: string, soft: SoftSpec, transform: Transform): SoftDriver | undefined
}
