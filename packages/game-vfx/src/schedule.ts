export interface Schedule {
  /** Runs `action` once `now` reaches `time`. */
  at(time: number, action: () => void): void
  /** Runs what is due at `now`, from the last one added to the first (the Lab's L1085 and the Workshop's W1280 walk the list backwards, and so does this). */
  update(now: number): void
  clear(): void
  readonly pending: number
}

interface Entry {
  time: number
  action: () => void
}

const NOOP = (): void => {}

export function createSchedule(): Schedule {
  const entries: Entry[] = []
  const spare: Entry[] = []
  return {
    at(time, action) {
      const entry = spare.pop() ?? { time: 0, action: NOOP }
      entry.time = time
      entry.action = action
      entries.push(entry)
    },
    update(now) {
      for (let index = entries.length - 1; index >= 0; index--) {
        const entry = entries[index]
        if (!entry || entry.time > now) continue
        const action = entry.action
        entries.splice(index, 1)
        entry.action = NOOP
        spare.push(entry)
        action()
      }
    },
    clear() {
      for (const entry of entries) {
        entry.action = NOOP
        spare.push(entry)
      }
      entries.length = 0
    },
    get pending() {
      return entries.length
    },
  }
}
