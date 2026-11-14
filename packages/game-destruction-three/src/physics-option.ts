import { createPhysicsLoop, isPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsLoop, PhysicsWorld, SeamWorld } from '@adatechnology/game-physics'

/**
 * The physics a seam is handed, always by its host and always spelled out: a `PhysicsLoop` (the host steps it; the seam registers phases), a world (the seam makes its own loop
 * and steps it in its `update`), or `'own'` (the kit's own solver, until it goes).
 */
export type PiecePhysics = PhysicsLoop | SeamWorld | 'own'

export class PhysicsOptionError extends Error {
  readonly code = 'PHYSICS_OPTION'
  constructor(message: string) {
    super(`game-destruction-three: ${message}`)
    this.name = 'PhysicsOptionError'
  }
}

export interface ResolvedPhysics {
  readonly loop: PhysicsLoop
  /** True when the seam made the loop from a world: it steps it itself, inside its `update`. */
  readonly stepsItself: boolean
}

/** `null` for `'own'`; the option left out (a plain-JS host) or not a world nor a loop throws. */
export const resolvePhysics = (option: PiecePhysics | undefined): ResolvedPhysics | null => {
  if (option === 'own') return null
  if (option === undefined || typeof option !== 'object') {
    throw new PhysicsOptionError("the `physics` option is required: pass a PhysicsLoop, a world from the host, or 'own' for the kit's own solver")
  }
  if (isPhysicsLoop(option)) return { loop: option, stepsItself: false }
  // the type says a seam world (no `step`); one given here to be stepped is the host's full world
  if (typeof (option as Partial<PhysicsWorld>).stepFixed !== 'function') {
    throw new PhysicsOptionError('a world given as `physics` must be able to step (a PhysicsWorld); to step it elsewhere, pass its PhysicsLoop')
  }
  return { loop: createPhysicsLoop(option as PhysicsWorld), stepsItself: true }
}
