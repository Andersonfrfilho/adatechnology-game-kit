import type { NavGrid } from '../../grid'
import type { CrowdStore } from '../../store'
import type { ContactView } from '../contact'
import type { PhysicsStats } from '../context'
import { HEADER, INPUT_KEYS } from './frame'
import type { PhysicsFrame } from './frame'
import type { StepRunner } from './runner'

export type OffloadHost = {
  readonly store: CrowdStore
  readonly grid: NavGrid
  readonly stats: PhysicsStats
  readonly contact: ContactView
  /** The door at a grid cell took `load` N·s from the field (the door index is the host's to find). */
  addDoorLoad(cell: number, load: number): void
}

export type OffloadStepResult = { playerLoad: number }

export type Offload = {
  /** Applies the result of the previous step, if it is back, then hands the state of this one to the runner. */
  step(h: number, player: { readonly x: number; readonly z: number } | undefined): OffloadStepResult
  /** The store moved agent `moved` into the place of `removed`: the result still in flight is read through it. */
  remap(removed: number, moved: number): void
  dispose(): void
}

const isOpen = (grid: NavGrid, x: number, z: number): boolean => {
  const cell = grid.cellOf(x, z)
  return cell >= 0 && (grid.occ[cell] === 0 || grid.occ[cell] === 3)
}

/** The inputs of one step, copied from the store and the grid into the frame. */
export function writeSnapshot(frame: PhysicsFrame, source: { readonly store: CrowdStore; readonly grid: NavGrid }, h: number, player: { readonly x: number; readonly z: number } | undefined): void {
  const { store, grid } = source
  const n = store.n
  for (const key of INPUT_KEYS.f32) frame.f32[key].set(store[key].subarray(0, n))
  for (const key of INPUT_KEYS.u8) frame.u8[key].set(store[key].subarray(0, n))
  frame.identity.set(store.identity.subarray(0, n))
  frame.occ.set(grid.occ)
  frame.header[HEADER.n] = n
  frame.header[HEADER.h] = h
  frame.header[HEADER.playerOn] = player ? 1 : 0
  frame.header[HEADER.playerX] = player?.x ?? 0
  frame.header[HEADER.playerZ] = player?.z ?? 0
}

/**
 * The contact and the pressure one step behind: what the runner gives back was computed from the state at the end of the previous step, so it comes as deltas (position,
 * push, velocity) added to the state of now, and as fields that replace the old ones. With the same inputs per step it is the same result whichever thread computed it.
 */
export function createOffload(runner: StepRunner, host: OffloadHost, latency = 1): Offload {
  const { store, grid, stats, contact } = host
  type Pending = { count: number; origin: Int32Array | null; readonly originBuffer: Int32Array }
  const queue: Pending[] = []
  const spare: Pending[] = Array.from({ length: latency }, () => ({ count: 0, origin: null, originBuffer: new Int32Array(store.capacity) }))
  const result: OffloadStepResult = { playerLoad: 0 }

  const apply = (frame: PhysicsFrame, pending: Pending): void => {
    const { f32, header } = frame
    const { origin, count } = pending
    for (let agent = 0; agent < store.n; agent++) {
      const from = origin ? origin[agent]! : agent < count ? agent : -1
      if (from < 0) {
        contact.workspace.shove[agent] = 0
        continue
      }
      const dx = f32.deltaX[from]!
      const dz = f32.deltaZ[from]!
      if (dx !== 0 && isOpen(grid, store.x[agent]! + dx, store.z[agent]!)) store.x[agent]! += dx
      if (dz !== 0 && isOpen(grid, store.x[agent]!, store.z[agent]! + dz)) store.z[agent]! += dz
      store.pushX[agent]! += f32.deltaPushX[from]!
      store.pushZ[agent]! += f32.deltaPushZ[from]!
      store.vx[agent]! += f32.deltaVx[from]!
      store.vz[agent]! += f32.deltaVz[from]!
      store.field[agent] = f32.field[from]!
      store.fieldPrev[agent] = f32.field[from]!
      contact.workspace.shove[agent] = f32.shove[from]!
      const cell = frame.doorCell[from]!
      if (cell >= 0) host.addDoorLoad(cell, f32.doorLoad[from]!)
    }
    stats.contacts = header[HEADER.contacts]!
    stats.maxOverlap = header[HEADER.maxOverlap]!
    stats.meanOverlap = header[HEADER.contacts]! ? header[HEADER.overlapSum]! / header[HEADER.contacts]! : 0
    stats.fieldMax = header[HEADER.fieldMax]!
    result.playerLoad = header[HEADER.playerLoad]!
  }

  const step = (h: number, player: { readonly x: number; readonly z: number } | undefined): OffloadStepResult => {
    result.playerLoad = 0
    if (queue.length >= latency) {
      const frame = runner.settle()
      if (frame) {
        const pending = queue.shift()!
        apply(frame, pending)
        pending.origin = null
        spare.push(pending)
      }
    }
    const frame = runner.frame()
    if (frame && spare.length) {
      writeSnapshot(frame, { store, grid }, h, player)
      runner.submit()
      const pending = spare.shift()!
      pending.count = store.n
      queue.push(pending)
    }
    return result
  }

  const remap = (removed: number, moved: number): void => {
    queue.forEach((pending) => {
      if (!pending.origin) {
        pending.origin = pending.originBuffer.fill(-1)
        for (let agent = 0; agent < pending.count; agent++) pending.origin[agent] = agent
      }
      pending.origin[removed] = removed === moved ? -1 : pending.origin[moved]!
      if (removed !== moved) pending.origin[moved] = -1
    })
  }

  return { step, remap, dispose: () => runner.dispose() }
}
