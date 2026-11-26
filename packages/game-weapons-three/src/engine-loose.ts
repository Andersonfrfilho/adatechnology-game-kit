import type * as THREE_NS from 'three'
import type { BodyDesc, BodyId, Material, Quat, Rolling, SeamWorld, ShapeDesc, Vec3 } from '@adatechnology/game-physics'

import { M67_PARTS, buildExplosiveModel } from './models/explosives'

/** Rolling resistance of the kit's round loose pieces (a casing, a grenade) on a hard floor: the C_rr the gate-0 B2 run settled on. */
export const LOOSE_ROLLING_RESISTANCE = 0.015
/** Share of a solid brass cylinder a spent case weighs (the case is hollow: a 9 mm one is about 3 g). */
const CASING_FILL = 0.25
const BRASS_DENSITY = 8500
const GRENADE_MASS_KG = 0.4
/** The fuze and the spoon stick out of the body, so it is not a smooth ball: it sheds spin (1/s) as the soft surfaces of `friction.ts` do. Measured (T4.3): 0 -> 11 of 18 throws rest after 5 s on the kit's floor; 1 -> none, the last at 4.83 s. */
const GRENADE_ROLLING_DAMPING = 1
/** The solver's tags of the loose bodies (`BodyDesc.user`): a casing and a grenade are not a piece of the destruction world. */
const LOOSE_USER = { casing: 100, grenade: 2 } as const
/** A body that falls faster than this (m/s) and then goes up is a bounce. */
const BOUNCE_FALL_SPEED = 0.5
const BOUNCE_RISE_SPEED = 0.2
const QUARTER_TURN_Z: Quat = [0, 0, Math.SQRT1_2, Math.SQRT1_2]
const CASING_MATERIAL: Material = { frictionStatic: 0.4, frictionDynamic: 0.3, restitution: 0.4 }
const GRENADE_MATERIAL: Material = { frictionStatic: 0.6, frictionDynamic: 0.5, restitution: 0.35 }

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

/**
 * The M67 as `projectileModel` draws it (body, fuze, spoon; centred on the middle of the model), with the rolling resistance of a round piece, so a thrown one
 * bounces to rest as the arsenal's does. Undefined for an explosive the engine has no collider of.
 */
export function explosiveCollider(THREE: typeof THREE_NS, explosive: string): LooseCollider | undefined {
  if (explosive !== 'm67') return undefined
  const model = buildExplosiveModel(THREE, explosive)
  if (!model) return undefined
  const centre = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3())
  const { bodyRadius, fuze, spoon } = M67_PARTS
  const at = (x: number, y: number): Vec3 => [x - centre.x, y + bodyRadius - centre.y, 0 - centre.z]
  return {
    shape: {
      kind: 'compound',
      children: [
        { shape: { kind: 'sphere', radius: bodyRadius }, position: at(0, 0) },
        { shape: { kind: 'cylinder', halfHeight: fuze.height / 2, radius: fuze.radius }, position: at(0, fuze.y) },
        { shape: { kind: 'box', half: [spoon.size[0] / 2, spoon.size[1] / 2, spoon.size[2] / 2] }, position: at(spoon.x, spoon.y), rotation: [0, 0, Math.sin(spoon.tilt / 2), Math.cos(spoon.tilt / 2)] },
      ],
    },
    mass: GRENADE_MASS_KG,
    material: GRENADE_MATERIAL,
    rolling: { coefficient: LOOSE_ROLLING_RESISTANCE, radius: bodyRadius, damping: GRENADE_ROLLING_DAMPING },
    user: LOOSE_USER.grenade,
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
