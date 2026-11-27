import { appendFileSync } from 'node:fs'

import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { BodyId, SeamWorld } from '@adatechnology/game-physics'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { IS_JOLT, physicsOption } from './setup-physics'

/**
 * TS.1b cost: 300 awake pieces and 10 bodies of the world that are not the pieces' crossing 200 m at 30 m/s. PHYSICS_COST=1 (`pnpm test:cost`, under the measure lock):
 * it prints the cost of the pass and the tiles after the run and after the idle tiles are taken away. The limits in ms are only asserted here, never in `pnpm test`.
 */
interface Probe {
  readonly pieceSys: { readonly engine: { readonly follow: { readonly watched: number; update(dt: number, stamp: number): void }; readonly tiles: ReadonlyMap<number, unknown> } }
}

const OUTSIDE = 10
const SPEED = 30
const FRAMES = 400
const IDLE_FRAMES = 1500

const median = (values: readonly number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0
const roundOf = (value: number): number => Math.round(value * 1000) / 1000

const runOnce = (outside: number): { readonly passMedian: number; readonly passP99: number; readonly passMax: number; readonly median: number; readonly p99: number; readonly tilesAfterRun: number; readonly tilesAfterIdle: number; readonly watched: number } => {
  const scene = new THREE.Scene()
  const fake = new FakeWorld()
  const physics = physicsOption() as SeamWorld
  const renderer = createDestructionRenderer(THREE, { physics, scene, world: fake.asWorld() })
  let seed = 7
  const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647
  const ids: string[] = []
  for (let i = 0; i < 300; i++) {
    const id = `p${i}`
    fake.addObject(id, [partState('body', 'concrete', { mass: 20 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(-300 + random() * 4, 1 + (i % 30) * 0.3, random() * 4)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: { body: mesh } })
    renderer.makePiece(id)
    ids.push(id)
  }
  const cars: BodyId[] = []
  for (let k = 0; k < outside; k++) {
    cars.push(physics.createBody({ shape: { kind: 'box', half: [0.9, 0.7, 2.25] }, motion: 'dynamic', mass: 1200, layer: 'vehicle', position: [k * 12, 0.72, 0], user: 0 }))
  }
  const probe = (renderer as unknown as Probe).pieceSys.engine
  const times: number[] = []
  const passes: number[] = []
  const pass = probe.follow.update.bind(probe.follow)
  probe.follow.update = (dt, stamp) => {
    const started = performance.now()
    pass(dt, stamp)
    passes.push(performance.now() - started)
  }
  for (let frame = 0; frame < FRAMES; frame++) {
    if (frame % 20 === 0) for (const id of ids) renderer.impulse(id, [(random() - 0.5) * 4, 3 + random() * 3, (random() - 0.5) * 4])
    for (const car of cars) physics.setVelocity(car, [0, 0, SPEED], [0, 0, 0])
    const started = performance.now()
    renderer.update(1 / 60)
    times.push(performance.now() - started)
  }
  const runPasses = passes.slice(0, FRAMES)
  const tilesAfterRun = probe.tiles.size
  for (const car of cars) physics.removeBody(car)
  for (let frame = 0; frame < IDLE_FRAMES; frame++) renderer.update(1 / 60)
  return { passMedian: median(runPasses), passP99: [...runPasses].sort((a, b) => a - b)[Math.floor(runPasses.length * 0.99)] ?? 0, passMax: Math.max(...runPasses), median: median(times), p99: [...times].sort((a, b) => a - b)[Math.floor(times.length * 0.99)] ?? 0, tilesAfterRun, tilesAfterIdle: probe.tiles.size, watched: probe.follow.watched }
}

describe.runIf(IS_JOLT && process.env.PHYSICS_COST === '1')('ground follow cost (TS.1b)', () => {
  it('300 awake pieces and 10 outside bodies crossing 200 m: the pass costs little and the idle tiles go', { timeout: 300000 }, () => {
    runOnce(0)
    const without = runOnce(0)
    const withOutside = runOnce(OUTSIDE)
    const line = JSON.stringify({
      name: 'ground-follow-300-10',
      withoutOutside: { updateMedianMs: roundOf(without.median), updateP99Ms: roundOf(without.p99), tilesAfterRun: without.tilesAfterRun, tilesAfterIdle: without.tilesAfterIdle },
      withOutside: { updateMedianMs: roundOf(withOutside.median), updateP99Ms: roundOf(withOutside.p99), tilesAfterRun: withOutside.tilesAfterRun, tilesAfterIdle: withOutside.tilesAfterIdle, watchedAfterIdle: withOutside.watched },
      passMs: { median: roundOf(withOutside.passMedian), p99: roundOf(withOutside.passP99), max: roundOf(withOutside.passMax) },
      withoutOutsidePassMedianMs: roundOf(without.passMedian),
    })
    console.log(line)
    if (process.env.SPIKE_OUT) appendFileSync(process.env.SPIKE_OUT, `${line}\n`)
    expect(withOutside.tilesAfterIdle).toBeLessThan(withOutside.tilesAfterRun)
    expect(withOutside.passMedian).toBeLessThan(1)
  })
})
