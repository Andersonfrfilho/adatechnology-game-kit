import type { PieceBody } from './internal'

/**
 * The pieces the per-update loops walk: not asleep, held in the hand, or just changed. Kept in creation order (`generation`, the order of the system's list), so a walk visits
 * them in the order a walk over every piece would. A piece enters when it wakes and leaves once it is asleep on both sides and measured (`settle`).
 */
export class AwakeList {
  readonly items: PieceBody[] = []
  private readonly members = new Set<PieceBody>()
  /** Where a walk is: a piece that enters before it is not visited again, one that enters after it is, as in a walk over the whole list. */
  private cursor = -1

  has(body: PieceBody): boolean {
    return this.members.has(body)
  }

  enter(body: PieceBody): void {
    if (this.members.has(body)) return
    this.members.add(body)
    const items = this.items
    let low = 0
    let high = items.length
    while (low < high) {
      const middle = (low + high) >> 1
      if ((items[middle] as PieceBody).generation < body.generation) low = middle + 1
      else high = middle
    }
    items.splice(low, 0, body)
    if (low <= this.cursor) this.cursor++
  }

  leave(body: PieceBody): void {
    if (!this.members.delete(body)) return
    const at = this.items.indexOf(body)
    this.items.splice(at, 1)
    if (at <= this.cursor) this.cursor--
  }

  clear(): void {
    this.items.length = 0
    this.members.clear()
    this.cursor = -1
  }

  walk(visit: (body: PieceBody) => void): void {
    const outer = this.cursor
    for (this.cursor = 0; this.cursor < this.items.length; this.cursor++) visit(this.items[this.cursor] as PieceBody)
    this.cursor = outer
  }

  /** Drops what `isSettled` names, in place and in order. Not during a walk. */
  settle(isSettled: (body: PieceBody) => boolean): void {
    const items = this.items
    let kept = 0
    for (let i = 0; i < items.length; i++) {
      const body = items[i] as PieceBody
      if (isSettled(body)) this.members.delete(body)
      else items[kept++] = body
    }
    items.length = kept
  }
}
