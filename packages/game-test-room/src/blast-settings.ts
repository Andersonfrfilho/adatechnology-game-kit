import type { BlastOptions } from '@adatechnology/game-destruction'

import type { BlastSummary } from './explosives'

/** The switches of the room's blasts the HUD toggles. */
export type BlastSwitch = 'shelter' | 'fragmentHits' | 'confinement'

export type BlastSettings = {
  /** The blast options every explosion of the room starts with. */
  readonly options: () => BlastOptions
  /** Merges `next` into them (`TestRoom.setBlast`). */
  readonly set: (next: BlastOptions) => void
  readonly isOn: (key: BlastSwitch) => boolean
  readonly toggle: (key: BlastSwitch) => void
  /** What the last blast with a report did (the room's metrics read it). */
  readonly last: () => BlastSummary | undefined
  readonly blasted: (summary: BlastSummary) => void
}

/** The blast options of the room's explosions (the HUD toggles them) and what the last blast did. */
export function createBlastSettings(initial: BlastOptions | undefined): BlastSettings {
  let options: BlastOptions = { ...initial }
  let last: BlastSummary | undefined
  const isOn = (key: BlastSwitch): boolean => Boolean(options[key])
  return {
    options: () => options,
    set(next) {
      options = { ...options, ...next }
    },
    isOn,
    toggle(key) {
      options = { ...options, [key]: !isOn(key) }
    },
    last: () => last,
    blasted(summary) {
      last = summary
    },
  }
}
