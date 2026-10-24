const LEHMER_MULTIPLIER = 16807
const LEHMER_MODULUS = 2147483647
const LCG_MULTIPLIER = 1664525
const LCG_INCREMENT = 1013904223
const LCG_RANGE = 4294967296
const HASH_MIX = 0x9e3779b1

export interface MutableVec3 {
  x: number
  y: number
  z: number
}

/** A seeded stream of numbers in [0, 1). The Lab's generator and the Fluid Standard's are both here, behind the same three calls. */
export interface RandomStream {
  /** The next number (the Lab's `rnd`). */
  next(): number
  /** The Lab's `rr(min, max)`: one draw, scaled. */
  between(min: number, max: number): number
  /** The Lab's `rdir`: a random unit vector, two draws (`u`, then the angle), written into `out`. */
  direction(out: MutableVec3): MutableVec3
  readonly state: number
}

function normalizeLehmerSeed(seed: number): number {
  const whole = Math.floor(Math.abs(seed)) % (LEHMER_MODULUS - 1)
  return whole === 0 ? 1 : whole
}

/** Park-Miller 16807 (the Lab's L16-18). A seed in 1..2147483646 is used as is, so a stream replays the page's. */
export function lehmer(seed: number): RandomStream {
  let state = normalizeLehmerSeed(seed)
  const next = (): number => {
    state = (state * LEHMER_MULTIPLIER) % LEHMER_MODULUS
    return (state - 1) / (LEHMER_MODULUS - 1)
  }
  return {
    next,
    between: (min, max) => min + (max - min) * next(),
    direction(out) {
      const up = next() * 2 - 1
      const angle = next() * Math.PI * 2
      const ring = Math.sqrt(1 - up * up)
      out.x = ring * Math.cos(angle)
      out.y = up
      out.z = ring * Math.sin(angle)
      return out
    },
    get state() {
      return state
    },
  }
}

/** The Fluid Standard's generator (F17-18): a 32-bit linear congruential one. */
export function lcg(seed: number): RandomStream {
  let state = seed >>> 0
  const next = (): number => {
    state = (Math.imul(state, LCG_MULTIPLIER) + LCG_INCREMENT) >>> 0
    return state / LCG_RANGE
  }
  return {
    next,
    between: (min, max) => min + (max - min) * next(),
    direction(out) {
      const up = next() * 2 - 1
      const angle = next() * Math.PI * 2
      const ring = Math.sqrt(1 - up * up)
      out.x = ring * Math.cos(angle)
      out.y = up
      out.z = ring * Math.sin(angle)
      return out
    },
    get state() {
      return state
    },
  }
}

function mixEventSeed(eventSeed: number): number {
  let mixed = Math.imul((eventSeed | 0) ^ HASH_MIX, 0x85ebca6b)
  mixed ^= mixed >>> 13
  mixed = Math.imul(mixed, 0xc2b2ae35)
  mixed ^= mixed >>> 16
  return (mixed >>> 0) % (LEHMER_MODULUS - 1) + 1
}

/** The stream of one event: the same event seed draws the same effect on every machine, whatever else is playing (`randomMode: 'per_event'`). */
export function streamFor(eventSeed: number): RandomStream {
  return lehmer(mixEventSeed(eventSeed))
}
