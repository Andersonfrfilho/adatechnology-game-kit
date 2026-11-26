import type { VehicleInput } from '@adatechnology/game-physics'

import type { SemiInput } from './semi/types'

/** What the vehicle can do now (the fields of the destructible's `status()` this needs: any object with them works). */
export interface DriveStatus {
  /** Engine runs and the gearbox transmits. */
  readonly canDrive: boolean
  /** 1 is normal; this many times longer to stop with worn or missing brakes. */
  readonly brakeFactor: number
  /** -1..1: the sideways pull of a damaged steering or flat tyres (negative is left). */
  readonly steerPull: number
}

export interface PhysicsInputOptions {
  /** The steering follows its target by `min(1, steerResponse dt)`: the arcade's 5 per second. */
  readonly steerResponse?: number
  /** Lock lost per m/s of speed (the steering assistance), and the share of it that is never lost. */
  readonly steerFalloff?: number
  readonly steerFloor?: number
  /** Below this speed (m/s), forward or back, a brake asks for reverse and a throttle for forward. */
  readonly reverseBelow?: number
  /** Share of the full lock a full `steerPull` pulls with. */
  readonly pullShare?: number
}

export interface PhysicsInputParams {
  readonly input: SemiInput
  /** Signed speed along the front of the vehicle, m/s. */
  readonly speed: number
  /** Seconds since the last call. */
  readonly dt: number
  readonly status?: Partial<DriveStatus>
}

export interface PhysicsInputMapper {
  /** The engine's input for this step. It keeps the filtered steering between calls. */
  map(params: PhysicsInputParams): VehicleInput
  reset(): void
}

/** Starting values, to be calibrated against the vehicle on the engine (T6.2b): the response is the arcade's, the assistance and the pull are not measured yet. */
export const DEFAULT_PHYSICS_INPUT: Required<PhysicsInputOptions> = { steerResponse: 5, steerFalloff: 0.012, steerFloor: 0.4, reverseBelow: 0.5, pullShare: 0.2 }

const clamp = (x: number, low: number, high: number): number => Math.max(low, Math.min(high, x))

/**
 * Pedals to the engine's input (design 7.2): throttle and brake cancel into one pedal; forward from a stop or above, hard brake against the move, reverse from
 * a stop; the power limit of traction control and a hurt engine cuts the throttle; the brake factor of a worn brake softens the brake; steering is the kit's
 * positive-left turned into the engine's positive-right, filtered, eased with the speed, and pulled by a damaged steering. A vehicle that cannot drive gets no
 * throttle (the brake and the steering still work).
 */
export const createPhysicsInputMapper = (options: PhysicsInputOptions = {}): PhysicsInputMapper => {
  const rules = { ...DEFAULT_PHYSICS_INPUT, ...options }
  let steering = 0
  return {
    reset() {
      steering = 0
    },
    map({ input, speed, dt, status }) {
      const pedal = clamp(input.throttle, 0, 1) - clamp(input.brake, 0, 1)
      const powerLimit = clamp(input.powerLimit ?? 1, 0, 1)
      const canDrive = status?.canDrive ?? true
      const brakeSoftness = 1 / Math.max(1, status?.brakeFactor ?? 1)
      let forward = 0
      let brake = 0
      if (pedal > 0) {
        if (speed < -rules.reverseBelow) brake = pedal * brakeSoftness
        else forward = pedal * powerLimit
      } else if (pedal < 0) {
        if (speed > rules.reverseBelow) brake = -pedal * brakeSoftness
        else forward = pedal * powerLimit
      }
      const lock = Math.max(rules.steerFloor, 1 - rules.steerFalloff * Math.abs(speed))
      const target = -clamp(input.steer, -1, 1) * lock
      steering += (target - steering) * Math.min(1, dt * rules.steerResponse)
      const pull = clamp(status?.steerPull ?? 0, -1, 1) * rules.pullShare
      return { forward: canDrive ? forward : 0, right: clamp(steering + pull, -1, 1), brake, handBrake: input.handbrake ? 1 : 0 }
    },
  }
}
