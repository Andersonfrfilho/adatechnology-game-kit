import { createFrame, frameBytes } from './frame'
import type { FrameShape, PhysicsFrame } from './frame'
import { createKernel } from './kernel'
import type { KernelSetup } from './kernel'
import type { OffloadTransport, PhysicsWorkerFactory } from './types'
import { CONTROL } from './worker-host'
import type { DoneMessage, FrameMessage, InitMessage } from './worker-host'

/** A ring of `slots` frames: the main thread writes the next step into a free one, submits it, and takes the oldest submitted one back when it is done. */
export type StepRunner = {
  readonly transport: OffloadTransport
  /** The frame to write the inputs of the next step into; `null` when every frame is out (all in flight, or with the worker in the transfer transport). */
  frame(): PhysicsFrame | null
  /** Sends the frame `frame()` gave. */
  submit(): void
  /** Frames submitted and not yet taken back. */
  readonly inFlight: number
  /**
   * The oldest submitted frame with its outputs, and it is free again for `frame()` once they are read; `null` when it is not back yet. The shared and inline transports wait for
   * it (the worker computes in step with the main thread, so the answer never depends on timing); the transfer transport cannot wait for an event, so it answers when it can.
   */
  settle(): PhysicsFrame | null
  dispose(): void
}

const WAIT_LIMIT_MS = 5000

const canBlock = (() => {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 1, 0)
    return true
  } catch {
    return false
  }
})()

export const isSharedAvailable = (): boolean => typeof SharedArrayBuffer !== 'undefined' && (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated !== false

/** The same protocol and the same kernel on the calling thread: the result is computed at `submit` and read at `settle`. */
export function createInlineRunner(setup: KernelSetup, shape: FrameShape, slots = 1): StepRunner {
  const kernel = createKernel(setup)
  const frames = Array.from({ length: slots }, () => createFrame(new ArrayBuffer(frameBytes(shape)), shape))
  let submitted = 0
  let settled = 0
  const runner = {
    transport: 'inline' as const,
    get inFlight() {
      return submitted - settled
    },
    frame: () => (submitted - settled < slots ? frames[submitted % slots]! : null),
    submit: () => kernel.run(frames[submitted++ % slots]!),
    settle: () => (submitted > settled ? frames[settled++ % slots]! : null),
    dispose: () => undefined,
  }
  return runner
}

export function createSharedRunner(setup: KernelSetup, shape: FrameShape, factory: PhysicsWorkerFactory, slots = 1): StepRunner {
  const buffers = Array.from({ length: slots }, () => new SharedArrayBuffer(frameBytes(shape)))
  const control = new Int32Array(new SharedArrayBuffer(4 * slots))
  const frames = buffers.map((buffer) => createFrame(buffer, shape))
  const worker = factory()
  worker.postMessage({ type: 'init', setup, shape, frames: buffers, control: control.buffer as SharedArrayBuffer } satisfies InitMessage)
  let submitted = 0
  let settled = 0
  return {
    transport: 'shared',
    get inFlight() {
      return submitted - settled
    },
    frame: () => (submitted - settled < slots ? frames[submitted % slots]! : null),
    submit: () => {
      const slot = submitted++ % slots
      Atomics.store(control, slot, CONTROL.SUBMITTED)
      Atomics.notify(control, slot)
    },
    settle: () => {
      if (submitted === settled) return null
      const slot = settled++ % slots
      const started = Date.now()
      while (Atomics.load(control, slot) !== CONTROL.DONE) {
        if (Date.now() - started > WAIT_LIMIT_MS) throw new Error('crowd physics worker did not answer')
        if (canBlock) Atomics.wait(control, slot, CONTROL.SUBMITTED, 50)
      }
      Atomics.store(control, slot, CONTROL.IDLE)
      return frames[slot]!
    },
    dispose: () => {
      for (let slot = 0; slot < slots; slot++) {
        Atomics.store(control, slot, CONTROL.STOP)
        Atomics.notify(control, slot)
      }
      worker.terminate()
    },
  }
}

export function createTransferRunner(setup: KernelSetup, shape: FrameShape, factory: PhysicsWorkerFactory, slots = 1): StepRunner {
  const worker = factory()
  const free: ArrayBuffer[] = Array.from({ length: slots }, () => new ArrayBuffer(frameBytes(shape)))
  const done: ArrayBuffer[] = []
  const views = new WeakMap<ArrayBuffer, PhysicsFrame>()
  const viewOf = (buffer: ArrayBuffer): PhysicsFrame => {
    let view = views.get(buffer)
    if (!view) views.set(buffer, (view = createFrame(buffer, shape)))
    return view
  }
  let inFlight = 0
  worker.postMessage({ type: 'init', setup, shape } satisfies InitMessage)
  worker.onMessage((data) => {
    const message = data as DoneMessage
    if (message.type === 'done') done.push(message.buffer)
  })
  return {
    transport: 'transfer',
    get inFlight() {
      return inFlight
    },
    frame: () => (free.length ? viewOf(free[0]!) : null),
    submit: () => {
      const buffer = free.shift()
      if (!buffer) return
      worker.postMessage({ type: 'frame', buffer } satisfies FrameMessage, [buffer])
      inFlight++
    },
    settle: () => {
      const buffer = done.shift()
      if (!buffer) return null
      inFlight--
      free.push(buffer)
      return viewOf(buffer)
    },
    dispose: () => worker.terminate(),
  }
}
