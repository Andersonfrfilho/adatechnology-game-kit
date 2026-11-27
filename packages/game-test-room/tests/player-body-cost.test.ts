import { describe, expect, it } from 'vitest'

import { KIT_WORLD, createPhysicsLoop, createPhysicsServices } from '@adatechnology/game-physics'
import type { PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import { createEngineLocomotion } from '../src/player-body'

/**
 * Spec 008, TS.9m: what the player's body costs in a fixed step of the loop with 200 other bodies in the world. PHYSICS_COST=1 (`pnpm test:cost`, under the measure lock);
 * the limit in ms is asserted only here, never in `pnpm test`.
 */

const MEDIAN_LIMIT_MS = 0.05
const BODIES = 200
const STEPS = 3000
const WARM_UP_STEPS = 300
const COLUMNS = 14

const percentile = (values: readonly number[], share: number): number => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * share))] ?? 0

describe.runIf(process.env.PHYSICS_COST === '1')('the player body in a fixed step (spec 008, TS.9m)', () => {
  it(`one player walking among ${BODIES} bodies: the step of the player takes at most ${MEDIAN_LIMIT_MS} ms at the median`, { timeout: 300000 }, async () => {
    const world: PhysicsWorld = (await createJoltEngine()).createWorld(KIT_WORLD)
    world.createBody({ shape: { kind: 'box', half: [100, 0.5, 100] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
    for (let index = 0; index < BODIES; index++) {
      const x = ((index % COLUMNS) - COLUMNS / 2) * 3 + 1.5
      const z = (Math.floor(index / COLUMNS) - COLUMNS / 2) * 3 - 8
      world.createBody({ shape: { kind: 'box', half: [0.3, 0.3, 0.3] }, motion: 'dynamic', mass: 20, position: [x, 0.31, z], user: index })
    }
    const services = createPhysicsServices({ loop: createPhysicsLoop(world) })
    const colliders: Array<[number, number, number, number]> = Array.from({ length: 20 }, (_, index) => [30 + index * 2, 30, 31 + index * 2, 31])
    const body = createEngineLocomotion({ colliders, limit: 90, blockers: new Set([(x: number, z: number) => x > 60 && z > 60]) }, [0, 0, 6], { services })
    const durations: number[] = []
    let startedAt = 0
    services.loop.add({ beforeStep: () => void (startedAt = performance.now()) }, 'crowd')
    services.loop.add({ beforeStep: () => void durations.push(performance.now() - startedAt) }, 'actors')
    body.update(1 / 60, { walkX: 0, walkZ: 1, speed: 1.5, running: false, jump: false, walkHeld: false, crouched: false, rise: 0 })
    services.loop.stepFixed(WARM_UP_STEPS)
    durations.length = 0
    for (let step = 0; step < STEPS; step += 60) {
      const turn = (step / 60) % 2 === 0 ? -1 : 1
      body.update(1 / 60, { walkX: 0, walkZ: turn, speed: 1.5, running: false, jump: false, walkHeld: false, crouched: false, rise: 0 })
      services.loop.stepFixed(60)
    }
    const median = percentile(durations, 0.5)
    console.log(`player step over ${BODIES} bodies: median ${median.toFixed(4)} ms, p99 ${percentile(durations, 0.99).toFixed(4)} ms, max ${Math.max(...durations).toFixed(4)} ms (${durations.length} steps)`)
    expect(durations.length).toBe(STEPS)
    expect(median).toBeLessThanOrEqual(MEDIAN_LIMIT_MS)
    body.dispose()
    world.dispose()
  })
})
