import { RELOAD_STAGES } from './reload-stages'
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
}

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
  const oneAtATime = perRound !== undefined && request !== 'full'
  const kind = pickKind(action, ammo, oneAtATime, request)
  if (kind === 'one_by_one' && perRound !== undefined) {
    const rounds = Math.max(1, Math.min(capacity - ammo, reserve))
    return { kind, step: perRound, first: perRound, total: rounds * perRound }
  }
  const seconds = kind === 'empty' ? action.timings?.reloadEmpty ?? baseSeconds(action) : baseSeconds(action)
  return { kind, step: null, first: seconds, total: seconds }
}

/** The steps of a reload with the time they happen, scaled to the duration of this weapon's reload. */
export const reloadStages = (action: ReloadableAction, plan: ReloadPlan, startAt: number): { stage: ReloadStageId; at: number }[] => {
  if (!action.family) return []
  return RELOAD_STAGES[action.family][plan.kind].map((entry) => ({ stage: entry.stage, at: startAt + entry.at * plan.total }))
}
