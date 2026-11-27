import { createAgentBodies, createDoorBodies } from '@adatechnology/game-crowd'
import type { Crowd } from '@adatechnology/game-crowd'
import { CROWD_AGENTS_CHANNEL } from '@adatechnology/game-physics'
import type { PhysicsServices } from '@adatechnology/game-physics'

export type CrowdBodies = { dispose(): void }

/**
 * A crowd in the host's physics world: its agents as kinematic capsules, its closed doors as leaves on a hinge that gives way, and the agents lent on `CROWD_AGENTS_CHANNEL` for the cars that run them over.
 * Agents first, doors after: the loop's phases run in the order they are added, so the order is the same on every page.
 */
export const createCrowdBodies = (services: PhysicsServices, crowd: Crowd): CrowdBodies => {
  const agents = createAgentBodies(services.loop, crowd)
  const doors = createDoorBodies(services.loop, crowd.doors)
  const stopLending = services.channel(CROWD_AGENTS_CHANNEL).publish({ crowd, agents })
  return {
    dispose: () => {
      stopLending()
      doors.dispose()
      agents.dispose()
    },
  }
}
