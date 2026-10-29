/**
 * A pool that keeps its live records in the order they were added, reuses dead records instead of allocating, and compacts in place. When it is full
 * the oldest record goes (the Lab's `P.shift()`); a pool may choose which one instead (the chunks drop a resting one first).
 */
export class OrderedPool<T extends object> {
  /** The live records, oldest first. */
  readonly items: T[] = []
  private readonly spare: T[] = []

  constructor(
    readonly capacity: number,
    private readonly create: () => T,
    private readonly release?: (item: T) => void,
  ) {}

  get count(): number {
    return this.items.length
  }

  /** A record to fill in. At capacity the record `victim` picks (default: the oldest) is dropped and reused. */
  acquire(victim?: (items: readonly T[]) => number): T {
    if (this.items.length >= this.capacity) this.removeAt(victim ? victim(this.items) : 0)
    const record = this.spare.pop() ?? this.create()
    this.items.push(record)
    return record
  }

  removeAt(index: number): void {
    const record = this.items[index]
    if (record === undefined) return
    for (let shifted = index; shifted < this.items.length - 1; shifted++) this.items[shifted] = this.items[shifted + 1]!
    this.items.length -= 1
    this.release?.(record)
    this.spare.push(record)
  }

  /** Keeps the records `keep` accepts, in the same order, without allocating. `context` goes to `keep` so no closure is needed per frame. */
  compact<TContext>(keep: (item: T, context: TContext) => boolean, context: TContext): void {
    let write = 0
    for (let read = 0; read < this.items.length; read++) {
      const record = this.items[read]!
      if (keep(record, context)) {
        this.items[write++] = record
        continue
      }
      this.release?.(record)
      this.spare.push(record)
    }
    this.items.length = write
  }

  clear(): void {
    for (const record of this.items) {
      this.release?.(record)
      this.spare.push(record)
    }
    this.items.length = 0
  }
}
