import type { RainCover } from '@adatechnology/game-contracts'
import { createVehicleRainCover } from '@adatechnology/game-vehicles'
import type { CabinSource, VehicleRainCover } from '@adatechnology/game-vehicles'

/** How often a vehicle's damage state is read for the roof and the panes it has left, seconds: a hit shows within this; moving costs nothing of it. */
export const RAIN_SHELL_INTERVAL = 0.4

type Tracked = {
  readonly rain: VehicleRainCover
  readonly frame: { readonly parent: unknown | null }
  /** Takes the cover out of the host's rain; present while the vehicle is in the scene. */
  remove: (() => void) | undefined
  untilShell: number
}

/**
 * Keeps the host's rain told what the cars roof over (`ModuleHost.rainCover`): the cabin of each vehicle in the scene is a cover that follows it, and a broken
 * roof or windshield opens it. `sync` every frame; a vehicle that left the scene is taken out. A host without a rain cover keeps the old rain.
 */
export interface VehicleRainCovers {
  /** Follows the cabin of a vehicle by its object id; `frame` is the object the host placed it in (the destructible's `frame`). */
  track(id: string, source: CabinSource, frame: { readonly parent: unknown | null }): void
  untrack(id: string): void
  sync(cover: RainCover | undefined, dt: number): void
  /** Takes every cover out (the module leaves). */
  clear(): void
  /** The ids followed now. */
  ids(): string[]
}

export function createVehicleRainCovers(): VehicleRainCovers {
  const tracked = new Map<string, Tracked>()
  let counter = 0
  const end = (id: string): void => {
    tracked.get(id)?.remove?.()
    tracked.delete(id)
  }
  return {
    track(id, source, frame) {
      tracked.set(id, { rain: createVehicleRainCover(source, { frame }), frame, remove: undefined, untilShell: (counter++ % 8) * (RAIN_SHELL_INTERVAL / 8) })
    },
    untrack: end,
    sync(cover, dt) {
      if (!cover) return
      for (const [id, entry] of tracked) {
        if (!entry.frame.parent) {
          // not placed yet (built, not added): wait; taken out of the scene: forget it
          if (entry.remove) end(id)
          continue
        }
        if (!entry.remove) {
          entry.remove = cover.add(entry.rain.source)
          entry.rain.refreshShell()
        }
        entry.untilShell -= dt
        if (entry.untilShell <= 0) {
          entry.untilShell = RAIN_SHELL_INTERVAL
          entry.rain.refreshShell()
        }
        entry.rain.place()
      }
    },
    clear() {
      for (const id of [...tracked.keys()]) end(id)
    },
    ids: () => [...tracked.keys()],
  }
}
