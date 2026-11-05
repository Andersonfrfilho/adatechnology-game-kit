/**
 * The wheels of a built vehicle turning as it moves: each wheel the kit drew (`context.wheels`) rolls about its axle by the distance travelled over
 * its radius, and the front ones turn with the steering. The turn is applied over the wheel's own rest pose, so a mirrored or tilted wheel rolls the
 * right way, and `dispose` puts every wheel back exactly as it was drawn.
 */
import type { BuiltVehicle } from './build'

type Vec = { x: number; y: number; z: number }
type Quat = { copy(q: Quat): Quat; clone(): Quat; setFromAxisAngle(axis: Vec, angle: number): Quat; multiply(q: Quat): Quat; premultiply(q: Quat): Quat }
type Wheel = { position: Vec; quaternion: Quat; userData: Record<string, unknown> }

/** What the wheels need of three.js. */
export type WheelRollThree = { Vector3: new (x?: number, y?: number, z?: number) => Vec; Quaternion: new () => Quat }

export interface WheelRoll {
  /** Wheels found on the vehicle. */
  readonly count: number
  /** The vehicle went `distance` metres forward (negative backwards) with the front wheels steered `steer` radians (positive to the left). */
  roll(distance: number, steer: number): void
  dispose(): void
}

/** A wheel's radius when the kit did not record one, metres. */
const DEFAULT_RADIUS = 0.32

export function createWheelRoll(THREE: WheelRollThree, built: BuiltVehicle): WheelRoll {
  const wheels = ((built.context as { wheels?: Wheel[] } | null)?.wheels ?? []).map((wheel) => ({
    wheel,
    rest: wheel.quaternion.clone(),
    radius: Number(wheel.userData.r) || DEFAULT_RADIUS,
    // in the kit's frame the front is +x: the wheels ahead of the middle steer
    front: wheel.position.x > 0,
    angle: 0,
  }))
  // the kit's frame: x forward, y up, z to the right; a wheel rolling forward turns about +z the negative way
  const axle = new THREE.Vector3(0, 0, 1)
  const up = new THREE.Vector3(0, 1, 0)
  const spin = new THREE.Quaternion()
  const steering = new THREE.Quaternion()
  return {
    count: wheels.length,
    roll(distance, steer) {
      for (const w of wheels) {
        w.angle = (w.angle - distance / w.radius) % (Math.PI * 2)
        spin.setFromAxisAngle(axle, w.angle)
        steering.setFromAxisAngle(up, w.front ? steer : 0)
        w.wheel.quaternion.copy(w.rest).premultiply(spin).premultiply(steering)
      }
    },
    dispose() {
      for (const w of wheels) w.wheel.quaternion.copy(w.rest)
    },
  }
}
