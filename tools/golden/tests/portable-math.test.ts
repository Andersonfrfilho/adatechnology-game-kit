import { describe, expect, it } from 'vitest'
import { installPortableMath, portablePow } from '../src'

// Same recipe in every run: a small linear congruential generator, so the inputs never change between Node versions.
function sampleInputs(count: number): number[] {
  let state = 12345
  const inputs: number[] = []
  for (let index = 0; index < count; index++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    inputs.push((state / 4294967296) * 10 + 1e-3)
  }
  return inputs
}

function fingerprint(compute: (value: number) => number): string {
  const buffer = new Float64Array(1)
  const words = new Uint32Array(buffer.buffer)
  let hash = 2166136261
  for (const value of sampleInputs(20000)) {
    buffer[0] = compute(value)
    for (const word of words) {
      hash ^= word
      hash = Math.imul(hash, 16777619)
    }
  }
  return (hash >>> 0).toString(16)
}

// These fingerprints were taken on Node 22.23 and on Node 24.22, which agree. If one fails on a newer Node, that Node changed the last
// bit of the function and every golden hash can move: read tools/golden/README.md ("Hashes must not depend on the Node version").
const NATIVE_MATH_FINGERPRINTS: Record<string, [(value: number) => number, string]> = {
  exp: [Math.exp, '6bef8123'],
  log: [Math.log, 'cec629c1'],
  sin: [Math.sin, '7f7eee45'],
  cos: [Math.cos, '6acdc8cb'],
  tan: [Math.tan, '207f5211'],
  atan: [Math.atan, '479d8496'],
  atan2: [(value) => Math.atan2(value, 1.3), '963a112d'],
  acos: [(value) => Math.acos(value % 1), '7885441f'],
  asin: [(value) => Math.asin(value % 1), '13e645cc'],
  sqrt: [Math.sqrt, '9bec9575'],
  cbrt: [Math.cbrt, '33896eb2'],
}

describe('portablePow', () => {
  it('gives the same bits on every Node version (fingerprint taken on Node 22 and 24)', () => {
    expect(fingerprint((value) => portablePow(value, 0.25))).toBe('9045bb8e')
    expect(fingerprint((value) => portablePow(value, 1.7))).toBe('8c7ae62a')
    expect(fingerprint((value) => portablePow(value, 3))).toBe('21dd91b7')
  })

  it('is as accurate as the native one (within a few ulps) and exact for integer exponents', () => {
    for (const value of sampleInputs(2000)) {
      expect(Math.abs(portablePow(value, 0.25) / Math.pow(value, 0.25) - 1)).toBeLessThan(1e-14)
      expect(Math.abs(portablePow(value, 1.7) / Math.pow(value, 1.7) - 1)).toBeLessThan(1e-14)
      expect(portablePow(value, 2)).toBe(value * value)
      expect(portablePow(value, -1)).toBe(1 / value)
    }
  })

  it('keeps the special cases of Math.pow', () => {
    expect(portablePow(5, 0)).toBe(1)
    expect(portablePow(0, 3)).toBe(0)
    expect(portablePow(0, -1)).toBe(Infinity)
    expect(portablePow(-2, 3)).toBe(-8)
    expect(portablePow(-2, 2)).toBe(4)
    expect(portablePow(-2, 0.5)).toBeNaN()
    expect(portablePow(NaN, 2)).toBeNaN()
    expect(portablePow(2, Infinity)).toBe(Infinity)
  })
})

describe('installPortableMath', () => {
  it('replaces Math.pow on the target and restores the original', () => {
    const native = (): number => 42
    const target = { Math: { pow: native } }
    const restore = installPortableMath(target)
    expect(target.Math.pow).toBe(portablePow)
    restore()
    expect(target.Math.pow).toBe(native)
  })
})

describe('native Math canary', () => {
  for (const [name, [compute, expected]] of Object.entries(NATIVE_MATH_FINGERPRINTS)) {
    it(`Math.${name} returns the bits the goldens were taken with`, () => {
      expect(fingerprint(compute)).toBe(expected)
    })
  }
})

describe('portablePow while installed', () => {
  it('does not call itself through Math.pow', () => {
    const restore = installPortableMath()
    try {
      expect(Math.pow(0, -1)).toBe(Infinity)
      expect(Math.pow(NaN, 2)).toBeNaN()
      expect(Math.pow(2, 10)).toBe(1024)
    } finally {
      restore()
    }
  })
})
