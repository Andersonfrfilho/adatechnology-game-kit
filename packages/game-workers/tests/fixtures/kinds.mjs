// Kinds of the tests, plain JS so a worker_threads worker loads them from the built package (the test job builds it first).
import { defineResidentKind, defineTaskKind } from '../../dist/index.js'

/** A deterministic float kernel: enough arithmetic that a different order or precision would show in the bytes. */
export const waves = defineTaskKind({
  id: 'test.waves',
  lane: 'sim',
  priority: 100,
  latencyFrames: 2,
  late: 'sync',
  run: (input) => {
    const out = new Float32Array(input.n)
    let s = input.seed
    for (let i = 0; i < input.n; i++) {
      s = (s * 1664525 + 1013904223) >>> 0
      out[i] = Math.sin(i * 0.37 + s / 4294967296) * Math.sqrt(i + 1) - Math.fround(1 / (i + 1))
    }
    return { heights: out, sum: out.reduce((a, b) => a + b, 0) }
  },
  transferOutput: (out) => [out.heights.buffer],
  warmup: { n: 8, seed: 1 },
})

/** A resident whose step is a pure function of its init and its input. */
export const scaler = defineResidentKind({
  id: 'test.scaler',
  lane: 'sim',
  priority: 50,
  latencyFrames: 1,
  late: 'sync',
  create: (init) => ({ step: (input) => Float64Array.from(input, (v) => v * init.factor + init.offset) }),
  transferOutput: (out) => [out.buffer],
})

export const crash = defineTaskKind({
  id: 'test.crash',
  lane: 'build',
  priority: 10,
  late: 'sync',
  run: (input) => {
    if (input.inWorker && typeof globalThis.process !== 'undefined' && globalThis.__inWorker) process.exit(3)
    return input.value * 2
  },
})
