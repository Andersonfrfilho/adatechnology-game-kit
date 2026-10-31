import type { FramePhase } from '@adatechnology/game-contracts'
import type { SystemFn } from './types'

export interface SystemEntry {
  readonly id: string
  readonly phase: FramePhase
  readonly fn: SystemFn
  readonly order: number
  dead: boolean
}

/** Systems of one phase sorted by `order` and then by registration, kept sorted by insertion. A system added while a frame runs waits for the next one. */
export interface SystemList {
  add(entry: SystemEntry): void
  remove(entry: SystemEntry): void
  /** The live entries; the array is never replaced while the phase runs. */
  readonly entries: readonly SystemEntry[]
  /** Called at the end of a phase: takes in the pending additions and drops the removed. */
  settle(): void
}

export function createSystemList(isRunning: () => boolean): SystemList {
  let entries: SystemEntry[] = []
  const waiting: SystemEntry[] = []
  const insert = (entry: SystemEntry): void => {
    let index = entries.length
    while (index > 0 && (entries[index - 1] as SystemEntry).order > entry.order) index--
    entries.splice(index, 0, entry)
  }
  return {
    add(entry) {
      if (isRunning()) waiting.push(entry)
      else insert(entry)
    },
    remove(entry) {
      entry.dead = true
      if (!isRunning()) entries = entries.filter((candidate) => candidate !== entry)
    },
    get entries() {
      return entries
    },
    settle() {
      if (entries.some((entry) => entry.dead)) entries = entries.filter((entry) => !entry.dead)
      for (const entry of waiting.splice(0)) if (!entry.dead) insert(entry)
    },
  }
}
