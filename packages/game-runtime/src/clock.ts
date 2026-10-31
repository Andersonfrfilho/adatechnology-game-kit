export const MICROS_PER_SECOND = 1_000_000

export const toMicros = (seconds: number): number => Math.round(seconds * MICROS_PER_SECOND)

export function defaultClock(): () => number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return () => performance.now()
  return () => Date.now()
}
