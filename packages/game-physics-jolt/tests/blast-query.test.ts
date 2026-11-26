import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import { createBlastQuery, createPhysicsLoop, createSensorVolumes } from '@adatechnology/game-physics'
import type { BodyId } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import { expectCostAtMost, ground, report, stats } from './scenes'

const AGENTS = 300
const RADIUS = 8

/** 300 agents standing on a 20 x 15 lattice a metre and a half apart, a blast in the middle, and a wall with five agents behind it. */
const scene = async () => {
  const engine = await createJoltEngine()
  const world = engine.createWorld({ fixedStep: 1 / 120, maxBodies: 4096 })
  ground(world, 100)
  const agents: BodyId[] = []
  for (let i = 0; i < AGENTS; i++) {
    agents.push(world.createBody({ shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.25 }, motion: 'kinematic', position: [((i % 20) - 10) * 0.6, 0.85, 3 + Math.floor(i / 20) * 0.5], layer: 'agent', user: i }))
  }
  // the blast is at (0, 1, 0); the wall stands at x = 3, between it and agents 5 m away behind it
  world.createBody({ shape: { kind: 'box', half: [0.1, 1.5, 3] }, motion: 'static', position: [3, 1.5, 0], user: -1 })
  const hidden: BodyId[] = []
  for (let k = 0; k < 5; k++) hidden.push(world.createBody({ shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.25 }, motion: 'kinematic', position: [5, 0.85, -1 + k * 0.5], layer: 'agent', user: 1000 + k }))
  world.step(1 / 60)
  return { world, agents, hidden }
}

describe('T7.3: what a blast asks the engine', () => {
  it('300 fragment rays, the bodies in the radius and a sight line to each: the wall hides the agents behind it, nothing else does', { timeout: 120000 }, async () => {
    const { world, agents, hidden } = await scene()
    const query = createBlastQuery(world)
    const result = query.run({ origin: [0, 1, 0], radius: RADIUS })
    expect(result.fragmentHits).toBeGreaterThan(100)
    expect(result.fragmentHits).toBeLessThanOrEqual(300)
    for (let i = 0; i < result.fragmentHits; i++) expect(result.fragmentDistance[i]).toBeLessThanOrEqual(RADIUS + 1e-3)
    // what the sphere touches: a capsule 0.25 m thick, standing level with the centre of the blast, is in when its axis is within the radius plus 0.25 m
    const inRadius: number[] = []
    let behindWall = 0
    for (let i = 0; i < AGENTS; i++) {
      const dx = ((i % 20) - 10) * 0.6
      const dz = 3 + Math.floor(i / 20) * 0.5
      if (Math.hypot(dx, dz) - 0.25 > RADIUS) continue
      inRadius.push(i)
      // the line from the centre crosses a face of the wall (x = 2.9 or 3.1) at z = dz * x / dx, and the wall is 6 m wide (z from -3 to 3): behind it when either is inside
      if (dx > 2.95 && (Math.abs((dz * 2.9) / dx) <= 3 || Math.abs((dz * 3.1) / dx) <= 3)) behindWall++
    }
    // and the two fixed bodies it overlaps, the ground and the wall
    expect(result.bodyCount).toBe(inRadius.length + hidden.length + 2)
    const seen = new Set<BodyId>()
    const agentBodies = new Set<BodyId>([...agents, ...hidden])
    for (let i = 0; i < result.bodyCount; i++) if (result.visible[i] === 1 && agentBodies.has(result.bodies[i]!)) seen.add(result.bodies[i]!)
    for (const body of hidden) expect(seen.has(body)).toBe(false)
    expect(behindWall).toBeGreaterThan(0)
    expect(seen.size).toBe(inRadius.length - behindWall)
    // the same blast again gives the same answer
    const first = Array.from(result.fragmentDistance.slice(0, result.fragmentHits))
    const again = query.run({ origin: [0, 1, 0], radius: RADIUS })
    expect(Array.from(again.fragmentDistance.slice(0, again.fragmentHits))).toEqual(first)
    world.dispose()
  })

  it('smoke sensors: a volume tells when an agent enters and when it leaves, follows a cloud that drifts, and is gone when removed', { timeout: 120000 }, async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 60, maxBodies: 1024 })
    ground(world, 50)
    const loop = createPhysicsLoop(world)
    const log: string[] = []
    const volumes = createSensorVolumes(loop, { onEnter: (volume, other) => log.push(`in:${volume}:${other}`), onExit: (volume, other) => log.push(`out:${volume}:${other}`) })
    const walker = world.createBody({ shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.25 }, motion: 'kinematic', position: [-12, 0.85, 0], layer: 'agent', user: 1 })
    volumes.add({ id: 7000, centre: [0, 1, 0], radius: 3 })
    for (let f = 0; f < 240; f++) {
      world.moveKinematic(walker, [-12 + f * 0.1, 0.85, 0], [0, 0, 0, 1], 1 / 60)
      loop.stepFixed(1)
      if (f === 120) expect(world.overlapSphere([0, 1, 0], 3, [], { layers: ['agent'] })).toBe(1)
    }
    expect(log).toEqual([`in:7000:${walker}`, `out:7000:${walker}`])
    // the cloud drifts onto the agent, which now stands still at x = 12: it comes in without moving
    volumes.move(7000, [12, 1, 0])
    log.length = 0
    for (let f = 0; f < 5; f++) loop.stepFixed(1)
    expect(log).toEqual([`in:7000:${walker}`])
    volumes.remove(7000)
    volumes.move(7000, [0, 1, 0])
    for (let f = 0; f < 5; f++) loop.stepFixed(1)
    expect(log).toHaveLength(1)
    volumes.dispose()
    world.dispose()
  })

  it('cost: a blast in the middle of 300 agents, 300 rays and 300 sight lines', { timeout: 120000 }, async () => {
    const { world } = await scene()
    const query = createBlastQuery(world)
    for (let warm = 0; warm < 20; warm++) query.run({ origin: [0, 1, 0], radius: RADIUS, spin: warm })
    const samples: number[] = []
    for (let k = 0; k < 200; k++) {
      const started = performance.now()
      query.run({ origin: [0, 1, 0], radius: RADIUS, spin: k * 0.1 })
      samples.push(performance.now() - started)
    }
    const measured = stats(samples)
    report('blast-query', { agents: AGENTS, blast: measured })
    // spec.md 6: a blast in 1 ms (the cost lane)
    expectCostAtMost(measured.median, 1)
    world.dispose()
  })
})
