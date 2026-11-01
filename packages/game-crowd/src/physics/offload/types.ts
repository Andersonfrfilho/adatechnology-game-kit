/**
 * `shared`: one `SharedArrayBuffer` frame and a control word, the worker computes while the main thread runs the rest of the step; needs `crossOriginIsolated` in a browser.
 * `transfer`: the frame goes by `postMessage` with its buffer transferred; no isolation needed, but the answer arrives whenever the event loop delivers it.
 * `inline`: the same protocol and the same kernel on the calling thread, one step of latency as well; the reference the other two must match.
 */
export type OffloadTransport = 'shared' | 'transfer' | 'inline'

/** A worker as the runner sees it: browsers and node differ in how a message arrives, the factory hides that. */
export type PhysicsWorkerHandle = {
  postMessage(message: unknown, transfer?: ArrayBuffer[]): void
  onMessage(listener: (data: unknown) => void): void
  terminate(): void
}
export type PhysicsWorkerFactory = () => PhysicsWorkerHandle
