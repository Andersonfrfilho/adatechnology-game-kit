import { appendFileSync } from 'node:fs'

import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { BodyId, SeamWorld } from '@adatechnology/game-physics'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

/**
 * TS.8 cost: the TS.1b scene (300 awake pieces thrown up every 20 frames over a fixed slab, 10 bodies of the world that are not the pieces' crossing at 30 m/s) with the
 * contact hits on and off. PHYSICS_COST=1 (`pnpm test:cost`, under the measure lock) prints the median and p99 of `renderer.update` (the step and what follows it) and the hits made.
 */
const OUTSIDE = 10
const SPEED = 30
const FRAMES = 400
const ROUNDS = 3

const median = (values: readonly number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0
const p99Of = (values: readonly number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length * 0.99)] ?? 0
const roundOf = (value: number): number => Math.round(value * 1000) / 1000

const runOnce = (contactHits: boolean): { readonly median: number; readonly p99: number; readonly hits: number } => {
  const scene = new THREE.Scene()
  const fake = new FakeWorld()
  const physics = physicsOption() as SeamWorld
  const renderer = createDestructionRenderer(THREE, { physics, scene, world: fake.asWorld(), ...(contactHits ? { contactHits: true } : {}) })
  let seed = 7
  const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647
  const slab = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 6))
  const slabRoot = new THREE.Group()
  slabRoot.add(slab)
  slabRoot.position.set(-298, 0.2, 2)
  scene.add(slabRoot)
  slabRoot.updateMatrixWorld(true)
  fake.addObject('slab', [partState('top', 'concrete', { mass: 20000 })])
  renderer.bind('slab', slabRoot, { parts: { top: slab } })
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
  for (let k = 0; k < OUTSIDE; k++) cars.push(physics.createBody({ shape: { kind: 'box', half: [0.9, 0.7, 2.25] }, motion: 'dynamic', mass: 1200, layer: 'vehicle', position: [k * 12, 0.72, 0], user: 0 }))
  const times: number[] = []
  for (let frame = 0; frame < FRAMES; frame++) {
    if (frame % 20 === 0) for (const id of ids) renderer.impulse(id, [(random() - 0.5) * 4, 3 + random() * 3, (random() - 0.5) * 4])
    for (const car of cars) physics.setVelocity(car, [0, 0, SPEED], [0, 0, 0])
    const started = performance.now()
    renderer.update(1 / 60)
    times.push(performance.now() - started)
  }
  const hits = fake.hits.filter((entry) => entry.id === 'slab').length
  renderer.dispose()
  for (const car of cars) physics.removeBody(car)
  return { median: median(times), p99: p99Of(times), hits }
}

describe.runIf(process.env.PHYSICS_COST === '1')('contact hits cost (TS.8)', () => {
  it('300 awake pieces over a fixed part and 10 outside bodies: the hits on and off', { timeout: 600000 }, () => {
    runOnce(true)
    const rounds = Array.from({ length: ROUNDS }, () => {
      const off = runOnce(false)
      const on = runOnce(true)
      return { off: { medianMs: roundOf(off.median), p99Ms: roundOf(off.p99), hits: off.hits }, on: { medianMs: roundOf(on.median), p99Ms: roundOf(on.p99), hits: on.hits } }
    })
    const line = JSON.stringify({ name: 'contact-hits-300-10', rounds })
    console.log(line)
    if (process.env.SPIKE_OUT) appendFileSync(process.env.SPIKE_OUT, `${line}\n`)
    expect(rounds.every((round) => round.off.hits === 0)).toBe(true)
    expect(rounds.some((round) => round.on.hits > 0)).toBe(true)
  })
})
