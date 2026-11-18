import { WORKER_KIND_DEFAULTS, WORKER_KIND_ID } from '@adatechnology/game-contracts'
import type { ResidentKind, WorkerCoordinator } from '@adatechnology/game-contracts'
import { createFrame, frameBytes as frameBytesOf } from './frame'
import type { FrameShape, PhysicsFrame } from './frame'
import { createKernel } from './kernel'
import type { KernelSetup } from './kernel'
import type { StepRunner } from './runner'

/** What the crowd physics resident is built from, once per worker. */
export type CrowdPhysicsInit = { readonly setup: KernelSetup; readonly shape: FrameShape }

/**
 * The contact and the pressure of the crowd as a resident kind of the worker coordinator (`crowd.physics`): the kernel is built from the
 * setup once per worker, and each step is one frame buffer in, the same buffer with its outputs written back out. The kernel reads nothing
 * but the frame, so the main thread runs the same step when the worker is late (CLAUDE.md §14). A game's worker file hosts it:
 * `installWorkerHost(self, [crowdPhysicsKind, ...])`.
 */
export const crowdPhysicsKind: ResidentKind<CrowdPhysicsInit, ArrayBuffer, ArrayBuffer> = Object.freeze({
  id: WORKER_KIND_ID.CROWD_PHYSICS,
  kind: 'resident' as const,
  ...WORKER_KIND_DEFAULTS[WORKER_KIND_ID.CROWD_PHYSICS],
  create(init: CrowdPhysicsInit) {
    const kernel = createKernel(init.setup)
    return {
      step(buffer: ArrayBuffer): ArrayBuffer {
        kernel.run(createFrame(buffer, init.shape))
        return buffer
      },
    }
  },
  transferOutput: (buffer: ArrayBuffer): readonly ArrayBuffer[] => [buffer],
})

/**
 * The runner over the coordinator: the frame of step `k` is handed over in `submit` and read back at step `k + slots`, from the worker
 * when it answered by then and computed here otherwise, so the state never depends on timing and the main thread never waits.
 */
export function createCoordinatorRunner(setup: KernelSetup, shape: FrameShape, coordinator: WorkerCoordinator, slots = 1): StepRunner {
  const resident = coordinator.resident(crowdPhysicsKind, { setup, shape })
  const buffers = Array.from({ length: slots }, () => new ArrayBuffer(frameBytesOf(shape)))
  const frames = buffers.map((buffer) => createFrame(buffer, shape))
  const handles: ReturnType<typeof resident.step>[] = []
  const views = new WeakMap<ArrayBuffer, PhysicsFrame>()
  let submitted = 0
  let settled = 0
  return {
    transport: 'transfer',
    get inFlight() {
      return submitted - settled
    },
    frame: () => (submitted - settled < slots ? frames[submitted % slots]! : null),
    submit: () => {
      // the coordinator copies the buffer to the worker (the main thread keeps it for the step it may have to run itself)
      handles.push(resident.step(buffers[submitted % slots]!, { frame: submitted, latencyFrames: slots }))
      submitted++
    },
    settle: () => {
      const handle = handles.shift()
      if (!handle) return null
      settled++
      const out = handle.collect(handle.dueFrame)
      let view = views.get(out)
      if (!view) views.set(out, (view = createFrame(out, shape)))
      return view
    },
    dispose: () => resident.dispose(),
  }
}
