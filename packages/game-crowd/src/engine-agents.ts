import type { BodyId, PhysicsLoop, Quat, Vec3 } from '@adatechnology/game-physics'

import type { CrowdStore } from './store'

export type AgentBodiesOptions = {
  /** Radius (m) of the capsule every agent gets. Default 0.25. */
  readonly radius?: number
  /** Height (m) of an agent whose `store.height` is 0. Default 1.7. */
  readonly fallbackHeight?: number
}

export type AgentBodies = {
  /** Kinematic capsules alive in the engine: one per agent in the store. */
  readonly count: number
  /** The capsule of agent `i`, or undefined past the store's `n`. */
  bodyOf(i: number): BodyId | undefined
  /** Takes the capsules out of the world and the phase out of the loop. */
  dispose(): void
}

const DEFAULT_RADIUS = 0.25
const DEFAULT_HEIGHT = 1.7

/**
 * Every agent of the crowd as a kinematic capsule on the `agent` layer: game-crowd moves them, the engine only lets them push what they meet (a door leaf, a prop, debris).
 * Capsule `i` follows agent `i` of the store, whichever agent that is after a removal moved the last one into its place; it moves in the loop's `crowd` phase, before each fixed step.
 */
export const createAgentBodies = (loop: PhysicsLoop, crowd: { readonly store: CrowdStore }, options: AgentBodiesOptions = {}): AgentBodies => {
  const { store } = crowd
  const world = loop.world
  const radius = options.radius ?? DEFAULT_RADIUS
  const fallbackHeight = options.fallbackHeight ?? DEFAULT_HEIGHT
  const bodies: BodyId[] = []
  const centreHeight = new Float32Array(store.capacity)
  const target: [number, number, number] = [0, 0, 0]
  const rotation: [number, number, number, number] = [0, 0, 0, 1]

  const create = (i: number): BodyId => {
    const height = store.height[i]! > 0 ? store.height[i]! : fallbackHeight
    const halfHeight = Math.max(0, height / 2 - radius)
    centreHeight[i] = halfHeight + radius
    return world.createBody({
      shape: { kind: 'capsule', halfHeight, radius },
      motion: 'kinematic',
      position: [store.x[i]!, store.y[i]! + centreHeight[i]!, store.z[i]!],
      layer: 'agent',
      user: i,
    })
  }

  const beforeStep = (h: number): void => {
    const count = store.n
    while (bodies.length > count) world.removeBody(bodies.pop()!)
    for (let i = 0; i < count; i++) {
      const body = bodies[i]
      if (body === undefined) {
        bodies.push(create(i))
        continue
      }
      const half = store.yaw[i]! / 2
      target[0] = store.x[i]!
      target[1] = store.y[i]! + centreHeight[i]!
      target[2] = store.z[i]!
      rotation[1] = Math.sin(half)
      rotation[3] = Math.cos(half)
      world.moveKinematic(body, target as Vec3, rotation as Quat, h)
    }
  }

  const removePhase = loop.add({ beforeStep }, 'crowd')
  return {
    get count() {
      return bodies.length
    },
    bodyOf: (i) => bodies[i],
    dispose: () => {
      removePhase()
      for (const body of bodies) if (world.has(body)) world.removeBody(body)
      bodies.length = 0
    },
  }
}
