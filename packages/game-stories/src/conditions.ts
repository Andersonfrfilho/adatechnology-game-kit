import type { Actions, Condition, Flags, ResolvedChange, StateId, States } from './types'

/** What a condition is read against. `cast` turns a role into the id of the person who plays it. */
export type ConditionContext = {
  readonly states: States
  readonly flags: Flags
  readonly actions: Actions
  readonly cast: (role: string) => string
  /** The states that count as living (the team's `LIVE`). */
  readonly living: readonly StateId[]
  readonly values?: Readonly<Record<string, string | null>>
  /** Inside an `each`: the person being listed. */
  readonly self?: string
  readonly changes?: readonly ResolvedChange[]
  /** Whether a person's sheet keeps that entry (the casting and the stories use what each one lived). */
  readonly remembers?: (id: string, entry: string) => boolean
}

const stateOf = (context: ConditionContext, role: string): StateId | undefined => context.states[context.cast(role)]?.state

/** Evaluates a condition (see `Condition`). An unknown person is neither living nor in any state. */
export function holds(condition: Condition, context: ConditionContext): boolean {
  if ('all' in condition) return condition.all.every((c) => holds(c, context))
  if ('any' in condition) return condition.any.some((c) => holds(c, context))
  if ('not' in condition) return !holds(condition.not, context)
  if ('action' in condition) return Boolean(context.actions[condition.action])
  if ('flag' in condition) return Boolean(context.flags[condition.flag])
  if ('state' in condition) {
    const state = stateOf(context, condition.state)
    return state !== undefined && (typeof condition.is === 'string' ? state === condition.is : condition.is.includes(state))
  }
  if ('living' in condition) {
    const state = stateOf(context, condition.living)
    return state !== undefined && context.living.includes(state)
  }
  if ('base' in condition) return context.states[context.cast(condition.base)]?.base === condition.is
  if ('value' in condition) return Boolean(context.values?.[condition.value])
  if ('self' in condition) return context.self === context.cast(condition.self)
  if ('changed' in condition) return (context.changes ?? []).some((change) => change.id === context.cast(condition.changed))
  if ('remembers' in condition) return context.remembers?.(context.cast(condition.remembers), condition.entry) ?? false
  return false
}
