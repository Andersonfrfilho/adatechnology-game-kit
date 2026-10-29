import { blastShove } from '@adatechnology/game-contracts'
import type { BlastShoveOptions, BlastSource, Vec3 } from '@adatechnology/game-contracts'

/** From this speed (m/s) a blast takes a standing body off its feet. Below it the body is only pushed. */
export const KNOCK_DOWN_SPEED = 2.5
/** The angle of a body lying where it fell (the same tilt a dead body takes). */
export const KNOCKED_DOWN_ANGLE = 1.35
/** Seconds the body lies after it lands: this plus the landing speed times `STAND_UP_PER_SPEED`. */
const LIE_SECONDS = 1.6
const STAND_UP_PER_SPEED = 0.25
const FALL_SECONDS = 0.25
const RISE_SECONDS = 0.6
/** m/s squared that slows a body sliding on the ground. */
const GROUND_FRICTION = 7
const GRAVITY = 9.81
/** Height of the chest above the feet: where the blast takes the body. */
const CHEST = 1.1

/** What a blast is doing to one body: its velocity (m/s), whether it is in the air, and how far down it is (0 on its feet, 1 lying). */
export interface Knock {
  velocity: [number, number, number]
  airborne: boolean
  /** 0..1 */
  lying: number
  /** Seconds left to lie on the ground after it stopped. */
  lieLeft: number
  /** Knocked off its feet by this blast. */
  down: boolean
}

/** The mass of a body in kg from its height (m) and its build (1 = average): 70 kg at 1.75 m. */
export const bodyMass = (height: number, build = 1): number => 70 * (height / 1.75) ** 2 * build

/**
 * What a blast does to a body standing at `feet`: the shove of `game-contracts` taken at the chest, a hop when it goes up, and a fall when it is strong enough. Undefined when the blast does not
 * reach it. The numbers are the host's (`ModuleHost.blastShove`), the same ones that throw its loose items.
 */
export function knockOf(blast: BlastSource, feet: Vec3, mass: number, options?: BlastShoveOptions): Knock | undefined {
  const hit = blastShove(blast, { position: [feet[0], feet[1] + CHEST, feet[2]], mass }, options)
  if (!hit) return undefined
  const [dx, dy, dz] = hit.direction
  return { velocity: [dx * hit.speed, Math.max(0, dy * hit.speed), dz * hit.speed], airborne: dy > 0, lying: 0, lieLeft: 0, down: hit.speed >= KNOCK_DOWN_SPEED }
}

/**
 * Moves a body one step: it slides on the ground and slows, falls when it was knocked down, lies a while and gets up (a dead body stays down). Moves `position` in place; returns true when the
 * body is on its feet and still, and the knock can be dropped.
 */
export function stepKnock(knock: Knock, position: { x: number; y: number; z: number }, dt: number, groundAt: (x: number, z: number) => number, alive: boolean): boolean {
  const v = knock.velocity
  position.x += v[0] * dt
  position.z += v[2] * dt
  const ground = groundAt(position.x, position.z)
  if (knock.airborne || position.y > ground + 1e-4) {
    v[1] -= GRAVITY * dt
    position.y += v[1] * dt
    if (position.y <= ground) {
      position.y = ground
      v[1] = 0
      knock.airborne = false
    }
  } else position.y = ground
  const horizontal = Math.hypot(v[0], v[2])
  if (!knock.airborne && horizontal > 0) {
    const slowed = Math.max(0, horizontal - GROUND_FRICTION * dt)
    v[0] *= slowed / horizontal
    v[2] *= slowed / horizontal
  }
  const moving = horizontal > 0.05 || knock.airborne
  if (knock.down) {
    if (moving) knock.lying = Math.min(1, knock.lying + dt / FALL_SECONDS)
    else {
      knock.lying = 1
      if (alive) {
        knock.lieLeft = knock.lieLeft > 0 ? knock.lieLeft : LIE_SECONDS + Math.hypot(v[0], v[2]) * STAND_UP_PER_SPEED
        knock.lieLeft -= dt
        if (knock.lieLeft <= 0) knock.down = false
      }
    }
  } else if (knock.lying > 0) knock.lying = Math.max(0, knock.lying - dt / RISE_SECONDS)
  return !moving && !knock.down && knock.lying === 0
}
