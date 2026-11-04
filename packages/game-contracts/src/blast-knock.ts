import { blastBodySpeed, DEFAULT_BLAST_IMPULSE } from './blast-impulse'
import type { BlastImpulseOptions } from './blast-impulse'
import type { BlastShoveOptions, BlastSource } from './blast-shove'
import type { Vec3 } from './destruction'

/** From this speed (m/s) a blast takes a standing body off its feet. Below it the body is only pushed. */
export const KNOCK_DOWN_SPEED = 2.5
/** The angle of a body lying where it fell (the same tilt a dead body takes). */
export const KNOCKED_DOWN_ANGLE = 1.35
/** Seconds the body lies after it lands: this plus the landing speed times `STAND_UP_PER_SPEED`. */
const LIE_SECONDS = 1.6
/** Seconds a body floored by its wounds (inside the lethal radius) lies before it gets up, when it is not dead. */
const WOUNDED_LIE_SECONDS = 6
/** The share of the blast that has to get through for its fragments to reach a body: behind cover that stops half of it the fragments stop too. */
export const FRAGMENT_COVER = 0.5
/** Seconds a body is stunned at the edge of the lethal radius (the ringing ears, the dizziness); it falls with the square of the way to the edge of the blast. */
const STUN_SECONDS = 4
const STAND_UP_PER_SPEED = 0.25
const FALL_SECONDS = 0.25
const RISE_SECONDS = 0.6
/** m/s squared that slows a body sliding on the ground. */
const GROUND_FRICTION = 7
const GRAVITY = 9.81
/** Height of the chest above the feet: where the blast takes the body. */
export const KNOCK_CHEST = 1.1
const CHEST = KNOCK_CHEST

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
  /** Floored by its wounds: inside the lethal radius and not behind cover. It lies longer and falls where it stood. */
  wounded?: boolean
  /** Seconds of stun the blast gave the body: dizziness and ringing ears. */
  stunSeconds?: number
  /** The horizontal unit direction away from the blast, even when the push is too weak to move the body: the way it falls. */
  away?: Vec3
}

/** The mass of a body in kg from its height (m) and its build (1 = average): 70 kg at 1.75 m. */
export const bodyMass = (height: number, build = 1): number => 70 * (height / 1.75) ** 2 * build

/**
 * What a blast does to a body standing at `feet`, of `mass` kg. Undefined when the blast does not reach it or does nothing to it.
 *
 * The body is pushed by the blast wave (`blastBodySpeed`, from the charge `blast.tnt`, or from `energy` by `tntPerJoule`), taken at the chest and cut by `reach`, the share that got through
 * cover. It is floored when that push is `KNOCK_DOWN_SPEED` or more, or when it stands inside `lethalRadius` with the blast reaching it (the fragments and the overpressure fell it where it
 * stands). It is stunned for a while inside the radius. `options` are the shove numbers of the host's loose items; only their `minSpeed` applies to a body.
 */
export function knockOf(blast: BlastSource, feet: Vec3, mass: number, options?: BlastShoveOptions, impulse: BlastImpulseOptions = {}): Knock | undefined {
  const o = { ...DEFAULT_BLAST_IMPULSE, ...impulse }
  const chest: Vec3 = [feet[0], feet[1] + CHEST, feet[2]]
  const dx = chest[0] - blast.point[0]
  const dy = chest[1] - blast.point[1]
  const dz = chest[2] - blast.point[2]
  const distance = Math.hypot(dx, dy, dz)
  if (!(blast.radius > 0) || distance > blast.radius) return undefined
  const reach = Math.max(0, Math.min(1, blast.reach ?? 1))
  const tnt = blast.tnt ?? blast.energy * o.tntPerJoule
  let speed = blastBodySpeed(tnt, distance, mass, reach, o)
  const minSpeed = impulse.minSpeed ?? options?.minSpeed ?? o.minSpeed
  if (speed < minSpeed) speed = 0
  const struck = reach >= FRAGMENT_COVER
  const wounded = struck && blast.lethalRadius !== undefined && distance <= blast.lethalRadius
  const edge = 1 - distance / blast.radius
  const stunSeconds = struck ? STUN_SECONDS * edge * edge * reach : 0
  if (speed === 0 && !wounded && stunSeconds < 0.25) return undefined
  // straight above or below the centre there is no "away": the push goes up
  const horizontal = Math.hypot(dx, dz)
  const away: Vec3 = horizontal > 1e-4 ? [dx / horizontal, o.lift, dz / horizontal] : [0, 1, 0]
  const length = Math.hypot(away[0], away[1], away[2])
  const velocity: [number, number, number] = [(away[0] / length) * speed, (away[1] / length) * speed, (away[2] / length) * speed]
  return {
    velocity,
    airborne: velocity[1] > 0.5,
    lying: 0,
    lieLeft: wounded ? WOUNDED_LIE_SECONDS : 0,
    away: horizontal > 1e-4 ? [dx / horizontal, 0, dz / horizontal] : [0, 0, 0],
    down: speed >= KNOCK_DOWN_SPEED || wounded,
    ...(wounded ? { wounded } : {}),
    ...(stunSeconds >= 0.25 ? { stunSeconds } : {}),
  }
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
    // a body floored where it stands (its wounds, not the push) still takes the time of a fall to reach the ground
    if (moving || knock.lying < 1) knock.lying = Math.min(1, knock.lying + dt / FALL_SECONDS)
    else if (alive) {
      knock.lieLeft = knock.lieLeft > 0 ? knock.lieLeft : LIE_SECONDS + Math.hypot(v[0], v[2]) * STAND_UP_PER_SPEED
      knock.lieLeft -= dt
      if (knock.lieLeft <= 0) knock.down = false
    }
  } else if (knock.lying > 0) knock.lying = Math.max(0, knock.lying - dt / RISE_SECONDS)
  return !moving && !knock.down && knock.lying === 0
}

/** Where `launchBody` leaves the throw on the body's root until the module that animates it takes it. */
const LAUNCHED = 'launched'

/**
 * Throws a body at `velocity` (m/s, world): an occupant leaving a car through the glass, a pedestrian run over. The module that animates the body
 * takes it on its next frame (`takeLaunch`) and moves it as it moves a body a blast knocked down: flying, landing, sliding, lying, getting up.
 */
export function launchBody(root: { userData: Record<string, unknown> }, velocity: Vec3): void {
  root.userData[LAUNCHED] = [velocity[0], velocity[1], velocity[2]]
}

/** The throw `launchBody` left on the root, as a knock (knocked down, in the air), once; undefined when nothing threw it. */
export function takeLaunch(root: { userData: Record<string, unknown> }): Knock | undefined {
  const velocity = root.userData[LAUNCHED] as Vec3 | undefined
  if (!velocity) return undefined
  delete root.userData[LAUNCHED]
  return { velocity: [velocity[0], velocity[1], velocity[2]], airborne: true, lying: 0, lieLeft: 0, down: true }
}
