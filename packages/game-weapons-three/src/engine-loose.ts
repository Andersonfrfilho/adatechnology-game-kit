import type * as THREE_NS from 'three'
import type { BodyDesc, BodyId, Material, Quat, Rolling, SeamWorld, ShapeDesc } from '@adatechnology/game-physics'

/** Rolling resistance of the kit's round loose pieces (a casing) on a hard floor: the C_rr the gate-0 B2 run settled on. */
export const LOOSE_ROLLING_RESISTANCE = 0.015
/** Share of a solid brass cylinder a spent case weighs (the case is hollow: a 9 mm one is about 3 g). */
const CASING_FILL = 0.25
const BRASS_DENSITY = 8500
/** The solver's tags of the loose bodies (`BodyDesc.user`): a casing is not a piece of the destruction world. */
const LOOSE_USER = { casing: 100 } as const
/** A body that falls faster than this (m/s) and then goes up is a bounce. */
const BOUNCE_FALL_SPEED = 0.5
const BOUNCE_RISE_SPEED = 0.2
const QUARTER_TURN_Z: Quat = [0, 0, Math.SQRT1_2, Math.SQRT1_2]
const CASING_MATERIAL: Material = { frictionStatic: 0.4, frictionDynamic: 0.3, restitution: 0.4 }

/** What the engine needs to make a loose body from what the gallery drew. */
export interface LooseCollider {
  readonly shape: ShapeDesc
  readonly mass: number
  readonly material: Material
  readonly rolling: Rolling
  readonly user: number
}

/** A casing lying along x as `buildCasing` draws it (the engine's cylinder stands on y, so its child is turned a quarter about z), rolling on its own radius. */
export function casingCollider(radius: number, length: number): LooseCollider {
  return {
    shape: { kind: 'compound', children: [{ shape: { kind: 'cylinder', halfHeight: length / 2, radius }, position: [0, 0, 0], rotation: QUARTER_TURN_Z }] },
    mass: Math.PI * radius * radius * length * BRASS_DENSITY * CASING_FILL,
    material: CASING_MATERIAL,
    rolling: { coefficient: LOOSE_ROLLING_RESISTANCE, radius },
    user: LOOSE_USER.casing,
  }
}

/** A loose body in the engine: what the costura keeps between frames. */
export interface LooseBody {
  readonly id: BodyId
  bounces: number
  fallSpeed: number
}

export interface LooseLaunch {
  readonly position: THREE_NS.Vector3
  readonly rotation: THREE_NS.Quaternion
  readonly velocity: THREE_NS.Vector3
  readonly spin: THREE_NS.Vector3
}

/** Puts a loose piece in the world, swept (it is small and fast) and with the rolling resistance of its collider. */
export function spawnLoose(world: SeamWorld, collider: LooseCollider, launch: LooseLaunch): LooseBody {
  const desc: BodyDesc = {
    shape: collider.shape,
    motion: 'dynamic',
    mass: collider.mass,
    position: [launch.position.x, launch.position.y, launch.position.z],
    rotation: [launch.rotation.x, launch.rotation.y, launch.rotation.z, launch.rotation.w],
    material: collider.material,
    layer: 'debris',
    continuous: true,
    rolling: collider.rolling,
    linearVelocity: [launch.velocity.x, launch.velocity.y, launch.velocity.z],
    angularVelocity: [launch.spin.x, launch.spin.y, launch.spin.z],
    user: collider.user,
  }
  return { id: world.createBody(desc), bounces: 0, fallSpeed: 0 }
}

/** What a frame of a loose body told: it is asleep, and the speed of a bounce it made (m/s, vertical) or undefined. */
export interface LooseReading {
  readonly asleep: boolean
  readonly bounceSpeed: number | undefined
}

/** The one reading `syncLoose` hands back, rewritten by each call: read it before the next body is synced. */
const scratchReading = { asleep: false, bounceSpeed: undefined as number | undefined }

const pose = new Float64Array(7)
const velocity = new Float64Array(6)

/** Copies the engine's pose of a loose body onto its object and reports whether it bounced or fell asleep. */
export function syncLoose(world: SeamWorld, body: LooseBody, object: THREE_NS.Object3D): LooseReading {
  world.readPose(body.id, pose, 0)
  world.readVelocity(body.id, velocity, 0)
  object.position.set(pose[0] ?? 0, pose[1] ?? 0, pose[2] ?? 0)
  object.quaternion.set(pose[3] ?? 0, pose[4] ?? 0, pose[5] ?? 0, pose[6] ?? 1)
  const vertical = velocity[1] ?? 0
  const bounced = body.fallSpeed > BOUNCE_FALL_SPEED && vertical > BOUNCE_RISE_SPEED
  scratchReading.bounceSpeed = bounced ? body.fallSpeed : undefined
  body.fallSpeed = vertical < 0 ? -vertical : 0
  if (bounced) body.bounces++
  scratchReading.asleep = world.isSleeping(body.id)
  return scratchReading
}

export function dropLoose(world: SeamWorld, body: LooseBody): void {
  world.removeBody(body.id)
}
