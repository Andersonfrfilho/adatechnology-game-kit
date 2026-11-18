import { WORKER_KIND_DEFAULTS, WORKER_LANES, WORKER_LATE_RULES } from '@adatechnology/game-contracts'
import type { ResidentKind, TaskKind, WorkerKindSchedule } from '@adatechnology/game-contracts'

const ID = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/

/** Checks a schedule: a known lane and rule, `sync` on the `sim` lane (its result is read in a fixed frame), a whole latency >= 1. */
export function checkSchedule(id: string, schedule: WorkerKindSchedule): void {
  if (!WORKER_LANES.includes(schedule.lane)) throw new Error(`worker kind ${id}: unknown lane "${schedule.lane}"`)
  if (!WORKER_LATE_RULES.includes(schedule.late)) throw new Error(`worker kind ${id}: unknown late rule "${schedule.late}"`)
  if (schedule.lane === 'sim' && schedule.late !== 'sync') throw new Error(`worker kind ${id}: the sim lane needs late "sync" (its result is applied in a fixed frame)`)
  if (!Number.isFinite(schedule.priority)) throw new Error(`worker kind ${id}: priority must be a number`)
  const latency = schedule.latencyFrames ?? 1
  if (!Number.isInteger(latency) || latency < 1) throw new Error(`worker kind ${id}: latencyFrames must be a whole number >= 1`)
}

const checkId = (id: string): void => {
  if (!ID.test(id)) throw new Error(`worker kind "${id}": the id is "package.thing" in lowercase (destruction.ground-tiles)`)
}

/** The schedule a kit kind declares by default, by id (`WORKER_KIND_DEFAULTS`); `undefined` for a game's own kind. */
export const kitScheduleOf = (id: string): WorkerKindSchedule | undefined => (WORKER_KIND_DEFAULTS as Readonly<Record<string, WorkerKindSchedule>>)[id]

/**
 * A task kind, checked: the id, the lane and the late rule. The kit's kinds take their schedule from `WORKER_KIND_DEFAULTS`.
 *
 * ```ts
 * export const pathfinding = defineTaskKind<PathInput, PathOutput>({ id: 'mygame.pathfinding', lane: 'sim', priority: 180, latencyFrames: 2, late: 'sync', run: aStar })
 * ```
 */
export function defineTaskKind<In, Out>(kind: Omit<TaskKind<In, Out>, 'kind'>): TaskKind<In, Out> {
  checkId(kind.id)
  checkSchedule(kind.id, kind)
  return Object.freeze({ ...kind, kind: 'task' as const })
}

/** A resident kind, checked as `defineTaskKind`. */
export function defineResidentKind<Init, Step, Result>(kind: Omit<ResidentKind<Init, Step, Result>, 'kind'>): ResidentKind<Init, Step, Result> {
  checkId(kind.id)
  checkSchedule(kind.id, kind)
  return Object.freeze({ ...kind, kind: 'resident' as const })
}
