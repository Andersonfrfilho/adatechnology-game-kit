/**
 * The seat key (L by default): a tap sits on the seat aimed at, or gets up when seated; holding it lies down when the thing has a `lie` seat.
 * The press is judged on the wall clock (a slow frame does not turn a tap into a hold).
 */
import type { Seating } from './seating'

/** How long (seconds) L is held before it lies down instead of sitting. */
export const SEAT_KEY_DEFAULTS = { holdSeconds: 0.45 } as const

export type SeatKeyOptions = {
  readonly keys: readonly string[]
  readonly seating: Seating
  readonly holdSeconds?: number
  readonly now?: () => number
  /** Called when the key found nothing to sit on. */
  readonly onNothing?: () => void
}

export type SeatKey = {
  /** A key event; true when the key is the seat key (the room goes no further with it). */
  handleKey(code: string, down: boolean, repeat?: boolean): boolean
  /** Once a frame: a press held long enough lies down at once, without waiting for the key to be let go. */
  update(): void
}

export function createSeatKey(o: SeatKeyOptions): SeatKey {
  const now = o.now ?? (() => performance.now())
  const holdMs = (o.holdSeconds ?? SEAT_KEY_DEFAULTS.holdSeconds) * 1000
  let pressedAt: number | null = null

  const settle = (pose: 'sit' | 'lie'): void => {
    pressedAt = null
    if (!o.seating.sit(undefined, undefined, pose)) o.onNothing?.()
  }

  return {
    handleKey(code, down, repeat = false) {
      if (!o.keys.includes(code)) return false
      if (down) {
        if (repeat || pressedAt !== null) return true
        if (o.seating.seat) o.seating.stand()
        else pressedAt = now()
        return true
      }
      if (pressedAt !== null) settle(now() - pressedAt >= holdMs ? 'lie' : 'sit')
      return true
    },
    update() {
      if (pressedAt !== null && now() - pressedAt >= holdMs) settle('lie')
    },
  }
}
