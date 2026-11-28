/**
 * The locks of the leaves in the room (doors, lids, car doors): a leaf locked only rattles when E pulls it. A whole object locks under the part `*`; a key turned in a lock
 * (the hand use `turn_key`) locks the leaf it reached, or opens it and every lock of its object.
 */
import type { KeyTurn } from './hand-tool-use'

export type LeafLocks = {
  isLocked(objectId: string, part: string): boolean
  /** Locks (or unlocks) a leaf, or the whole object when `part` is left out. */
  set(objectId: string, locked: boolean, part?: string): void
  /** A key turned in the lock of `leaf` (none: in the air): locked leaves open, open ones lock. */
  turn(leaf: { readonly objectId: string; readonly part: string; readonly locked: boolean } | null): KeyTurn
}

export const createLeafLocks = (): LeafLocks => {
  const locked = new Set<string>()
  const keyOf = (objectId: string, part: string): string => `${objectId}\0${part}`
  const set = (objectId: string, on: boolean, part = '*'): void => {
    if (on) locked.add(keyOf(objectId, part))
    else locked.delete(keyOf(objectId, part))
  }
  return {
    isLocked: (objectId, part) => locked.has(keyOf(objectId, '*')) || locked.has(keyOf(objectId, part)),
    set,
    turn(leaf) {
      if (!leaf) return 'air'
      set(leaf.objectId, false)
      set(leaf.objectId, !leaf.locked, leaf.part)
      return leaf.locked ? 'unlocked' : 'locked'
    },
  }
}
