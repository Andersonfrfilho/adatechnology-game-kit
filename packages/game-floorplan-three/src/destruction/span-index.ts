/** A stretch along a wall (`a`–`b`, metres) and up it (`y0`–`y1`). */
export type AlongSpan = { readonly a: number; readonly b: number }

const CELL = 0.25

/**
 * The spans of a wall bucketed along it, so a stretch `from`–`to` asks only the spans within `pad` of it along the wall: a blast leaves hundreds of holes, and
 * each unit of the wall used to test every one. Every span whose stretch, grown by `pad`, meets `from`–`to` is in the answer (and some farther ones may be).
 */
export function indexSpansAlong<TSpan extends AlongSpan>(spans: readonly TSpan[], pad: number): (from: number, to: number) => readonly TSpan[] {
  const buckets = new Map<number, TSpan[]>()
  for (const span of spans) {
    const first = Math.floor((span.a - pad) / CELL), last = Math.floor((span.b + pad) / CELL)
    for (let k = first; k <= last; k++) {
      const bucket = buckets.get(k)
      if (bucket) bucket.push(span)
      else buckets.set(k, [span])
    }
  }
  return (from, to) => {
    const first = Math.floor(from / CELL), last = Math.floor(to / CELL)
    if (first === last) return buckets.get(first) ?? []
    const found = new Set<TSpan>()
    for (let k = first; k <= last; k++) for (const span of buckets.get(k) ?? []) found.add(span)
    return [...found]
  }
}
