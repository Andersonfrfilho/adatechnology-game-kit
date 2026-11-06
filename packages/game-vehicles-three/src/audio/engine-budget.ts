import type { Vec3 } from '@adatechnology/game-contracts'

/** How many vehicles are heard at once: the nearest `max` to the listener keep their loops, the others are silent until they come closer. */
export type EngineBudget = {
  /** Reports where a vehicle is this frame; true when it is among the nearest `max` (it may sound). */
  admit(vehicle: object, position: Vec3): boolean
  /** Forgets a vehicle (it left the scene). */
  release(vehicle: object): void
  /** Vehicles being tracked. */
  readonly size: number
}

export type EngineBudgetOptions = {
  /** Default 6: a street of idling cars is a hum, not a wall of a hundred engines. */
  readonly max?: number
  /** Where the listener is (the camera or the player). */
  readonly listener: () => Vec3
}

const distanceSq = (a: Vec3, b: Vec3): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

/**
 * A level of detail for vehicle sound, shared by every `createVehicleSound` of a scene (`VehicleSoundOptions.budget`): each vehicle reports its
 * place every frame and only the nearest `max` keep their engine and tyre loops. A vehicle that falls out fades its loops to silence; its one-shots
 * (a crash, the starter) still play, since they are rare and the engine's voice limiter already ranks them.
 */
export function createEngineBudget(options: EngineBudgetOptions): EngineBudget {
  const max = Math.max(1, options.max ?? 6)
  const places = new Map<object, number>()
  return {
    admit(vehicle, position) {
      const own = distanceSq(position, options.listener())
      places.set(vehicle, own)
      if (places.size <= max) return true
      // its rank among the vehicles reported: how many are nearer (ties go to the one reported first)
      let nearer = 0
      for (const [other, d] of places) {
        if (other === vehicle) continue
        if (d < own) nearer++
        if (nearer >= max) return false
      }
      return true
    },
    release(vehicle) {
      places.delete(vehicle)
    },
    get size() {
      return places.size
    },
  }
}
