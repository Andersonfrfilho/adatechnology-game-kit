import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'
import type { BodyId, SeamWorld } from '@adatechnology/game-physics'

import type { ProjectileBody } from './types'

/** Radians per second a thrown grenade turns at about the horizontal axis across its flight: the turn the room's own flight gave it. */
const THROW_SPIN = 8

const pose = new Float64Array(7)

/** Puts a thrown projectile in the world, swept (small and fast), turning across its way as the room's own flight did. */
export function spawnThrown(world: SeamWorld, body: ProjectileBody, origin: Vec3, velocity: Vec3): BodyId {
  const [vx, , vz] = velocity
  const run = Math.hypot(vx, vz)
  const spin: Vec3 = run > 1e-6 ? [(vz / run) * THROW_SPIN, 0, (-vx / run) * THROW_SPIN] : [THROW_SPIN, 0, 0]
  return world.createBody({
    shape: body.shape,
    motion: 'dynamic',
    mass: body.mass,
    position: origin,
    material: body.material,
    layer: 'debris',
    continuous: true,
    rolling: body.rolling,
    linearVelocity: velocity,
    angularVelocity: spin,
    user: body.user,
  })
}

/** Copies the engine's pose of a thrown projectile onto its mesh and returns where it is. */
export function readThrown(world: SeamWorld, id: BodyId, mesh: THREE_NS.Object3D): Vec3 {
  world.readPose(id, pose, 0)
  mesh.quaternion.set(pose[3] ?? 0, pose[4] ?? 0, pose[5] ?? 0, pose[6] ?? 1)
  return [pose[0] ?? 0, pose[1] ?? 0, pose[2] ?? 0]
}

export function dropThrown(world: SeamWorld, id: BodyId): void {
  world.removeBody(id)
}
