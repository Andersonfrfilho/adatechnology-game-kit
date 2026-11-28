import assert from 'node:assert/strict'
import { test } from 'node:test'

import { checkOwnIntegrator, checkSizeBlind, motionHits, scanMotion } from '../motion.mjs'

const FILE = 'packages/game-destruction-three/src/example.ts'
const sizeBlind = (/** @type {string} */ text, path = FILE) => scanMotion(path, text).sizeBlind.map((hit) => hit.line)
const integrators = (/** @type {string} */ text, path = FILE) => scanMotion(path, text).integrators.map((hit) => hit.line)

test('size-blind-motion: a fixed rad/s write is a hit, a write that cites the body size is not', () => {
  assert.deepEqual(sizeBlind('function f() {\n  f.ang.x += 3\n}'), [2])
  assert.deepEqual(sizeBlind('const w = b.angularVelocity\nb.angularVelocity[0] = 1.5'), [2])
  assert.deepEqual(sizeBlind('x = { angularVelocity: [(rnd() - 0.5) * 12, 0, 0] }'), [1])
  assert.deepEqual(sizeBlind('f.ang.x += tip.z / reach'), [])
  assert.deepEqual(sizeBlind('f.ang.x += speed / halfLength'), [])
  assert.deepEqual(sizeBlind('b.angularVelocity[0] += torque / inertia'), [])
})

test('size-blind-motion: slerp and spin constants', () => {
  assert.deepEqual(sizeBlind('mesh.quaternion.slerp(q, dt * 7)'), [1])
  assert.deepEqual(sizeBlind('const THROW_SPIN = 8'), [1])
  assert.deepEqual(sizeBlind('const SPIN_PULL_GAP = 0.1'), [])
})

test('size-blind-motion: copies, zeroes, types and comments are not writes', () => {
  assert.deepEqual(sizeBlind('x = { angularVelocity: [b.angularVelocity[0], b.angularVelocity[1], b.angularVelocity[2]] }'), [])
  assert.deepEqual(sizeBlind('f.ang.set(0, 0, 0)'), [])
  assert.deepEqual(sizeBlind('b.angularVelocity[0] = b.angularVelocity[1] = b.angularVelocity[2] = 0'), [])
  assert.deepEqual(sizeBlind('  angularVelocity: Vec3'), [])
  assert.deepEqual(sizeBlind('// f.ang.x += 3\n/* f.ang.y += 3 */'), [])
})

test('own-integrator: position, angle and speed steps by a time step', () => {
  assert.deepEqual(integrators('pos.y += vel.y * dt'), [1])
  assert.deepEqual(integrators('mesh.position.addScaledVector(f.vel, dt)'), [1])
  assert.deepEqual(integrators('f.vel.y -= GRAVITY * dt'), [1])
  assert.deepEqual(integrators('mesh.rotation.x += body.spin.x * dt'), [1])
  assert.deepEqual(integrators('phase += dt * cadence'), [])
  assert.deepEqual(integrators('smokeDebt += dt * smokeLevel * RATE'), [])
})

test('own-integrator: the engine packages and shader sources are exempt', () => {
  assert.deepEqual(integrators('pos.y += vel.y * dt', 'packages/game-physics/src/step.ts'), [])
  assert.deepEqual(integrators('pos.y += vel.y * dt', 'packages/game-physics-jolt/src/world.ts'), [])
  assert.deepEqual(integrators('pos.y += vel.y * dt', 'packages/game-vfx-three/src/shaders/water.ts'), [])
})

test('lists: a hit in no entry is open, an equal line over its count is open, an entry that covers nothing is stale', () => {
  const hits = scanMotion(FILE, 'function f() {\n  f.ang.x += 3\n  f.ang.x += 3\n}').sizeBlind
  const entry = { file: FILE, anchor: 'f', match: 'f.ang.x += 3', risk: 'low', reference: 'test' }
  assert.equal(checkSizeBlind(hits, []).open.length, 2)
  assert.equal(checkSizeBlind(hits, [entry]).open.length, 1)
  assert.equal(checkSizeBlind(hits, [{ ...entry, count: 2 }]).open.length, 0)
  assert.equal(checkSizeBlind([], [entry]).stale.length, 1)
  const steps = scanMotion(FILE, 'function g() {\n  a.x += vel.x * dt\n  a.y += vel.y * dt\n}').integrators
  const listed = { file: FILE, anchor: 'g', lines: 1, risk: 'low', reference: 'test' }
  assert.equal(checkOwnIntegrator(steps, []).open.length, 2)
  assert.equal(checkOwnIntegrator(steps, [listed]).open.length, 1)
  assert.equal(checkOwnIntegrator(steps, [{ ...listed, lines: 2 }]).open.length, 0)
})

test('the repository matches the recorded lists', () => {
  const hits = motionHits()
  const sizeBlindResult = checkSizeBlind(hits.sizeBlind)
  const integratorResult = checkOwnIntegrator(hits.integrators)
  assert.deepEqual(sizeBlindResult.open.map((hit) => `${hit.file}:${hit.line}`), [])
  assert.deepEqual(sizeBlindResult.stale.map((entry) => entry.match), [])
  assert.deepEqual(integratorResult.open.map((hit) => `${hit.file}:${hit.line}`), [])
  assert.deepEqual(integratorResult.stale.map((entry) => `${entry.file}::${entry.anchor}`), [])
})
