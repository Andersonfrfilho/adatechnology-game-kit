// A simulation module of the tests: each step hands a `waves` job to a coordinator of its own and waits for it (the simulation thread may
// wait), folds the heights into its state and applies the commands; plain JS so the worker_threads worker loads it from the built package.
import { createWorkerCoordinator } from '../../dist/index.js'
import { nodeSpawn } from '../../dist/node.js'
import { waves } from './kinds.mjs'

export const STATE = 64

export const field = {
  id: 'test.field',
  create: (init) => {
    const state = new Float64Array(STATE)
    const workers = createWorkerCoordinator({ spawn: init.worker ? nodeSpawn(new URL('./node-worker.mjs', import.meta.url)) : () => { throw new Error('no worker') }, workers: init.worker ? 2 : 0 })
    return {
      step: async (frame, dt, commands) => {
        for (const c of commands) state[c[0] % STATE] += c[1]
        // two jobs at once, in the order they are folded whatever order they come back in
        const [a, b] = await Promise.all([workers.run(waves, { n: STATE, seed: frame * 2 + init.seed }), workers.run(waves, { n: STATE, seed: frame * 2 + 1 + init.seed })])
        for (let i = 0; i < STATE; i++) state[i] = state[i] * 0.97 + (a.heights[i] - b.heights[i]) * dt
      },
      write: (out) => new Float64Array(out.buffer, out.byteOffset, STATE).set(state),
      dispose: () => workers.dispose(),
    }
  },
}
