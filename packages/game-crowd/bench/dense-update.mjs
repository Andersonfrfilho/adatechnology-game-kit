// Cost of crowd.update with N agents packed against a wall, all in band R0. Usage: node bench/dense-update.mjs [counts...] (PHYSICS=1 turns the physics on, ITERATIONS=1|2|3 sets the contact iterations).
import { undeadCrowdPack } from '@adatechnology/game-characters-undead'

import * as crowdPackage from '../dist/index.js'

const { CELL, CROWD_PHYSICS_DEFAULTS, STATE, createCrowd, createNavGrid } = crowdPackage
const STEP = 1 / 60
const WARMUP = 120
const MEASURED = 300
const counts = process.argv.slice(2).map(Number)
const iterations = Number(process.env.ITERATIONS ?? 2)
const physics = process.env.PHYSICS === '1' && CROWD_PHYSICS_DEFAULTS ? { ...CROWD_PHYSICS_DEFAULTS, contact: { ...CROWD_PHYSICS_DEFAULTS.contact, iterations } } : undefined

const percentile = (sorted, share) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))]

const run = (count) => {
  const grid = createNavGrid({ size: 128, border: true })
  grid.fillRect(-15, -0.5, 15, 0.5, CELL.SOLID, 3)
  const target = { state: { x: 0, z: 4, y: 0, floor: 0, alive: true, turned: false, crouch: false, bleeding: 0, scentTimer: 0, screamBoost: 0, grabbedBy: -1, blind: 0, burnTimer: 0, yaw: 0 }, grab() {}, hurt() {}, knock() {}, release() {} }
  const crowd = createCrowd({ pack: undeadCrowdPack(), seed: 21, grid, capacity: 4000, target, flow: { cellsPerStep: 20000, clock: () => 0 }, ...(physics ? { physics } : {}) })
  const columns = 50
  for (let k = 0; k < count; k++) {
    const row = Math.floor(k / columns)
    const x = ((k % columns) - columns / 2 + (row % 2) * 0.5) * 0.6
    const i = crowd.spawn(x, -1.5 - row * 0.55, 0)
    crowd.store.state[i] = STATE.CHASE
  }
  const context = { target, bandCentre: [0, -12] }
  for (let step = 0; step < WARMUP; step++) crowd.update(STEP, context)
  const times = []
  for (let step = 0; step < MEASURED; step++) {
    const start = performance.now()
    crowd.update(STEP, context)
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  const mean = times.reduce((sum, value) => sum + value, 0) / times.length
  const { bands } = crowd.stats
  console.log(JSON.stringify({ count, physics: Boolean(physics), agents: crowd.store.n, bands, meanMs: +mean.toFixed(3), p50Ms: +percentile(times, 0.5).toFixed(3), p99Ms: +percentile(times, 0.99).toFixed(3), maxMs: +times.at(-1).toFixed(3) }))
}

for (const count of counts.length ? counts : [1000, 2000]) run(count)
