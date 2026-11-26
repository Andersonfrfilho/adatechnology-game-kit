import type { BodyId, PhysicsLoop, Quat, Vec3 } from '@adatechnology/game-physics'

import type { Crowd } from './crowd'
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

const STILL: Vec3 = [0, 0, 0]
const DEFAULT_RADIUS = 0.25
const DEFAULT_HEIGHT = 1.7

/**
 * Every agent of the crowd as a kinematic capsule on the `agent` layer: game-crowd moves them, the engine only lets them push what they meet (a door leaf, a prop, debris).
 * Capsule `i` follows agent `i` of the store, whichever agent that is after a removal moved the last one into its place; it moves in the loop's `crowd` phase, before each fixed step.
 * An agent that takes a vacancy (a removal's last agent, a spawn) is placed there with `setPose`: a kinematic move across the world would push whatever is on the way.
 */
export const createAgentBodies = (loop: PhysicsLoop, crowd: Pick<Crowd, 'on'> & { readonly store: CrowdStore }, options: AgentBodiesOptions = {}): AgentBodies => {
  const { store } = crowd
  const world = loop.world
  const radius = options.radius ?? DEFAULT_RADIUS
  const fallbackHeight = options.fallbackHeight ?? DEFAULT_HEIGHT
  const bodies: BodyId[] = []
  const centreHeight = new Float32Array(store.capacity)
  const target: [number, number, number] = [0, 0, 0]
  const rotation: [number, number, number, number] = [0, 0, 0, 1]
  const shouldTeleport = new Uint8Array(store.capacity)
  // x, y, z, yaw last handed to the engine, per agent; `isSettled` once the engine was told the same pose twice (a kinematic body keeps the speed of its last move until it is told it is there)
  const delivered = new Float64Array(store.capacity * 4)
  const isSettled = new Uint8Array(store.capacity)
  const stopTakingVacancies = [
    crowd.on('remove', (event) => {
      if (event.moved >= 0) shouldTeleport[event.agent] = 1
    }),
    crowd.on('spawn', (event) => {
      shouldTeleport[event.agent] = 1
    }),
  ]

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
        shouldTeleport[i] = 0
        isSettled[i] = 0
        delivered[i * 4] = Number.NaN
        continue
      }
      const x = store.x[i]!
      const y = store.y[i]! + centreHeight[i]!
      const z = store.z[i]!
      const yaw = store.yaw[i]!
      const at = i * 4
      const isSamePose = delivered[at] === x && delivered[at + 1] === y && delivered[at + 2] === z && delivered[at + 3] === yaw
      if (isSamePose && isSettled[i] && !shouldTeleport[i]) continue
      const half = yaw / 2
      target[0] = x
      target[1] = y
      target[2] = z
      rotation[1] = Math.sin(half)
      rotation[3] = Math.cos(half)
      delivered[at] = x
      delivered[at + 1] = y
      delivered[at + 2] = z
      delivered[at + 3] = yaw
      isSettled[i] = isSamePose ? 1 : 0
      if (shouldTeleport[i]) {
        shouldTeleport[i] = 0
        world.setPose(body, target as Vec3, rotation as Quat, true)
        world.setVelocity(body, STILL, STILL)
        isSettled[i] = 1
      } else world.moveKinematic(body, target as Vec3, rotation as Quat, h)
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
      for (const stop of stopTakingVacancies) stop()
      for (const body of bodies) if (world.has(body)) world.removeBody(body)
      bodies.length = 0
    },
  }
}
