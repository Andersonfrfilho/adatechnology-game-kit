import type { CharacterId, PhysicsWorld, Vec3 } from '@adatechnology/game-physics'

import type { PlayerCollider } from './player'
import type { PlayerController } from './types'

/** The part of the physics contract the player's body uses: any `PhysicsWorld` (or the loop's `SeamWorld`) has it. */
export type PlayerPhysicsWorld = Pick<PhysicsWorld, 'createCharacter' | 'moveCharacter' | 'pushCharacter' | 'readCharacter' | 'teleportCharacter' | 'removeCharacter' | 'characterSupported'>

export type PhysicsControllerOptions = {
  /** Where the feet are. */
  readonly position: Vec3
  /** What `player.collider()` says: the capsule is made as tall and as wide as the standing body. */
  readonly collider: PlayerCollider
  /** Kilograms, default 75. */
  readonly mass?: number
  /** Most force (N) it pushes a prop with, default 400: a 30 kg crate over wood, not a wardrobe. */
  readonly strength?: number
}

export type PhysicsPlayerController = PlayerController & {
  readonly id: CharacterId
  /** Shoves the body: `impulse` in N s (a blow, a blast, a car's bumper); the controller feels it as impulse / mass, fading in a quarter of a second. */
  push(impulse: Vec3): void
  supported(): boolean
  dispose(): void
}

export const PLAYER_MASS_KG = 75
export const PLAYER_PUSH_STRENGTH_NEWTONS = 400
/** The most a person puts into what is in the way just by walking into it, without leaning on it on purpose: about the sustained push force of ISO 11228-2 for a man (100 N), the order of what a walk can keep up. A thing whose floor grip is above it (a 28 kg sofa on wood: 115 N) stops the walk; a lighter one is shoved along. */
export const PLAYER_WALK_PUSH_NEWTONS = 100

/**
 * The player's controller in a physics world: a capsule as tall as the standing body (a crouch does not shrink it) that steps up, climbs, pushes props and is
 * pushed. Put it in `PlayerWorld.controller` and call `player.update(h, input)` from a `beforeStep(h)` of the loop's `actors` phase, never with the frame's `dt`.
 */
export const createPhysicsController = (world: PlayerPhysicsWorld, options: PhysicsControllerOptions): PhysicsPlayerController => {
  const { radiusMetres, heightMetres } = options.collider
  const id = world.createCharacter({
    position: options.position,
    radius: radiusMetres,
    halfHeight: Math.max(0, (heightMetres - 2 * radiusMetres) / 2),
    mass: options.mass ?? PLAYER_MASS_KG,
    strength: options.strength ?? PLAYER_PUSH_STRENGTH_NEWTONS,
  })
  return {
    id,
    move: (velocityX, velocityZ, dt) => world.moveCharacter(id, velocityX, velocityZ, dt),
    read: (out) => world.readCharacter(id, out, 0),
    teleport: (x, y, z) => world.teleportCharacter(id, [x, y, z]),
    push: (impulse) => world.pushCharacter(id, impulse),
    supported: () => world.characterSupported(id),
    dispose: () => world.removeCharacter(id),
  }
}
