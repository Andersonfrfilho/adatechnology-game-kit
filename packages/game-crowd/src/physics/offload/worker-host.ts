import { createFrame } from './frame'
import type { FrameShape } from './frame'
import { createKernel } from './kernel'
import type { KernelSetup } from './kernel'

/** The slot of the control word the two threads share. */
export const CONTROL = { IDLE: 0, SUBMITTED: 1, DONE: 2, STOP: 3 } as const

export type InitMessage = { readonly type: 'init'; readonly setup: KernelSetup; readonly shape: FrameShape; readonly frames?: readonly SharedArrayBuffer[]; readonly control?: SharedArrayBuffer }
export type FrameMessage = { readonly type: 'frame'; readonly buffer: ArrayBuffer }
export type DoneMessage = { readonly type: 'done'; readonly buffer: ArrayBuffer }

/** What a worker thread has to offer: browsers and node give it different shapes, so the host adapts them. */
export type WorkerPort = {
  postMessage(message: unknown, transfer?: ArrayBuffer[]): void
  onMessage(listener: (data: unknown) => void): void
}

/**
 * The worker side: builds the kernel on `init`, then either loops on the shared control word (shared transport) or answers each transferred frame.
 * A host that loads the worker its own way (a bundler, node `worker_threads`) calls this with its port.
 */
export function attachPhysicsWorker(port: WorkerPort): void {
  let kernel: ReturnType<typeof createKernel> | null = null
  let shape: FrameShape | null = null
  port.onMessage((data) => {
    const message = data as InitMessage | FrameMessage
    if (message.type === 'init') {
      kernel = createKernel(message.setup)
      shape = message.shape
      if (message.frames && message.control) runShared(kernel, message.frames.map((buffer) => createFrame(buffer, message.shape)), new Int32Array(message.control))
      return
    }
    if (!kernel || !shape) return
    const frame = createFrame(message.buffer, shape)
    kernel.run(frame)
    port.postMessage({ type: 'done', buffer: message.buffer } satisfies DoneMessage, [message.buffer])
  })
}

/** The frames in order, each one when the main thread says it is submitted: the main thread takes them back in the same order. */
function runShared(kernel: ReturnType<typeof createKernel>, frames: readonly ReturnType<typeof createFrame>[], control: Int32Array): void {
  for (let turn = 0; ; turn++) {
    const slot = turn % frames.length
    for (;;) {
      const state = Atomics.load(control, slot)
      if (state === CONTROL.STOP) return
      if (state === CONTROL.SUBMITTED) break
      Atomics.wait(control, slot, state)
    }
    kernel.run(frames[slot]!)
    Atomics.store(control, slot, CONTROL.DONE)
    Atomics.notify(control, slot)
  }
}
