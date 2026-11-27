import { CROWD_AGENTS_CHANNEL, CROWD_DYING_VELOCITY_CHANNEL } from '@adatechnology/game-physics'
import type { DyingVelocity, PhysicsServices } from '@adatechnology/game-physics'
import { createRunOver } from '@adatechnology/game-vehicles-driving'
import type { RunOver, RunOverAgents, RunOverCrowd, RunOverVehicle } from '@adatechnology/game-vehicles-driving'

/** What a crowd module lends on `CROWD_AGENTS_CHANNEL`: its crowd and the kinematic capsules of its agents (`createAgentBodies` of `game-crowd`). */
type LentCrowd = { readonly crowd: RunOverCrowd; readonly agents: RunOverAgents }

export interface RunOverLink {
  /** The car runs over the lent crowd from the next step on, whichever of the two the host attached first; returns the way to stop. */
  track(vehicle: RunOverVehicle): () => void
  dispose(): void
}

/** Cars against the crowd of the same host: one `createRunOver` for the crowd lent now, made again when the crowd changes (the bench rebuilt it) and with the cars tracked so far. */
export const createRunOverLink = (services: PhysicsServices): RunOverLink => {
  const channel = services.channel<LentCrowd>(CROWD_AGENTS_CHANNEL)
  const vehicles = new Set<RunOverVehicle>()
  const stops = new Map<RunOverVehicle, () => void>()
  let runOver: RunOver | undefined

  const follow = (): void => {
    runOver?.dispose()
    runOver = undefined
    stops.clear()
    const lent = channel.values[0]
    if (!lent) return
    runOver = createRunOver(services.loop, { crowd: lent.crowd, agents: lent.agents })
    for (const vehicle of vehicles) stops.set(vehicle, runOver.track(vehicle))
  }

  const stopListening = channel.onChange(follow)
  // the crowd's corpses made in the very step a car kills read the velocity it carries (`RunOver.dyingVelocity`) to start from
  const stopLending = services.channel<DyingVelocity>(CROWD_DYING_VELOCITY_CHANNEL).publish(() => runOver?.dyingVelocity)
  follow()
  return {
    track: (vehicle) => {
      vehicles.add(vehicle)
      if (runOver) stops.set(vehicle, runOver.track(vehicle))
      return () => {
        vehicles.delete(vehicle)
        stops.get(vehicle)?.()
        stops.delete(vehicle)
      }
    },
    dispose: () => {
      stopListening()
      stopLending()
      runOver?.dispose()
      runOver = undefined
      vehicles.clear()
      stops.clear()
    },
  }
}
