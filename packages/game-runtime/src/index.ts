/**
 * @adatechnology/game-runtime: the owner of the frame. A phased scheduler with a fixed simulation step and one time budget shared by every deferred
 * queue of the kit. L1: no three.js, and no DOM unless `startLoop` runs on a page.
 */
export { DEFERRED_PRIORITY, FRAME_PHASES } from '@adatechnology/game-contracts'
export type { DeferredQueue, DeferredQueueOptions, FramePhase } from '@adatechnology/game-contracts'
export { createFrameBudget } from './budget'
export type { FrameBudgetOptions } from './budget'
export { COMMAND_SYSTEM_ORDER, createCommandBuffer } from './commands'
export { startLoop } from './loop'
export { createScheduler } from './scheduler'
export type {
  BudgetStats,
  Command,
  CommandBuffer,
  FrameBudget,
  FrameContext,
  FrameRunOptions,
  LoopOptions,
  QueueStats,
  Scheduler,
  SchedulerOptions,
  SchedulerStats,
  SystemFn,
  SystemOptions,
} from './types'
