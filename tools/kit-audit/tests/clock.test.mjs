import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ownFrameClock, scanOwnFrameClock } from '../clock.mjs'

const scan = (/** @type {string} */ path, /** @type {string} */ text) => scanOwnFrameClock(path, text).map((hit) => `${hit.kind}:${hit.line}`)
const OWNER = 'packages/game-fluids-three/src/film/manager.ts'

test('flags a *_BUDGET_MS or *_SLICE_MS constant outside game-runtime', () => {
  assert.deepEqual(scan(OWNER, 'const DEFAULT_BUDGET_MS = 1.2\nexport const PREFIT_SLICE_MS = 1\nconst BUDGET_MS = 3'), ['constant:1', 'constant:2', 'constant:3'])
})

test('flags performance.now() or Date.now() compared with a deadline, in both orders, or added to a budget', () => {
  assert.deepEqual(scan(OWNER, 'if (performance.now() >= deadline) break'), ['deadline:1'])
  assert.deepEqual(scan(OWNER, 'if (Date.now() > until) return'), ['deadline:1'])
  assert.deepEqual(scan(OWNER, 'while (deadline > performance.now()) step()'), ['deadline:1'])
  assert.deepEqual(scan(OWNER, 'if (performance.now() - start > budget) stop()'), ['deadline:1'])
  assert.deepEqual(scan(OWNER, 'const end = performance.now() + options.budgetMs'), ['deadline:1'])
})

test('exempt class: game-runtime, game-workers, benches and the WorkBudget are not scanned', () => {
  const text = 'const FRAME_BUDGET_MS = 4\nif (performance.now() >= deadline) break'
  for (const path of ['packages/game-runtime/src/budget.ts', 'packages/game-workers/src/coordinator.ts', 'packages/game-audio/src/bench/sound-check.ts', 'packages/game-physics/src/work-budget.ts']) {
    assert.deepEqual(scan(path, text), [], path)
  }
})

test('exempt class: drainDetached of game-contracts, and only it', () => {
  const frame = [
    'export function drainDetached(queue, budgetMs, clock = () => performance.now()) {',
    '  const deadline = clock() + budgetMs',
    '  if (performance.now() >= deadline) return 0',
    '  return queue.run(deadline, clock)',
    '}',
    'export function other() {',
    '  if (performance.now() >= deadline) return 0',
    '}',
  ].join('\n')
  assert.deepEqual(scan('packages/game-contracts/src/frame.ts', frame), ['deadline:7'])
  assert.deepEqual(scan('packages/game-audio/src/frame.ts', frame), ['deadline:3', 'deadline:7'])
})

test('exempt class: waits, rates and expiry timers are not deferred work', () => {
  assert.deepEqual(scan(OWNER, "if (Date.now() - started > WAIT_LIMIT_MS) throw new Error('worker did not answer')"), [])
  assert.deepEqual(scan(OWNER, 'if (performance.now() - lastRay < RAY_INTERVAL_MS) return'), [])
  assert.deepEqual(scan(OWNER, 'if (performance.now() - at < REBATCH_AFTER_MS) return'), [])
  assert.deepEqual(scan(OWNER, 'return performance.now() < shared.inter.msg.until ? shared.inter.msg.text : null'), [])
  assert.deepEqual(scan(OWNER, 'if (performance.now() - downAt < 400) tap()'), [])
})

test('exempt class: measurement and animation read the clock without a deadline', () => {
  assert.deepEqual(scan(OWNER, 'const buildMs = performance.now() - t0\nstats.simMs += performance.now() - start\nconst shift = (Date.now() % 1_000_000) * 0.001 * WAVE_SPEED'), [])
  assert.deepEqual(scan(OWNER, 'const stats = { overBudget: !!budget && s0.n > budget, tBuild: performance.now() - t0 }'), [])
})

test('negative: an injected clock inside run(deadline, clock) and ordinary constants are fine', () => {
  assert.deepEqual(scan(OWNER, 'run(deadline, clock) {\n  if (clock() >= deadline) return\n}\nconst WAVE_SPEED = 0.4\nconst MAX_BATCH_VERTICES = 4096'), [])
})

test('ownFrameClock splits known pending hits (with their task) from open ones and reports stale entries', (context) => {
  const all = ownFrameClock({ pending: [] })
  assert.equal(all.pending.length, 0)
  assert.equal(all.open.length, all.hits.length)
  const sample = all.hits[0]
  if (!sample) return context.skip('no hit left: the phase 1 migration is done')
  const split = ownFrameClock({ pending: [{ file: sample.file, match: sample.code, task: 'T9.9' }, { file: 'packages/x/src/gone.ts', match: 'nothing', task: 'T9.8' }] })
  assert.equal(split.pending[0]?.pending, 'T9.9')
  assert.equal(split.open.length, all.hits.length - split.pending.length)
  assert.deepEqual(split.stale.map((entry) => entry.task), ['T9.8'])
})

test('a budget constant used in a performance.now() deadline stays flagged, even next to a drainDetached use', () => {
  const text = 'const SLICE_MS = 1\nconst end = performance.now() + SLICE_MS\ndrainDetached(queue, SLICE_MS)'
  assert.deepEqual(scan(OWNER, text), ['constant:1', 'deadline:2'])
  assert.deepEqual(scan(OWNER, 'const SLICE_MS = 1\nif (ms > SLICE_MS) stop()'), ['constant:1'])
})

test('exempt by usage: a budget constant only passed to drainDetached, or used as a budgetMs option or default', () => {
  assert.deepEqual(scan(OWNER, 'const DEFAULT_BUDGET_MS = 1.2\ndrainDetached(queue, options.budgetMs ?? DEFAULT_BUDGET_MS, now)'), [])
  assert.deepEqual(scan(OWNER, 'const PREFIT_SLICE_MS = 1\nreturn drainDetached(queue, Math.min(left, PREFIT_SLICE_MS), clock)'), [])
  assert.deepEqual(scan(OWNER, '/** made over frames (`HOUSE_BUDGET_MS` each) */\nexport const HOUSE_BUDGET_MS = 2\nmake({ queue, budgetMs: HOUSE_BUDGET_MS })'), [])
  assert.deepEqual(scan(OWNER, 'const DEFAULT_BUDGET_MS = 2\nfunction pump(budgetMs = DEFAULT_BUDGET_MS) {}'), [])
})
