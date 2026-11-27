import type { ModuleHost, WorkerCoordinator } from '@adatechnology/game-contracts'
import { createPhysicsServices } from '@adatechnology/game-physics'
import type { PhysicsLoop, PhysicsServices } from '@adatechnology/game-physics'

/** The physics with its services made when a loop steps the pieces; their `dispose` runs before the world's. */
export function servicesOf<TPhysics extends { readonly loop: PhysicsLoop | null; dispose(): void }>(physics: TPhysics): TPhysics & { readonly services?: PhysicsServices } {
  if (physics.loop === null) return physics
  const services = createPhysicsServices({ loop: physics.loop })
  return {
    ...physics,
    services,
    dispose: () => {
      services.dispose()
      physics.dispose()
    },
  }
}

/** What the host hands a module of its physics and workers (`ModuleHost.physics`, `ModuleHost.workers`); no `physics` when the pieces run on a seam the game steps. */
export function physicsHostOf(kit: { readonly physics: { readonly services?: PhysicsServices } }, workers?: WorkerCoordinator): Pick<ModuleHost, 'physics' | 'workers'> {
  const { services } = kit.physics
  return { ...(services ? { physics: services } : {}), ...(workers ? { workers } : {}) }
}
