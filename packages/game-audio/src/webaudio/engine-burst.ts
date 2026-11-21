/** A request held until its burst settles: `run` builds it (with the burst's gain boost) and is never called for a request that is dropped. */
type Held = { readonly score: number; readonly order: number; readonly run: (boost: number) => void }

type Bucket = { limit: number; boost: number; readonly held: Held[] }

export type BurstCap = {
  /** Holds a request of a group; the engine's next `settle` decides it. */
  hold(group: string, limit: number, boost: number, score: number, run: (boost: number) => void): void
  /** Builds the `limit` loudest requests of every group (ties by request order) and forgets the rest. Nothing held is a no-op. */
  settle(): void
  /** Forgets everything held (the queue gave up or the engine closed). */
  cancel(): void
  readonly pending: number
  /** Requests dropped without building a node, since the engine began. */
  readonly dropped: number
}

// loudest first; the same level keeps the order the sounds were asked in (and a level that is not a number counts as silent)
const loudestFirst = (a: Held, b: Held): number => b.score - a.score || a.order - b.order

/**
 * One frame of impacts can ask for hundreds of voices of one group, and each costs its nodes. The cap holds the requests (no node is created for
 * them), and when `schedule`'s settle job runs, builds only the loudest. `schedule` puts that job in the engine's start queue, so the window is the
 * one the host already owns: from the first held request until the queue next drains, with no clock and no extra frame.
 */
export function createBurstCap(schedule: (settle: () => void, cancel: () => void) => void): BurstCap {
  const buckets = new Map<string, Bucket>()
  let order = 0
  let scheduled = false
  let pending = 0
  let dropped = 0

  const settle = (): void => {
    scheduled = false
    for (const bucket of buckets.values()) {
      const { held } = bucket
      if (held.length === 0) continue
      held.sort(loudestFirst)
      const kept = Math.min(bucket.limit, held.length)
      const boost = 1 + (bucket.boost - 1) * ((held.length - kept) / held.length)
      dropped += held.length - kept
      // a kept request builds a voice (it never asks the cap for another), so the list is safe to walk before it is emptied
      for (let index = 0; index < kept; index++) (held[index] as Held).run(boost)
      held.length = 0
    }
    pending = 0
  }

  const cancel = (): void => {
    scheduled = false
    for (const bucket of buckets.values()) {
      dropped += bucket.held.length
      bucket.held.length = 0
    }
    pending = 0
  }

  return {
    hold(group, limit, boost, score, run) {
      let bucket = buckets.get(group)
      if (!bucket) {
        bucket = { limit, boost, held: [] }
        buckets.set(group, bucket)
      }
      bucket.limit = limit
      bucket.boost = boost
      bucket.held.push({ score: score > 0 ? score : 0, order: order++, run })
      pending++
      if (scheduled) return
      scheduled = true
      schedule(settle, cancel)
    },
    settle,
    cancel,
    get pending() {
      return pending
    },
    get dropped() {
      return dropped
    },
  }
}
