type Entry = { readonly id: string }

/** The shipped entries with the ones from `extra` added or, when the id exists, replaced. */
export const mergeById = <TEntry extends Entry>(shipped: readonly TEntry[], extra: readonly TEntry[] | undefined): Map<string, TEntry> => {
  const entries = new Map<string, TEntry>()
  for (const entry of [...shipped, ...(extra ?? [])]) entries.set(entry.id, entry)
  return entries
}

/** Applies `patch` by id (a shallow merge); a patch for an id that does not exist is ignored. */
export const applyPatches = <TEntry extends Entry>(entries: Map<string, TEntry>, patches: Readonly<Record<string, Partial<TEntry>>> | undefined): void => {
  for (const [id, patch] of Object.entries(patches ?? {})) {
    const entry = entries.get(id)
    if (entry) entries.set(id, { ...entry, ...patch, id })
  }
}

export const removeIds = (entries: Map<string, unknown>, ids: readonly string[] | undefined): void => {
  for (const id of ids ?? []) entries.delete(id)
}
