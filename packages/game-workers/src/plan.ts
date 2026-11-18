import type { WorkerLane } from '@adatechnology/game-contracts'

export interface LaneOptions {
  /** Workers of this lane (default: the automatic split). */
  readonly workers?: number
  /** `build` only: its idle workers take `sim` jobs (default true). */
  readonly borrow?: boolean
}

export interface WorkerPlanOptions {
  /** `'auto'` (default): `cores - 1 - reserveCores`, at most `maxWorkers`. A number: exactly that many. 0: everything on the main thread. */
  readonly workers?: 'auto' | number
  /** Ceiling of the automatic count (default 8). */
  readonly maxWorkers?: number
  /** Cores others use (Jolt's job threads, an audio worklet): the automatic count leaves them free. */
  readonly reserveCores?: number
  readonly lanes?: Partial<Readonly<Record<WorkerLane, LaneOptions>>>
}

export interface WorkerPlan {
  readonly total: number
  readonly lanes: Readonly<Record<WorkerLane, number>>
  /** For each worker, by index, the lane it belongs to. */
  readonly homes: readonly WorkerLane[]
  /** For each worker, by index, the lanes it takes jobs from, in order (a `build` worker takes `sim` jobs first: they have a deadline). */
  readonly serves: readonly (readonly WorkerLane[])[]
}

export const DEFAULT_MAX_WORKERS = 8

/** The cores of this machine, or 1 where the runtime does not say. */
export function hardwareCores(): number {
  const n = (globalThis as { navigator?: { hardwareConcurrency?: number } }).navigator?.hardwareConcurrency
  return typeof n === 'number' && n > 0 ? n : 1
}

const whole = (n: number): number => Math.max(0, Math.floor(n))

/**
 * How many workers and which lanes each one serves. Automatic: `cores - 1 - reserveCores` workers (the main thread keeps a core), at most
 * `maxWorkers`; the `sim` lane takes a third rounded up (1 to 3), `background` gets its own worker from 6 on, `build` the rest. One worker
 * serves every lane. A `build` worker takes `sim` jobs first (they have a deadline), then its own, then `background` when that lane has
 * none of its own; a `background` worker never takes `sim` jobs, so the far world never delays a frame.
 */
export function planWorkers(options: WorkerPlanOptions = {}, cores = hardwareCores()): WorkerPlan {
  const max = whole(options.maxWorkers ?? DEFAULT_MAX_WORKERS)
  const asked = options.workers ?? 'auto'
  const total = asked === 'auto' ? Math.min(max, whole(cores - 1 - (options.reserveCores ?? 0))) : whole(asked)
  const fixed = options.lanes ?? {}
  let sim: number
  let background: number
  if (total <= 1) {
    sim = total
    background = 0
  } else {
    sim = Math.min(3, Math.max(1, Math.ceil(total / 3)))
    background = total >= 6 ? 1 : 0
  }
  if (fixed.sim?.workers !== undefined) sim = whole(fixed.sim.workers)
  if (fixed.background?.workers !== undefined) background = whole(fixed.background.workers)
  let build = fixed.build?.workers !== undefined ? whole(fixed.build.workers) : Math.max(0, total - sim - background)
  // lanes given by hand win over the total; the automatic split never goes over it
  if (fixed.sim?.workers === undefined && fixed.build?.workers === undefined && fixed.background?.workers === undefined) build = total - sim - background
  const count = sim + build + background
  const borrow = fixed.build?.borrow !== false
  const serves: WorkerLane[][] = []
  for (let i = 0; i < sim; i++) serves.push(['sim', ...(build === 0 ? (['build'] as const) : []), ...(build === 0 && background === 0 ? (['background'] as const) : [])])
  for (let i = 0; i < build; i++) serves.push([...(borrow ? (['sim'] as const) : []), 'build', ...(background === 0 ? (['background'] as const) : [])])
  for (let i = 0; i < background; i++) serves.push(['background'])
  const homes: WorkerLane[] = [...Array<WorkerLane>(sim).fill('sim'), ...Array<WorkerLane>(build).fill('build'), ...Array<WorkerLane>(background).fill('background')]
  return { total: count, lanes: { sim, build, background }, homes, serves }
}
