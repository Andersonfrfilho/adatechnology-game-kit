import { WORKER_KIND_DEFAULTS, WORKER_KIND_ID } from '@adatechnology/game-contracts'
import type { ResidentHandle, ResidentKind, TaskHandle, WorkerCoordinator } from '@adatechnology/game-contracts'
import { createFrame, frameBytes as frameBytesOf } from './frame'
import type { FrameShape, PhysicsFrame } from './frame'
import { createKernel } from './kernel'
import type { KernelSetup } from './kernel'
import type { StepRunner } from './runner'

/** What the crowd physics resident is built from, once per worker. */
export type CrowdPhysicsInit = { readonly setup: KernelSetup; readonly shape: FrameShape; /** The grid bytes of every step, when the frames travel without them (`shape.cells` 0). */ readonly occupancy?: Uint8Array }

/** The grid whose bytes the runner keeps with the resident instead of copying them into every step: a new `version` means a new resident. */
export type OccupancySource = { readonly occ: Uint8Array; readonly version: number }

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
        kernel.run(createFrame(buffer, init.shape, init.occupancy))
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
export function createCoordinatorRunner(setup: KernelSetup, shape: FrameShape, coordinator: WorkerCoordinator, slots = 1, grid?: OccupancySource): StepRunner {
  // with a grid the steps go without it: the occupancy sits in the resident (a copy, so a step computed here or there reads the same bytes) and a write to the grid replaces the resident
  const frameShape: FrameShape = grid ? { capacity: shape.capacity, cells: 0 } : shape
  type Owner = { readonly resident: ResidentHandle<ArrayBuffer, ArrayBuffer>; pending: number; retired: boolean }
  const open = (): Owner => {
    const occupancy = grid?.occ.slice()
    return { resident: coordinator.resident(crowdPhysicsKind, { setup, shape: frameShape, ...(occupancy ? { occupancy } : {}) }), pending: 0, retired: false }
  }
  let current = open()
  let version = grid?.version ?? 0
  const buffers = Array.from({ length: slots }, () => new ArrayBuffer(frameBytesOf(frameShape)))
  const frames = buffers.map((buffer) => createFrame(buffer, frameShape))
  const handles: { readonly handle: TaskHandle<ArrayBuffer>; readonly owner: Owner }[] = []
  const views = new WeakMap<ArrayBuffer, PhysicsFrame>()
  let submitted = 0
  let settled = 0
  // a retired resident is disposed once every step it was handed has been taken back
  const release = (owner: Owner): void => {
    if (owner.retired && owner.pending === 0) owner.resident.dispose()
  }
  return {
    transport: 'transfer',
    get inFlight() {
      return submitted - settled
    },
    frame: () => (submitted - settled < slots ? frames[submitted % slots]! : null),
    submit: () => {
      if (grid && grid.version !== version) {
        version = grid.version
        current.retired = true
        release(current)
        current = open()
      }
      // the coordinator copies the buffer to the worker (the main thread keeps it for the step it may have to run itself)
      const owner = current
      owner.pending++
      handles.push({ handle: owner.resident.step(buffers[submitted % slots]!, { frame: submitted, latencyFrames: slots }), owner })
      submitted++
    },
    settle: () => {
      const next = handles.shift()
      if (!next) return null
      settled++
      const out = next.handle.collect(next.handle.dueFrame)
      next.owner.pending--
      release(next.owner)
      let view = views.get(out)
      if (!view) views.set(out, (view = createFrame(out, frameShape)))
      return view
    },
    dispose: () => {
      current.resident.dispose()
      for (const { owner } of handles) owner.resident.dispose()
    },
  }
}
