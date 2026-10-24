/** The slice of the global scope the portable math replaces; tests pass a plain object instead of the real global. */
export type PortableMathTarget = {
  Math: { pow: (base: number, exponent: number) => number }
}

const MAX_SQUARING_EXPONENT = 64
// Taken at load, before any install, because `Math.pow` is the thing being replaced.
const nativePow = Math.pow

function isInteger(value: number): boolean {
  return Math.floor(value) === value
}

function powerBySquaring(base: number, exponent: number): number {
  let result = 1
  let factor = base
  for (let remaining = exponent; remaining > 0; remaining = Math.floor(remaining / 2)) {
    if (remaining % 2 === 1) result *= factor
    factor *= factor
  }
  return result
}

/**
 * `Math.pow` built only from operations that every engine rounds the same way (+ - * /) and from `exp` and `log`, which Node 22 and
 * Node 24 return bit for bit alike. The native `Math.pow` (and `**`) changed its last bit between V8 12 and V8 13, and a closed tube
 * on a nearly straight path turns that last bit into a visible twist of the ring (up to 8e-4 on a 9 mm tube).
 */
export function portablePow(base: number, exponent: number): number {
  const isPlain = Number.isFinite(base) && Number.isFinite(exponent) && base !== 0
  if (!isPlain) return nativePow(base, exponent)
  if (exponent === 0) return 1
  if (isInteger(exponent) && Math.abs(exponent) <= MAX_SQUARING_EXPONENT) {
    const power = powerBySquaring(base, Math.abs(exponent))
    return exponent < 0 ? 1 / power : power
  }
  if (base > 0) return Math.exp(exponent * Math.log(base))
  if (!isInteger(exponent)) return NaN
  const magnitude = Math.exp(exponent * Math.log(-base))
  return exponent % 2 === 0 ? magnitude : -magnitude
}

/** Replaces `Math.pow` with `portablePow` and returns the function that puts the original back. `**` cannot be replaced: keep it off non-integer exponents. */
export function installPortableMath(target: PortableMathTarget = globalThis as unknown as PortableMathTarget): () => void {
  const original = target.Math.pow
  target.Math.pow = portablePow
  return () => {
    target.Math.pow = original
  }
}
