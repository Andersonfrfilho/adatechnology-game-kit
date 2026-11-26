import type { BodyId, PhysicsLoop, Quat, Vec3 } from '@adatechnology/game-physics'

import { defaultArcadeSpec } from './arcade'
import type { RunOverRules } from './arcade'
import { runOver } from './run-over'
import type { RunOverOutcome } from './run-over'

/** What the run-over needs of the crowd: `game-crowd`'s `Crowd` is one as it is, and nothing here imports it. */
export type RunOverCrowd = {
  readonly store: {
    readonly n: number
    readonly x: Float32Array
    readonly z: Float32Array
    readonly vx: Float32Array
    readonly vz: Float32Array
    readonly mass: Float32Array
    readonly identity: Uint32Array
  }
  damage(index: number, hit: { readonly region: 1; readonly amount: number; readonly distance: number }): { readonly died: boolean }
  kill(index: number): void
  asPlayerCrowd(): { stun(index: number, seconds: number, vx: number, vz: number): void }
}

/** The kinematic capsules of the agents (`createAgentBodies` of `game-crowd`): capsule `i` follows agent `i`. */
export type RunOverAgents = { readonly count: number; bodyOf(index: number): BodyId | undefined }

/** A car the run-over watches: its chassis body and the half sizes of its box (x right, y up, z forward, as the engine's vehicles). */
export type RunOverVehicle = { readonly body: BodyId; readonly half: Vec3 }

export type RunOverHit = {
  readonly vehicle: BodyId
  readonly agent: number
  readonly outcome: RunOverOutcome
  /** Closing speed (m/s) and the energy the hit dissipated: half the reduced mass times the closing speed squared (J). */
  readonly speed: number
  readonly energy: number
  /** What `RunOverRules.killVehicleDamage` says the car takes: 0 unless the body died. */
  readonly vehicleDamage: number
}

export type RunOverOptions = {
  readonly crowd: RunOverCrowd
  readonly agents: RunOverAgents
  readonly rules?: Partial<RunOverRules>
  /** Told of each hit inside the fixed step (the host's sound, blood, damage to the car). */
  readonly onHit?: (hit: RunOverHit) => void
}

export type RunOver = {
  /** Watches a car from the next step on; returns the way to stop. */
  track(vehicle: RunOverVehicle): () => void
  /** The velocity a body that dies in this very call carries (a `CorpseBodies.add` made in the crowd's `corpses` listener reads it); undefined outside a hit. */
  readonly dyingVelocity: Vec3 | undefined
  dispose(): void
}

/** Slowest car (m/s) that runs anyone over. */
const MIN_SPEED = 1
/** Mass (kg) of the body the arcade damage (`knockDamage`) is written for, and of an agent whose mass is not seated. */
const REFERENCE_MASS = 70
/** Speed (m/s) a pushed body is moved aside at. */
const PUSH_ASIDE_SPEED = 1

/**
 * Cars against the crowd's agents, in the loop's `actors` phase (veiculos.md 7.8). The `vehicle` and `agent` layers do not meet, because an agent is kinematic and would stop a truck as a
 * wall: the car sweeps its box over the step against the `agent` layer instead. A body in the way meets the car as a perfectly inelastic hit (momentum kept: the car loses `m / (M + m)`
 * of the closing speed and the body leaves at the common speed), which `RunOverRules` classes by the closing speed: pushed aside below `knockSpeed` (the car held by `holdDrag`), knocked
 * down (damage `knockDamage` by the energy, stunned) up to `killSpeed`, killed above it. Whoever dies is told to the crowd with the car's velocity in `dyingVelocity`.
 */
export const createRunOver = (loop: PhysicsLoop, options: RunOverOptions): RunOver => {
  const { crowd, agents } = options
  const rules = { ...defaultArcadeSpec.runOver, ...options.rules }
  const world = loop.world
  const vehicles: RunOverVehicle[] = []
  /** The agents each car already struck and still overlaps: a body knocked down is under the car for a few steps and is struck once. */
  const struck = new Map<RunOverVehicle, Set<number>>()
  const hits: BodyId[] = []
  const pose = new Float64Array(7)
  const velocity = new Float64Array(6)
  const box = { kind: 'box' as const, half: [0, 0, 0] as [number, number, number] }
  const centre: [number, number, number] = [0, 0, 0]
  const rotation: [number, number, number, number] = [0, 0, 0, 1]
  const impulse: [number, number, number] = [0, 0, 0]
  const point: [number, number, number] = [0, 0, 0]
  let dying: Vec3 | undefined
  let diedLast = false

  /** The agent indices whose capsule is among `bodies`, descending: a death moves the last agent into its slot, so the ones not yet handled keep their index. */
  const agentsOf = (bodies: readonly BodyId[]): number[] => {
    const found: number[] = []
    for (let index = agents.count - 1; index >= 0; index--) if (bodies.includes(agents.bodyOf(index)!)) found.push(index)
    return found
  }

  /** What the body in the way does to the car and to itself; returns the momentum (N s) the car loses. */
  const strike = (index: number, outcome: RunOverOutcome, direction: readonly [number, number], hit: { readonly reduced: number; readonly closing: number; readonly common: number; readonly carMomentum: number }, h: number): number => {
    const { store } = crowd
    if (outcome === 'push') {
      store.x[index]! += -direction[1] * PUSH_ASIDE_SPEED * h
      store.z[index]! += direction[0] * PUSH_ASIDE_SPEED * h
      return hit.carMomentum * (1 - Math.exp(-rules.holdDrag * h))
    }
    dying = [direction[0] * hit.common, 0, direction[1] * hit.common]
    if (outcome === 'kill') crowd.kill(index)
    else if (!crowd.damage(index, { region: 1, amount: (hit.reduced / REFERENCE_MASS) * hit.closing * hit.closing * rules.knockDamage, distance: 0 }).died) {
      dying = undefined
      crowd.asPlayerCrowd().stun(index, rules.stunSeconds, direction[0] * hit.common, direction[1] * hit.common)
    }
    const died = dying !== undefined
    dying = undefined
    diedLast = died
    return hit.reduced * hit.closing
  }

  const hitOne = (vehicle: RunOverVehicle, index: number, direction: readonly [number, number], car: { speed: number; readonly mass: number }, h: number): RunOverOutcome | undefined => {
    const { store } = crowd
    const mass = store.mass[index]! > 0 ? store.mass[index]! : REFERENCE_MASS
    const closing = car.speed - (store.vx[index]! * direction[0] + store.vz[index]! * direction[1])
    if (closing <= 0) return undefined
    const reduced = (mass * car.mass) / (mass + car.mass)
    const outcome = runOver(closing, rules)
    diedLast = false
    const lost = strike(index, outcome, direction, { reduced, closing, common: car.speed - (mass / (mass + car.mass)) * closing, carMomentum: car.mass * car.speed }, h)
    car.speed -= lost / car.mass
    impulse[0] = -direction[0] * lost
    impulse[2] = -direction[1] * lost
    world.addImpulse(vehicle.body, impulse, point)
    options.onHit?.({ vehicle: vehicle.body, agent: index, outcome, speed: closing, energy: 0.5 * reduced * closing * closing, vehicleDamage: diedLast ? rules.killVehicleDamage : 0 })
    return outcome
  }

  const sweep = (vehicle: RunOverVehicle, h: number): void => {
    world.readVelocity(vehicle.body, velocity, 0)
    const speed = Math.hypot(velocity[0]!, velocity[2]!)
    if (speed < MIN_SPEED) return
    world.readPose(vehicle.body, pose, 0)
    const direction: [number, number] = [velocity[0]! / speed, velocity[2]! / speed]
    const reach = (speed * h) / 2
    box.half[0] = vehicle.half[0] + rules.margin
    box.half[1] = vehicle.half[1]
    box.half[2] = vehicle.half[2] + rules.margin + reach
    centre[0] = pose[0]! + direction[0] * reach
    centre[1] = pose[1]!
    centre[2] = pose[2]! + direction[1] * reach
    for (let k = 0; k < 4; k++) rotation[k] = pose[3 + k]!
    point[1] = pose[1]!
    if (world.overlapShape(box, centre, rotation as Quat, hits, { layers: ['agent'] }) === 0) {
      struck.delete(vehicle)
      return
    }
    const car = { speed, mass: world.massOf(vehicle.body) }
    const before = struck.get(vehicle) ?? new Set<number>()
    const now = new Set<number>()
    for (const index of agentsOf(hits)) {
      const identity = crowd.store.identity[index]!
      if (before.has(identity)) {
        now.add(identity)
        continue
      }
      point[0] = crowd.store.x[index]!
      point[2] = crowd.store.z[index]!
      if (hitOne(vehicle, index, direction, car, h) !== 'push') now.add(identity)
    }
    struck.set(vehicle, now)
  }

  const beforeStep = (h: number): void => {
    for (const vehicle of vehicles) sweep(vehicle, h)
  }

  const removePhase = loop.add({ beforeStep }, 'actors')
  return {
    track: (vehicle) => {
      vehicles.push(vehicle)
      return () => {
        const at = vehicles.indexOf(vehicle)
        if (at >= 0) vehicles.splice(at, 1)
        struck.delete(vehicle)
      }
    },
    get dyingVelocity() {
      return dying
    },
    dispose: () => {
      removePhase()
      vehicles.length = 0
      struck.clear()
    },
  }
}
