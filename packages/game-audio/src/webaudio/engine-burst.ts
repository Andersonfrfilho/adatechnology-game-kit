/** A slot of a group's top list; slots are reused, so a request that cannot win allocates nothing. */
type Slot = { score: number; order: number; at: number; run: ((boost: number) => void) | undefined }

type Bucket = { limit: number; boost: number; asked: number; weakest: number; readonly slots: Slot[]; readonly spare: Slot[] }

export type BurstCap = {
  /** Whether a request of this loudness can still be among the `limit` loudest of its group's burst; a request that cannot is counted as capped and costs nothing more. */
  offer(group: string, limit: number, boost: number, score: number): boolean
  /** Keeps the request `offer` accepted, replacing the group's weakest when the list is full. */
  place(group: string, score: number, run: (boost: number) => void): void
  /** Hands the loudest of every group to `deliver`, loudest first (ties by request order), and empties the lists. Nothing held is a no-op. */
  settle(): void
  /** The settle job waited too long: the held requests that are themselves past the latency limit are dropped as late (counted apart from `capped`); the rest get a new settle job. */
  expire(): void
  /** A kept voice that waited past the limit in the queue. */
  lost(): void
  /** The engine closed: forgets what is held without counting it. */
  clear(): void
  /** Requests that lost to louder ones, before any node. */
  readonly capped: number
  /** Requests dropped because the queue did not reach their settle in time. */
  readonly late: number
}

const loudestFirst = (a: Slot, b: Slot): number => b.score - a.score || a.order - b.order

/**
 * One frame of impacts can ask for hundreds of voices of one group, and each costs its nodes. The cap keeps the `limit` loudest per group as they
 * come (a bounded list, no growth with the burst), and `schedule`'s settle job builds them when the engine's start queue reaches it: the window is
 * the one the host already owns, with no extra frame. The only clock is the queue's own (`clock`, the one its latency check reads); the cap makes none.
 */
export function createBurstCap(
  schedule: () => void,
  deliver: (run: (boost: number) => void, boost: number) => void,
  clock: { readonly now: () => number; readonly stale: (stamp: number) => boolean },
): BurstCap {
  const buckets = new Map<string, Bucket>()
  let order = 0
  let scheduled = false
  let capped = 0
  let late = 0

  const release = (bucket: Bucket): void => {
    for (const slot of bucket.slots) {
      slot.run = undefined
      bucket.spare.push(slot)
    }
    bucket.slots.length = 0
    bucket.asked = 0
  }

  const release1 = (bucket: Bucket, slot: Slot): void => {
    slot.run = undefined
    bucket.spare.push(slot)
  }

  const forget = (): number => {
    let held = 0
    for (const bucket of buckets.values()) {
      held += bucket.slots.length
      release(bucket)
    }
    scheduled = false
    return held
  }

  const bucketOf = (group: string, limit: number, boost: number): Bucket => {
    let bucket = buckets.get(group)
    if (!bucket) {
      bucket = { limit, boost, asked: 0, weakest: 0, slots: [], spare: [] }
      buckets.set(group, bucket)
    }
    bucket.limit = limit
    bucket.boost = boost
    return bucket
  }

  // the lowest score; among equals the latest request, so a later one never evicts an earlier one of the same loudness
  const findWeakest = (bucket: Bucket): number => {
    let weakest = 0
    for (let index = 1; index < bucket.slots.length; index++) {
      const slot = bucket.slots[index] as Slot
      const current = bucket.slots[weakest] as Slot
      if (slot.score < current.score || (slot.score === current.score && slot.order > current.order)) weakest = index
    }
    return weakest
  }

  return {
    offer(group, limit, boost, score) {
      const bucket = bucketOf(group, limit, boost)
      bucket.asked++
      if (bucket.slots.length < bucket.limit) return true
      bucket.weakest = findWeakest(bucket)
      if (score > (bucket.slots[bucket.weakest] as Slot).score) return true
      capped++
      return false
    },
    place(group, score, run) {
      const bucket = buckets.get(group) as Bucket
      const level = score > 0 ? score : 0
      let slot: Slot
      if (bucket.slots.length < bucket.limit) {
        slot = bucket.spare.pop() ?? { score: 0, order: 0, at: 0, run: undefined }
        bucket.slots.push(slot)
      } else {
        slot = bucket.slots[bucket.weakest] as Slot
        capped++
      }
      slot.score = level
      slot.order = order++
      slot.at = clock.now()
      slot.run = run
      if (scheduled) return
      scheduled = true
      schedule()
    },
    settle() {
      scheduled = false
      for (const bucket of buckets.values()) {
        const { slots } = bucket
        if (slots.length === 0) continue
        slots.sort(loudestFirst)
        const boost = 1 + (bucket.boost - 1) * ((bucket.asked - slots.length) / bucket.asked)
        for (const slot of slots) deliver(slot.run as (boost: number) => void, boost)
        release(bucket)
      }
    },
    expire() {
      scheduled = false
      let survivors = 0
      for (const bucket of buckets.values()) {
        const fresh = bucket.slots.filter((slot) => !clock.stale(slot.at))
        late += bucket.slots.length - fresh.length
        for (const slot of bucket.slots) if (!fresh.includes(slot)) release1(bucket, slot)
        bucket.slots.splice(0, bucket.slots.length, ...fresh)
        bucket.asked -= bucket.slots.length - fresh.length
        survivors += fresh.length
      }
      if (survivors === 0) return
      scheduled = true
      schedule()
    },
    lost() {
      late++
    },
    clear() {
      forget()
    },
    get capped() {
      return capped
    },
    get late() {
      return late
    },
  }
}
