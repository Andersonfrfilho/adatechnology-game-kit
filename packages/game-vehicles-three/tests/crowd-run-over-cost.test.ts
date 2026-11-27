// @vitest-environment happy-dom
import { performance } from 'node:perf_hooks'

import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { UNDEAD_TYPES, undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { STATE } from '@adatechnology/game-crowd'
import type { CrowdPack } from '@adatechnology/game-crowd'
import { createCrowdTestModule } from '@adatechnology/game-crowd-three'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { JoltWorld } from '@adatechnology/game-physics-jolt'
import { createTestRoom } from '@adatechnology/game-test-room'

import { VEHICLES_AREA_ID, createVehiclesTestModule } from '../src'
import type { PhysicalCar } from '../src/test-area/physical-car'
import { defaultVehicleFleet } from './default-fleet'
import { fakeDocument } from './fake-dom'
import { stubRenderer } from './vehicles-room'

/**
 * Spec 008, TS.6, cost lane (`pnpm --filter @adatechnology/game-vehicles-three test:cost`, under `perf-measure.lock`): 300 agents and the room car in a room made as production makes
 * it. The limits in ms are charged only with `PHYSICS_COST=1`, never in `pnpm test`.
 */
const COST_LANE = process.env.PHYSICS_COST === '1'
const AGENTS = 300
const COLUMNS = 20
const STEP = 1 / 60
const SPEED = 10
const MODEL = 'compact_hatch'
const pack = undeadCrowdPack() as unknown as CrowdPack

const percentile = (samples: readonly number[], quantile: number): number => {
  const sorted = [...samples].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(quantile * sorted.length))] ?? 0
}

const sceneOf = async (agents: number) => {
  const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD }) as JoltWorld
  const loop = createPhysicsLoop(world)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, physics: loop })
  const vehicles = createVehiclesTestModule({ fleet: defaultVehicleFleet(), locale: 'en', document: fakeDocument as never, three: THREE, vehicles: [MODEL], wrecks: [] })
  const crowdModule = createCrowdTestModule({ pack, locale: 'en', typeName: (type) => UNDEAD_TYPES.find((card) => card.id === type.id)?.id ?? type.id })
  for (const module of [crowdModule, vehicles]) expect(room.loadModule(module as never).problems).toEqual([])
  room.openArea(VEHICLES_AREA_ID)
  room.clear()
  loop.stepFixed(1)
  room.spawn('hatch', [0, 0, -4], 0)
  loop.stepFixed(1)
  const root = [...(vehicles.placed as Map<string, { readonly root: THREE.Object3D }>).values()].find((entry) => entry.root.parent)!.root
  const car = root.userData.physicalCar as PhysicalCar
  for (let frame = 0; frame < 400 && !car.isBuilt(); frame++) loop.stepFixed(1)
  expect(car.isBuilt()).toBe(true)
  // a block of standing agents across the road, 1.2 m apart, the first row 12 m ahead of the car
  const { crowd } = crowdModule
  for (let k = 0; k < agents; k++) {
    const i = crowd.spawn(((k % COLUMNS) - COLUMNS / 2) * 1.2, 12 + Math.floor(k / COLUMNS) * 1.2, 0)
    crowd.store.height[i] = 1.7
    crowd.store.state[i] = STATE.DORMANT
  }
  loop.stepFixed(2)
  return { world, loop, room, crowd, car }
}

const run = async (agents: number): Promise<{ readonly steps: readonly number[]; readonly kills: number; readonly carZ: number }> => {
  const { world, loop, room, crowd, car } = await sceneOf(agents)
  const velocity = new Float64Array(6)
  const pose = new Float64Array(7)
  const steps: number[] = []
  for (let step = 0; step < 1800; step++) {
    world.readVelocity(car.chassis()!, velocity, 0)
    if (velocity[2]! < SPEED) world.setVelocity(car.chassis()!, [0, velocity[1]!, SPEED], [0, 0, 0])
    const started = performance.now()
    loop.stepFixed(1)
    steps.push(performance.now() - started)
    crowd.update(STEP, { bandCentre: [0, 0], flowTarget: [0, 0] })
    world.readPose(car.chassis()!, pose, 0)
    if (pose[2]! > 12 + (agents / COLUMNS) * 1.2 + 6) break
  }
  const result = { steps: steps.slice(5), kills: crowd.stats.kills, carZ: pose[2]! }
  room.dispose()
  world.dispose()
  return result
}

describe('TS.6 cost: 300 agents and the room car on the loop', () => {
  it('the car through the block of agents costs a step no more than the cost lane limits', { timeout: 300000 }, async () => {
    const without = await run(0)
    const crowded = await run(AGENTS)
    const round = (value: number): number => Math.round(value * 1000) / 1000
    const medianWithout = percentile(without.steps, 0.5)
    const medianCrowded = percentile(crowded.steps, 0.5)
    const p99Crowded = percentile(crowded.steps, 0.99)
    console.log(JSON.stringify({ name: 'ts6-cost', agents: AGENTS, kills: crowded.kills, steps: crowded.steps.length, medianMsWithoutAgents: round(medianWithout), medianMsWithAgents: round(medianCrowded), p99MsWithAgents: round(p99Crowded), maxMsWithAgents: round(Math.max(...crowded.steps)) }))
    expect(crowded.kills).toBeGreaterThan(0)
    if (COST_LANE) {
      // what the agents add to a step of the car alone, and the step as a whole
      expect(medianCrowded - medianWithout).toBeLessThanOrEqual(0.25)
      expect(p99Crowded).toBeLessThanOrEqual(2)
    }
  })
})
