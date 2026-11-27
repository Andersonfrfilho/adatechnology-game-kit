import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

export class RoomPhysicsRequiredError extends Error {
  readonly code = 'ROOM_PHYSICS_REQUIRED'
  constructor() {
    super('game-test-room: the `physics` option is required: pass a PhysicsLoop (`physics: await createRoomPhysics()`), or a world the host steps itself')
    this.name = 'RoomPhysicsRequiredError'
  }
}

/** Loads the Jolt engine and makes a world with the kit's numbers: the loop the room steps its pieces on (pass it as `physics`). */
export async function createRoomPhysics(): Promise<PhysicsLoop> {
  const engine = await createJoltEngine()
  return createPhysicsLoop(engine.createWorld({ ...KIT_WORLD }))
}

/** The type requires `physics`; a plain-JS host can still leave it out. */
export function requireRoomPhysics<TPhysics>(physics: TPhysics | undefined): TPhysics {
  if (physics === undefined) throw new RoomPhysicsRequiredError()
  return physics
}
