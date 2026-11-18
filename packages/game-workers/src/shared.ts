/**
 * Memory the main thread and the simulation thread share, with no lock and no wait on the main thread (it may not wait in a browser or in
 * the Electron renderer): a triple buffer of snapshots (the simulation writes, the page reads the newest whole one) and a ring of commands
 * (the page writes input, the simulation drains it at the start of a step). One writer and one reader each.
 */

const HEADER_BYTES = 32
const SLOTS = 3
// header Int32 words of the snapshot buffer
const PUBLISHED = 0 // slot + 1 of the newest whole snapshot, 0 before the first
const CLAIMED = 1 // slot + 1 the reader is reading, 0 none
const FRAME = 2 // frame of each slot (3 words)

const align8 = (n: number): number => Math.ceil(n / 8) * 8

/** Whether this runtime shares memory between threads: `SharedArrayBuffer` and, in a page, cross-origin isolation (COOP/COEP; always in Electron). */
export function canShareMemory(): boolean {
  if (typeof SharedArrayBuffer === 'undefined' || typeof Atomics === 'undefined') return false
  const isolated = (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated
  return isolated !== false
}

/** A buffer of three snapshots of `bytes` each. */
export function createSnapshotBuffer(bytes: number): SharedArrayBuffer {
  return new SharedArrayBuffer(HEADER_BYTES + SLOTS * align8(bytes))
}

const slotBytes = (buffer: SharedArrayBuffer): number => (buffer.byteLength - HEADER_BYTES) / SLOTS

/** One snapshot as the reader sees it: valid until its next `latest()`, which may hand the slot back to the writer. */
export interface Snapshot {
  readonly frame: number
  readonly buffer: SharedArrayBuffer
  readonly byteOffset: number
  readonly byteLength: number
  readonly bytes: Uint8Array
}

/** The writer's side (the simulation thread): `begin` a free slot, fill it, `commit` it with its frame. Never waits. */
export class SnapshotWriter {
  private readonly header: Int32Array
  private readonly views: Uint8Array[]
  private slot = -1
  constructor(readonly buffer: SharedArrayBuffer) {
    this.header = new Int32Array(buffer, 0, HEADER_BYTES / 4)
    const size = slotBytes(buffer)
    this.views = Array.from({ length: SLOTS }, (_, k) => new Uint8Array(buffer, HEADER_BYTES + k * size, size))
  }
  /** A slot neither published nor being read: there is always one of the three. */
  begin(): Uint8Array {
    const published = Atomics.load(this.header, PUBLISHED) - 1
    const claimed = Atomics.load(this.header, CLAIMED) - 1
    let slot = 0
    while (slot === published || slot === claimed) slot++
    this.slot = slot
    return this.views[slot]!
  }
  commit(frame: number): void {
    if (this.slot < 0) throw new Error('SnapshotWriter.commit: no begin')
    Atomics.store(this.header, FRAME + this.slot, frame)
    Atomics.store(this.header, PUBLISHED, this.slot + 1)
    this.slot = -1
  }
}

/** The reader's side (the page): the newest whole snapshot, or `null` before the first. Never waits; retries only when a commit lands mid-claim. */
export class SnapshotReader {
  private readonly header: Int32Array
  private readonly size: number
  private readonly views: Uint8Array[]
  constructor(readonly buffer: SharedArrayBuffer) {
    this.header = new Int32Array(buffer, 0, HEADER_BYTES / 4)
    this.size = slotBytes(buffer)
    this.views = Array.from({ length: SLOTS }, (_, k) => new Uint8Array(buffer, HEADER_BYTES + k * this.size, this.size))
  }
  latest(): Snapshot | null {
    for (;;) {
      const published = Atomics.load(this.header, PUBLISHED)
      if (published === 0) return null
      Atomics.store(this.header, CLAIMED, published)
      // the writer only skips the claimed slot from its next begin on: the claim holds when the slot is still the newest after it
      if (Atomics.load(this.header, PUBLISHED) !== published) continue
      const slot = published - 1
      return {
        frame: Atomics.load(this.header, FRAME + slot),
        buffer: this.buffer,
        byteOffset: HEADER_BYTES + slot * this.size,
        byteLength: this.size,
        bytes: this.views[slot]!,
      }
    }
  }
  /** Lets the writer take the slot of the last snapshot (the reader is done with it). */
  release(): void {
    Atomics.store(this.header, CLAIMED, 0)
  }
}

const RING_HEADER_BYTES = 8 // Int32: written, read

/** A ring of `capacity` commands of `width` numbers each. */
export function createCommandBuffer(width: number, capacity: number): SharedArrayBuffer {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(capacity) || capacity < 1) throw new Error('createCommandBuffer: width and capacity are integers >= 1')
  const buffer = new SharedArrayBuffer(RING_HEADER_BYTES + 8 + width * capacity * 8)
  // the layout is read back from the buffer: width in the slot after the header
  new Float64Array(buffer, RING_HEADER_BYTES, 1)[0] = width
  return buffer
}

/** Both ends of the ring: the page `push`es, the simulation `drain`s; a full ring refuses the command (`false`) rather than waiting. */
export class CommandRing {
  private readonly header: Int32Array
  private readonly data: Float64Array
  readonly width: number
  readonly capacity: number
  constructor(readonly buffer: SharedArrayBuffer) {
    this.header = new Int32Array(buffer, 0, 2)
    this.width = new Float64Array(buffer, RING_HEADER_BYTES, 1)[0]!
    this.data = new Float64Array(buffer, RING_HEADER_BYTES + 8)
    this.capacity = this.data.length / this.width
  }
  push(command: ArrayLike<number>): boolean {
    if (command.length > this.width) throw new Error(`CommandRing.push: ${command.length} numbers, the ring holds ${this.width}`)
    const written = Atomics.load(this.header, 0)
    if (written - Atomics.load(this.header, 1) >= this.capacity) return false
    const at = (written % this.capacity) * this.width
    this.data.fill(0, at, at + this.width)
    for (let k = 0; k < command.length; k++) this.data[at + k] = command[k]!
    Atomics.store(this.header, 0, written + 1)
    return true
  }
  /** Every command pushed so far, oldest first, each a copy. */
  drain(): Float64Array[] {
    const written = Atomics.load(this.header, 0)
    const read = Atomics.load(this.header, 1)
    const out: Float64Array[] = []
    for (let k = read; k < written; k++) {
      const at = (k % this.capacity) * this.width
      out.push(this.data.slice(at, at + this.width))
    }
    Atomics.store(this.header, 1, written)
    return out
  }
}
