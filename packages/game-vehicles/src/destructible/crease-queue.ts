import { DEFERRED_QUEUE_ID } from '@adatechnology/game-contracts'
import type { DeferredQueue } from '@adatechnology/game-contracts'

/** What one vehicle's visuals give the shared crease queue: the normal smoothing and the triangle indexes still to finish. */
export interface CreaseWork {
  /** Units waiting; 0 in the frame a panel was torn (that frame already paid for the cut). `frame` is the budget's frame counter. */
  pendingUnits(frame?: number): number
  /** Runs one slice of the work (a smoothing step or a piece of the index warm-up) until `deadline` on `performance.now()`; false when there was nothing to run. */
  runStep(deadline: number): boolean
  /** Finishes everything now. */
  finishAll(): void
  /** While true the vehicle's own update leaves the work to the queue. */
  setQueued(isQueued: boolean): void
}

export interface CreaseQueue {
  /** The queue for a frame budget (id `vehicles.crease`, `DEFERRED_PRIORITY['vehicles.crease']`); asking for it changes nothing. */
  deferredQueue(): DeferredQueue
  /** A vehicle's visuals join the queue; returns the function that takes them out (a rebuilt vehicle, a vehicle that goes away). */
  track(work: CreaseWork): () => void
}

/**
 * One queue for every vehicle of a scene, run round robin over the vehicles with work, so that the first vehicle does not take the whole budget.
 * Until a budget attaches it, each vehicle keeps smoothing in its own `update`.
 */
export function createCreaseQueue(): CreaseQueue {
  const tracked: CreaseWork[] = []
  let cursor = 0
  let lastFrame: number | undefined
  let attached = false

  const deferred: DeferredQueue = {
    id: DEFERRED_QUEUE_ID.VEHICLE_CREASE,
    pending(frame) {
      lastFrame = frame
      let units = 0
      for (const work of tracked) units += work.pendingUnits(frame)
      return units
    },
    run(deadline, clock) {
      let ran = 0
      let skipped = 0
      while (tracked.length > 0 && skipped < tracked.length) {
        if (ran > 0 && clock() >= deadline) break
        const work = tracked[cursor % tracked.length] as CreaseWork
        cursor = (cursor + 1) % tracked.length
        if (work.pendingUnits(lastFrame) > 0 && work.runStep(deadline)) {
          ran++
          skipped = 0
        } else skipped++
      }
      return ran
    },
    flush() {
      for (const work of tracked) work.finishAll()
    },
    attach() {
      attached = true
      for (const work of tracked) work.setQueued(true)
    },
    detach() {
      attached = false
      for (const work of tracked) work.setQueued(false)
    },
  }

  return {
    deferredQueue: () => deferred,
    track(work) {
      tracked.push(work)
      work.setQueued(attached)
      return () => {
        const at = tracked.indexOf(work)
        if (at < 0) return
        tracked.splice(at, 1)
        work.setQueued(false)
      }
    },
  }
}
