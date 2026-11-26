import type { BodyId, Quat, RayHit, SeamWorld, Vec3 } from './contract'

export interface HoldOptions {
  /**
   * The radius (m) of the sphere swept to the hand: the body's smallest half-size, not its bounding sphere (a box lying on the floor has its centre lower than its
   * bounding radius, and would count as stuck in the floor).
   */
  readonly radius: number
  /** How far short of a fixed body the held one stops (m). Default 0.01. */
  readonly skin?: number
}

/** A body in a hand: kinematic and following the hand pose, stopped by what does not move, until it is let go. */
export interface Hold {
  readonly body: BodyId
  /** Whether it is still in the hand (false after `release`). */
  readonly held: boolean
  /**
   * Brings it toward the hand's pose for one fixed step `h` (a `beforeStep` of the loop's `actors` phase). The path from where it is to the pose is swept
   * against the fixed bodies: it stops short of the first (a wall between the body and the hand), and the hand's pose inside a wall is not reached.
   * Returns true when the hand's pose was reached, false when something fixed was in the way.
   */
  moveTo(position: Vec3, rotation: Quat, h: number): boolean
  /** Lets go: dynamic again with its own mass, swept so a throw does not go through a thin wall. `linear` zero is a drop. */
  release(linear: Vec3, angular?: Vec3): void
}

const DEFAULT_SKIN = 0.01
const NO_SPIN: Vec3 = [0, 0, 0]
const FIXED_ONLY = { layers: ['static'] } as const
const REACHED_BELOW = 1e-6

/** Picks a body up: dynamic to kinematic. The body must be dynamic when this is called. */
export const grabBody = (world: SeamWorld, body: BodyId, options: HoldOptions): Hold => {
  const skin = options.skin ?? DEFAULT_SKIN
  const sweepRadius = Math.max(options.radius - skin, 0.001)
  const here = new Float64Array(7)
  const hits: RayHit[] = []
  let held = true
  world.setVelocity(body, NO_SPIN, NO_SPIN)
  world.setMotion(body, 'kinematic')
  return {
    body,
    get held() {
      return held
    },
    moveTo(position, rotation, h) {
      if (!held) return false
      world.readPose(body, here, 0)
      const dx = position[0] - here[0]
      const dy = position[1] - here[1]
      const dz = position[2] - here[2]
      const length = Math.hypot(dx, dy, dz)
      let reached = true
      let along = length
      // the cast is `skin` longer than the way, so a hand that stops exactly at a wall's face still leaves the gap
      if (length > REACHED_BELOW && world.sphereCastAll([here[0], here[1], here[2]], [dx / length, dy / length, dz / length], length + skin, sweepRadius, hits, FIXED_ONLY) > 0) {
        const room = (hits[0]?.distance ?? length + skin) - skin
        if (room < length) {
          along = Math.max(0, room)
          reached = false
        }
      }
      const k = length > REACHED_BELOW ? along / length : 0
      world.moveKinematic(body, [here[0] + dx * k, here[1] + dy * k, here[2] + dz * k], rotation, h)
      return reached
    },
    release(linear, angular = NO_SPIN) {
      if (!held) return
      held = false
      world.setMotion(body, 'dynamic')
      world.setContinuous(body, true)
      world.setVelocity(body, linear, angular)
    },
  }
}
