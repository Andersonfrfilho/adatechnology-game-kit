import type { EffectSink, Enclosure } from '@adatechnology/game-contracts'
import { cabinEnclosure } from '@adatechnology/game-vehicles'
import type { CabinSource } from '@adatechnology/game-vehicles'

/** One vehicle whose cabin holds out the host's smoke: its destructible and the object the host placed it in. */
interface Tracked {
  readonly source: CabinSource
  readonly frame: { readonly parent: unknown | null }
  declared: boolean
  /** It has been in the scene: leaving it now means it was taken away. */
  placed: boolean
}

/**
 * Keeps the host's effects told where the cabins of the vehicles are and how open they are (`EffectSink.enclose`), so the smoke, dust and steam
 * do not pass through a shut car: they go round it and get in only through an open door, a broken window or a bullet hole. `sync` every frame;
 * a vehicle whose object left the scene is forgotten and its cabin ended.
 */
export interface CabinSmoke {
  /** Follows the cabin of a vehicle by its object id; `frame` is the object the host placed it in (the destructible's `frame`). */
  track(id: string, source: CabinSource, frame: { readonly parent: unknown | null }): void
  /** Ends the cabin of one vehicle now. */
  untrack(id: string, effects: EffectSink | undefined): void
  /** Tells `effects` where every cabin is now. A host without `enclose` lets the smoke through, as before. */
  sync(effects: EffectSink | undefined): void
  /** Ends every cabin (the module leaves). */
  clear(effects: EffectSink | undefined): void
  /** The ids followed now. */
  ids(): string[]
}

export function createCabinSmoke(): CabinSmoke {
  const tracked = new Map<string, Tracked>()
  const end = (id: string, entry: Tracked, effects: EffectSink | undefined): void => {
    if (entry.declared) effects?.enclose?.(id, null)
    tracked.delete(id)
  }
  return {
    track(id, source, frame) {
      tracked.set(id, { source, frame, declared: false, placed: false })
    },
    untrack(id, effects) {
      const entry = tracked.get(id)
      if (entry) end(id, entry, effects)
    },
    sync(effects) {
      if (!effects?.enclose) return
      for (const [id, entry] of tracked) {
        if (!entry.frame.parent) {
          // not placed yet (built, not added): wait; taken out of the scene: forget it
          if (entry.placed) end(id, entry, effects)
          continue
        }
        entry.placed = true
        const enclosure: Enclosure | null = cabinEnclosure(entry.source, { frame: entry.frame })
        if (enclosure || entry.declared) effects.enclose(id, enclosure)
        entry.declared = enclosure !== null
      }
    },
    clear(effects) {
      for (const [id, entry] of [...tracked]) end(id, entry, effects)
    },
    ids: () => [...tracked.keys()],
  }
}
