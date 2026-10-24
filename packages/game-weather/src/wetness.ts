export const DEFAULT_WET_RISE_SECONDS = 120
/** The Workshop sheet: the water goes back to the colour of the ground 3 minutes after the rain stops. */
export const DEFAULT_DRY_OUT_SECONDS = 180

export type WetnessOptions = {
  /** Seconds of rain to wet the ground fully. */
  readonly riseSeconds?: number
  /** Seconds from the end of the rain until the ground is dry. */
  readonly dryOutSeconds?: number
}

export type Wetness = {
  value(): number
  /** Moves `seconds` toward `target` (the wetness the weather asks for); `dryingScale` speeds the dry-out up. Returns the new value. */
  update(seconds: number, target: number, dryingScale?: number): number
  reset(value?: number): void
}

/** Ground wetness: rises while the weather asks for more, then falls in a straight line that ends `dryOutSeconds` after the start of the fall. */
export function createWetness(options: WetnessOptions = {}): Wetness {
  const riseSeconds = options.riseSeconds ?? DEFAULT_WET_RISE_SECONDS
  const dryOutSeconds = options.dryOutSeconds ?? DEFAULT_DRY_OUT_SECONDS
  let current = 0
  let peak = 0
  let isDrying = false
  return {
    value: () => current,
    update(seconds, target, dryingScale = 1) {
      if (target > current) {
        isDrying = false
        current = Math.min(target, current + seconds / riseSeconds)
      } else if (target < current) {
        if (!isDrying) {
          isDrying = true
          peak = current
        }
        current = Math.max(target, current - (peak * seconds * dryingScale) / dryOutSeconds)
      } else isDrying = false
      return current
    },
    reset(value = 0) {
      current = value
      peak = value
      isDrying = false
    },
  }
}
