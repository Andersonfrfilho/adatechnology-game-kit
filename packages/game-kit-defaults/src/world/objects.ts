/** What changed in the registry: an object came in or left, or the player's hands took or let go of one. */
export type ObjectRegistryEvent<TRecord> = {
  readonly kind: 'added' | 'removed' | 'held' | 'released'
  readonly id: string
  readonly record: TRecord
}

export type ObjectRegistryListener<TRecord> = (event: ObjectRegistryEvent<TRecord>) => void

/**
 * The objects of a world by id, the one list the world's rules and the player's actions read (spec 011, `design-host.md` §6). It answers like
 * a `Map` (a host that kept a `Map` swaps it for this one) and also knows which object is in the player's hands. The record is the host's.
 */
export type ObjectRegistry<TRecord> = {
  get(id: string): TRecord | undefined
  has(id: string): boolean
  /** Puts the record under `id`, replacing what was there (a replaced record that was held is let go first). */
  set(id: string, record: TRecord): ObjectRegistry<TRecord>
  /** Takes the object out; a held object is let go first. Returns whether there was one. */
  delete(id: string): boolean
  values(): IterableIterator<TRecord>
  keys(): IterableIterator<string>
  readonly size: number
  /** The object in the player's hands, or null. */
  readonly held: TRecord | null
  readonly heldId: string | null
  /** Takes the object `id` in the hands (the one held before is let go); an id the registry does not know leaves the hands empty. */
  hold(id: string): TRecord | null
  /** Lets go of what is held; nothing when the hands are empty. */
  release(): void
  /** Every change from now on; returns the way to stop listening. */
  on(listener: ObjectRegistryListener<TRecord>): () => void
}

export function createObjectRegistry<TRecord>(): ObjectRegistry<TRecord> {
  const records = new Map<string, TRecord>()
  const listeners = new Set<ObjectRegistryListener<TRecord>>()
  let heldId: string | null = null

  const emit = (kind: ObjectRegistryEvent<TRecord>['kind'], id: string, record: TRecord): void => {
    for (const listener of [...listeners]) listener({ kind, id, record })
  }

  const release = (): void => {
    if (heldId === null) return
    const id = heldId
    heldId = null
    const record = records.get(id)
    if (record !== undefined) emit('released', id, record)
  }

  const registry: ObjectRegistry<TRecord> = {
    get: (id) => records.get(id),
    has: (id) => records.has(id),
    set(id, record) {
      const before = records.get(id)
      if (before !== undefined) {
        if (heldId === id) release()
        records.delete(id)
        emit('removed', id, before)
      }
      records.set(id, record)
      emit('added', id, record)
      return registry
    },
    delete(id) {
      const record = records.get(id)
      if (record === undefined) return false
      if (heldId === id) release()
      records.delete(id)
      emit('removed', id, record)
      return true
    },
    values: () => records.values(),
    keys: () => records.keys(),
    get size() {
      return records.size
    },
    get held() {
      return heldId === null ? null : (records.get(heldId) ?? null)
    },
    get heldId() {
      return heldId
    },
    hold(id) {
      release()
      const record = records.get(id)
      if (record === undefined) return null
      heldId = id
      emit('held', id, record)
      return record
    },
    release,
    on(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return registry
}
