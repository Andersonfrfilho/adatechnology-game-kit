import type * as THREE_NS from 'three'

import type { FramePhase } from '@adatechnology/game-contracts'
import { createScheduler } from '@adatechnology/game-runtime'
import type { Scheduler, SchedulerOptions, SystemFn } from '@adatechnology/game-runtime'

import type { KitWorldRenderer } from './destruction'
import { createBlastPacing } from './blast-pacing'
import type { BlastPacing, BlastPacingOptions } from './blast-pacing'
import { DEFAULT_FRAME_TARGET_MS, registerFrameQueues } from './frame-queues'
import type { FrameQueuesParams } from './frame-queues'
import type { KitWorldRenderBudget } from './render-budget'
import { MAX_TICKS_PER_FRAME, registerSimulationPhases, resolveSimulationTick } from './simulation-phases'
import type { SimulationPhases } from './simulation-phases'
import type { FrameSlot, FrameSlotSystem, StepSystem, WorldStep } from './world-step'

/** The step the room has always run: 1/60 s, which is two steps of the 1/120 s physics world. */
const FIXED_DT = 1 / 60
/** The clamp the loop always had: a frame is never simulated for more than this. */
const MAX_FRAME_SECONDS = 0.05

export type FrameErrorHandler = NonNullable<SchedulerOptions['onError']>

export type KitWorldFrameOptions = {
  /** Milliseconds of every frame the deferred queues share (default 8). */
  readonly budgetMs?: number
  /** Frame deadline in ms for the deferred queues (default: the player's FPS cap, else 1000 / 60). */
  readonly targetMs?: number
  /** A system that throws (default: logged once per system id, the frame goes on). */
  readonly onError?: FrameErrorHandler
}

/** Where a system the host registered runs: `room.*` ids are the host's, the rest the game's. */
export type SystemRecord = { readonly id: string; readonly phase: FramePhase; readonly order: number }

export type KitWorldFrame = {
  readonly scheduler: Scheduler
  /** The blast pacer of the explosives, or undefined when pacing is off. Born before the scheduler: its `holdFixed` reads it. */
  readonly blastPacing: BlastPacing | undefined
  /** The tick the simulation advances by, seconds. */
  readonly tick: number
  /** Times the world's step repeats (`fastForward`): fire only in the first. Changes at game time. */
  repeat: number
  /** A system on the host's scheduler: the phase and order are the game's choice; at a tie the order of registration wins. */
  add(system: SystemFn, options: { readonly phase: FramePhase; readonly order?: number; readonly id: string }): () => void
  /** Inside the one `room.simulate` entry (`fixedSimulate`, 1000), before the world's own step, in the order they came. */
  beforeWorld(system: StepSystem): () => void
  /** The same entry, after the world's own step. */
  afterWorld(system: StepSystem): () => void
  /** Inside `room.simulate-frame` or `room.simulate-end`, at the named place (`FRAME_SLOTS`), in the order they came. */
  on(slot: FrameSlot, system: FrameSlotSystem): () => void
  /** Every system registered on the scheduler so far, in registration order. */
  systems(): readonly SystemRecord[]
  /** Runs a synchronous frame; a live one (the display loop's clock) always takes the tick path, a `dt` that is not a tick keeps the legacy one. */
  runAt: SimulationPhases['runAt']
}

export type FrameDeps = {
  readonly options: KitWorldFrameOptions | undefined
  readonly blastPacing: BlastPacingOptions | false | undefined
  readonly world: Parameters<typeof createBlastPacing>[0]['world']
  readonly renderer: KitWorldRenderer
  readonly physicsStep: number | undefined
  readonly queues: Omit<FrameQueuesParams, 'budget' | 'destruction' | 'hasWorkBudget'>
  readonly hasWorkBudget: boolean
  readonly step: WorldStep
  readonly camera: THREE_NS.Camera
  readonly budget: KitWorldRenderBudget
}

export function createFrame(deps: FrameDeps): KitWorldFrame {
  const { renderer, step, camera } = deps
  const blastPacing = deps.blastPacing === false ? undefined : createBlastPacing({ options: deps.blastPacing ?? {}, world: deps.world, renderer })
  const tick = resolveSimulationTick({ loopStep: deps.physicsStep, nominalTick: FIXED_DT })
  const scheduler = createScheduler({
    fixedDt: tick,
    maxSubsteps: MAX_TICKS_PER_FRAME,
    maxFrameSeconds: MAX_FRAME_SECONDS,
    budgetMs: deps.options?.budgetMs ?? 8,
    targetMs: deps.options?.targetMs ?? DEFAULT_FRAME_TARGET_MS,
    ...(deps.options?.onError ? { onError: deps.options.onError } : {}),
    holdFixed: () => blastPacing?.isHolding() === true,
  })
  registerFrameQueues({ ...deps.queues, budget: scheduler.budget, destruction: renderer, hasWorkBudget: deps.hasWorkBudget })
  const records: SystemRecord[] = []
  const add: KitWorldFrame['add'] = (system, options) => {
    const record: SystemRecord = { id: options.id, phase: options.phase, order: options.order ?? 0 }
    records.push(record)
    const remove = scheduler.add(system, options)
    return () => {
      remove()
      const index = records.indexOf(record)
      if (index >= 0) records.splice(index, 1)
    }
  }
  const phases = registerSimulationPhases({ scheduler: { add }, tick, hooks: { fixed: step.fixed, frame: step.frame, frameEnd: step.frameEnd, pose: renderer, structural: renderer, blastPacing } })
  add((ctx) => deps.budget.lights.present([camera.position.x, camera.position.y, camera.position.z], ctx.realDt), { phase: 'present', order: 10, id: 'room.lights' })
  const frame: KitWorldFrame = {
    scheduler,
    blastPacing,
    tick,
    get repeat() {
      return step.repeat
    },
    set repeat(value) {
      step.repeat = value
    },
    add,
    beforeWorld(system) {
      step.beforeWorld.add(system)
      return () => step.beforeWorld.delete(system)
    },
    afterWorld(system) {
      step.afterWorld.add(system)
      return () => step.afterWorld.delete(system)
    },
    on: step.onSlot,
    systems: () => records,
    runAt: phases.runAt,
  }
  return frame
}
