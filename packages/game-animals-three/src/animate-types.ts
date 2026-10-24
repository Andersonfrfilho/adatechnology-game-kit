/** What the animation needs each frame. */
export type AnimateParams = {
  /** Seconds since the start. */
  readonly time: number
  /** Seconds since the last frame. */
  readonly delta: number
  /** `idle`, `walk` or `run`; any other value stands in the walk pose without advancing the cycle, as the page does. */
  readonly clip: string
  /** Snakes only: spread the body segments apart (the split view). */
  readonly split?: boolean
}
