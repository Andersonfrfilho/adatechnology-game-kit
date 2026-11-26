import { IDENTITY } from './contract'
import type { BodyId, Vec3 } from './contract'
import type { PhysicsLoop } from './loop'

export interface SensorVolumesOptions {
  /** A body came into volume `volume` (the id the host gave it). Runs once per frame, after the steps. */
  readonly onEnter: (volume: number, other: BodyId) => void
  /** A body left it, or was removed from the world inside it. */
  readonly onExit: (volume: number, other: BodyId) => void
}

export interface SensorVolumes {
  /** A sphere that tells who is in it (a smoke cloud, a gas pocket, a trigger): it never pushes. `id` is the host's; a second `add` of one id replaces it. */
  add(volume: { readonly id: number; readonly centre: Vec3; readonly radius: number }): void
  /** The cloud drifts: the sphere is at `centre` from the next step. */
  move(id: number, centre: Vec3): void
  remove(id: number): void
  /** Takes the phase out of the loop and the spheres out of the world. */
  dispose(): void
}

/**
 * Spheres on the `sensor` layer that report entering and leaving to the host, in the loop's `contacts` phase (the frame's sensor events). Who is inside now is
 * `world.overlapSphere(centre, radius, out, { layers })`. What a body entering does (a smoke cloud blinds an agent) is the host's.
 */
export const createSensorVolumes = (loop: PhysicsLoop, options: SensorVolumesOptions): SensorVolumes => {
  const world = loop.world
  const bodyOf = new Map<number, BodyId>()
  const volumeOf = new Map<BodyId, number>()

  const remove = (id: number): void => {
    const body = bodyOf.get(id)
    if (body === undefined) return
    bodyOf.delete(id)
    volumeOf.delete(body)
    if (world.has(body)) world.removeBody(body)
  }

  const afterSteps = (): void => {
    for (const event of world.sensorEvents) {
      const volume = volumeOf.get(event.sensor)
      if (volume === undefined) continue
      if (event.entered) options.onEnter(volume, event.other)
      else options.onExit(volume, event.other)
    }
  }

  const removePhase = loop.add({ afterSteps }, 'contacts')
  return {
    add(volume) {
      remove(volume.id)
      const body = world.createBody({ shape: { kind: 'sphere', radius: volume.radius }, motion: 'static', position: volume.centre, layer: 'sensor', user: volume.id })
      bodyOf.set(volume.id, body)
      volumeOf.set(body, volume.id)
    },
    move(id, centre) {
      const body = bodyOf.get(id)
      if (body !== undefined) world.setPose(body, centre, IDENTITY, false)
    },
    remove,
    dispose() {
      removePhase()
      for (const id of [...bodyOf.keys()]) remove(id)
    },
  }
}
