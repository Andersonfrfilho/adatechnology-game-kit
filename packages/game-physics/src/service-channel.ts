/** A set of values the modules of one host lend each other (the crowd's agents, for the cars that run them over), whichever of them attaches first. */
export interface ServiceChannel<TValue> {
  /** What is published now, in publication order. */
  readonly values: readonly TValue[]
  /** Adds `value` and tells the listeners; returns the way to take it out again. */
  publish(value: TValue): () => void
  /** Told after every change of `values`; returns the way to stop. */
  onChange(listener: () => void): () => void
}

export const createServiceChannel = <TValue>(): ServiceChannel<TValue> => {
  const values: TValue[] = []
  const listeners = new Set<() => void>()
  const tell = (): void => {
    for (const listener of [...listeners]) listener()
  }
  return {
    values,
    publish: (value) => {
      values.push(value)
      tell()
      return () => {
        const at = values.indexOf(value)
        if (at < 0) return
        values.splice(at, 1)
        tell()
      }
    },
    onChange: (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}
