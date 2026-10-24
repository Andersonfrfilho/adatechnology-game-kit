import type { ResolvedChange, StateId, States } from '../types'

/** The states nothing changes back: the dead, and those who left the world. */
export const FINAL_STATES: readonly StateId[] = ['dead', 'left']

/**
 * Applies a beat's changes (Os Vivos do Vale `apply`, lines 741-743): the dead and the gone do not come back, the undead only die; a change to the
 * player's party with no base moves the person to `playerBase`; otherwise the base stays unless the change names one.
 */
export function applyChanges(states: States, changes: readonly ResolvedChange[] | undefined, playerBase: string): void {
  for (const { id, state, note, base } of changes ?? []) {
    const current = states[id]
    if (!current) continue
    if (FINAL_STATES.includes(current.state)) continue
    if (current.state === 'undead' && state !== 'dead') continue
    states[id] = { state, note, base: base || (state === 'party' ? playerBase : current.base) }
  }
}

/** The life simulation's own change (`life`'s `set`, line 630): the same guard, the base kept unless one is given. */
export function setState(states: States, id: string, state: StateId, note: string, base?: string): void {
  const current = states[id]!
  if (FINAL_STATES.includes(current.state) || (current.state === 'undead' && state !== 'dead')) return
  states[id] = { state, note, base: base || current.base }
}
