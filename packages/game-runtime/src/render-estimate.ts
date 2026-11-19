const RENDER_ESTIMATE_WEIGHT = 0.125

/** Exponential moving average of the render phase; the first sample seeds it, before it the estimate is 0. */
export function createRenderEstimate(): { readonly value: number; add(sample: number): void } {
  let value = 0
  let seeded = false
  return {
    get value() {
      return value
    },
    add(sample) {
      value = seeded ? value + (sample - value) * RENDER_ESTIMATE_WEIGHT : sample
      seeded = true
    },
  }
}
