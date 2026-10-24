import { nominalFuse } from './fuse'
import { deepMerge } from './merge'
import type { DeepPartial, ExplosiveDef, WeaponDef } from './types'

type Entry = { readonly id: string }

/** The shipped entries with the ones from `extra` added or, when the id exists, replaced. */
export const mergeById = <TEntry extends Entry>(shipped: readonly TEntry[], extra: readonly TEntry[] | undefined): Map<string, TEntry> => {
  const entries = new Map<string, TEntry>()
  for (const entry of [...shipped, ...(extra ?? [])]) entries.set(entry.id, entry)
  return entries
}

/** Applies `patch` by id; a patch for an id that does not exist is ignored. */
export const applyPatches = <TEntry extends Entry>(entries: Map<string, TEntry>, patches: Readonly<Record<string, DeepPartial<TEntry> | Partial<TEntry>>> | undefined): void => {
  for (const [id, patch] of Object.entries(patches ?? {})) {
    const entry = entries.get(id)
    if (entry) entries.set(id, deepMerge(entry, patch))
  }
}

export const removeIds = (entries: Map<string, unknown>, ids: readonly string[] | undefined): void => {
  for (const id of ids ?? []) entries.delete(id)
}

/** A throwable that names an explosive takes its energy, noise, lethal radius, fuse (the nominal one, when it is sampled per throw) and fire from it, so changing the explosive changes the throwable. */
export const resolveThrowables = (weapons: Map<string, WeaponDef>, explosives: ReadonlyMap<string, ExplosiveDef>): void => {
  for (const [id, def] of weapons) {
    if (def.action.kind !== 'throwable' || def.action.explosive === undefined) continue
    const explosive = explosives.get(def.action.explosive)
    if (!explosive) continue
    const radius = explosive.lethalRadius > 0 ? explosive.lethalRadius : def.action.radius
    const fire = explosive.fire ? { ...explosive.fire } : def.action.fire
    weapons.set(id, { ...def, action: { ...def.action, energy: explosive.energy, noise: explosive.noise, radius, fuse: nominalFuse(explosive) ?? def.action.fuse, ...(fire ? { fire } : {}) } })
  }
}
