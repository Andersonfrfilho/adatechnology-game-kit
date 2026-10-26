import { LOADS_THEN_WORKS, RELOAD_STAGES } from './reload-stages'
import type { ReloadKind, ReloadRequest, ReloadStageId, WeaponAction } from './types'

export type ReloadableAction = Extract<WeaponAction, { kind: 'firearm' | 'launcher' }>

export interface ReloadPlan {
  readonly kind: ReloadKind
  /** Seconds per round when the weapon loads one at a time, null when the whole magazine goes in at once. */
  readonly step: number | null
  /** Seconds until the first round (or the whole magazine) is in. */
  readonly first: number
  /** Seconds of the whole reload; the stages are placed along it. */
  readonly total: number
  /** Rounds that go in one at a time (0 when the whole magazine goes in at once). */
  readonly rounds: number
  /** Seconds after the last round for the action to be worked (the pump, the lever, the charging handle of an empty tube), 0 when there is none. */
  readonly tail: number
}

/** Seconds the action takes to be worked after an empty tube is loaded when the rule gives no `timings.cycle`. */
export const ACTION_WORK_SECONDS = 0.5

export const isReloadable = (action: WeaponAction): action is ReloadableAction => action.kind === 'firearm' || action.kind === 'launcher'

const baseSeconds = (action: ReloadableAction): number => action.timings?.reload ?? action.reload

const secondsPerRound = (action: ReloadableAction): number | undefined => {
  if (action.kind !== 'firearm') return undefined
  return action.timings?.perRound ?? (action.perRound ? baseSeconds(action) : undefined)
}

const pickKind = (action: ReloadableAction, ammo: number, oneAtATime: boolean, request: ReloadRequest): ReloadKind => {
  if (action.kind === 'launcher') return action.disposable ? 'empty' : 'tactical'
  if (request === 'one_by_one' && oneAtATime) return 'one_by_one'
  if (request === 'full') return ammo === 0 ? 'empty' : 'tactical'
  if (oneAtATime && (action.family === 'revolver' || ammo > 0)) return 'one_by_one'
  return ammo === 0 ? 'empty' : 'tactical'
}

/** How a reload goes: tactical (a magazine swap), empty (with the action to work after) or one by one; `full` loads a revolver all at once with a speed loader. */
export const planReload = (action: ReloadableAction, ammo: number, capacity: number, reserve: number, request: ReloadRequest): ReloadPlan => {
  const perRound = secondsPerRound(action)
  const revolver = action.kind === 'firearm' && action.family === 'revolver'
  const oneAtATime = perRound !== undefined && request !== 'full'
  const kind = pickKind(action, ammo, oneAtATime, request)
  if (perRound !== undefined && oneAtATime && (kind === 'one_by_one' || (kind === 'empty' && action.kind === 'firearm' && !revolver))) {
    const rounds = Math.max(1, Math.min(capacity - ammo, reserve))
    const loading = rounds * perRound
    const works = kind === 'empty' && action.kind === 'firearm' && action.family !== undefined && LOADS_THEN_WORKS.has(action.family)
    // the closing stage sits at a fraction of the reload (the tables, 0.87 to 0.89): the work of the action is never shorter than what puts that stage after the last round
    const closingAt = works && action.family ? RELOAD_STAGES[action.family].empty.find((entry) => entry.stage !== 'round_in')?.at ?? 0.88 : 0.88
    const tail = works ? Math.max(action.timings?.cycle ?? ACTION_WORK_SECONDS, (loading * (1 - closingAt)) / closingAt) : 0
    return { kind, step: perRound, first: perRound, total: loading + tail, rounds, tail }
  }
  const seconds = kind === 'empty' ? action.timings?.reloadEmpty ?? baseSeconds(action) : baseSeconds(action)
  return { kind, step: null, first: seconds, total: seconds, rounds: 0, tail: 0 }
}

/** The steps of a reload with the time they happen, scaled to the duration of this weapon's reload. */
export const reloadStages = (action: ReloadableAction, plan: ReloadPlan, startAt: number): { stage: ReloadStageId; at: number }[] => {
  if (!action.family) return []
  return RELOAD_STAGES[action.family][plan.kind].map((entry) => ({ stage: entry.stage, at: startAt + entry.at * plan.total }))
}
