/** A stretch along a wall (`a`–`b`, metres) and up it (`y0`–`y1`). */
export type AlongSpan = { readonly a: number; readonly b: number }

const CELL = 0.25

/**
 * The spans of a wall bucketed along it, so a point asks only the spans within `pad` of it along the wall: a blast leaves hundreds of holes, and each unit
 * of the wall used to test every one. Every span whose stretch, grown by `pad`, holds the point is among the answer (and some farther ones may be).
 */
export function indexSpansAlong<TSpan extends AlongSpan>(spans: readonly TSpan[], pad: number): (s: number) => readonly TSpan[] {
  const buckets = new Map<number, TSpan[]>()
  for (const span of spans) {
    const first = Math.floor((span.a - pad) / CELL), last = Math.floor((span.b + pad) / CELL)
    for (let k = first; k <= last; k++) {
      const bucket = buckets.get(k)
      if (bucket) bucket.push(span)
      else buckets.set(k, [span])
    }
  }
  const none: readonly TSpan[] = []
  return (s) => buckets.get(Math.floor(s / CELL)) ?? none
}
