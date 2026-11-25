// The liquid of an item that holds one (a bottle, a cup, a bowl of soup) lives in the fluid world while the vessel holds it.
import type { DestructionWorld } from '@adatechnology/game-destruction'
import type { FluidWorld } from '@adatechnology/game-fluids'

/** What the room keeps of a vessel: the id of its container in the fluid world, while it has one. */
export interface VesselEntry {
  containerId?: string
  /** The part that holds the liquid (the body of the bottle); without one, the whole object does. */
  fluidPart?: string
}

export interface VesselsDeps {
  readonly world: DestructionWorld
  readonly fluids: FluidWorld
  readonly view: { unbindContainer(id: string): void }
}

export interface Vessels {
  /** The vessel left the room (cleared, replaced): its container goes with it. */
  remove(entry: VesselEntry): void
  /**
   * When the part that holds the liquid broke, melted or burnt away (on `objectId`, the piece that has it now), the liquid falls from where it was and the
   * container is gone, instead of a disc of liquid staying where the vessel stood. Returns whether it did.
   */
  shatterIfBroken(entry: VesselEntry, objectId: string): boolean
}

const GONE = new Set(['broken', 'melted', 'ashes'])

export function createVessels({ world, fluids, view }: VesselsDeps): Vessels {
  const broken = (objectId: string, part?: string): boolean => {
    if (part) {
      const state = world.part(objectId, part)
      return !state || GONE.has(state.status)
    }
    const state = world.has(objectId) ? world.state(objectId) : null
    return !state || state.parts.every((p) => GONE.has(p.status))
  }
  const release = (entry: VesselEntry, how: 'remove' | 'shatter'): void => {
    const id = entry.containerId
    if (!id) return
    view.unbindContainer(id)
    if (how === 'shatter') fluids.shatter(id)
    else fluids.removeContainer(id)
    entry.containerId = undefined
  }
  return {
    remove: (entry) => release(entry, 'remove'),
    shatterIfBroken(entry, objectId) {
      if (!entry.containerId || !broken(objectId, entry.fluidPart)) return false
      release(entry, 'shatter')
      return true
    },
  }
}
