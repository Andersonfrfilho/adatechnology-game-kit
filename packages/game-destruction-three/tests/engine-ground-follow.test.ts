import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { BodyId, SeamWorld } from '@adatechnology/game-physics'

import { IDLE_UPDATES } from '../src/engine-ground-follow'
import { PieceSystem } from '../src/pieces'
import { physicsOption } from './setup-physics'

/** Spec 008, TS.1b: the ground a body of the world that is not a piece asked for goes when nobody asked for it for long and nothing that moves is on it. Jolt only. */
interface Engine {
  readonly follow: { readonly watched: number }
  readonly tiles: ReadonlyMap<number, unknown>
  prepare(list: readonly unknown[], dt: number, h: number, apart: ReadonlySet<string>): void
}

const labOf = () => {
  const world = physicsOption() as SeamWorld
  const system = new PieceSystem(THREE, { physics: world, groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
  const engine = (system as unknown as { engine: Engine }).engine
  const step = (frames: number): void => {
    for (let i = 0; i < frames; i++) system.update(1 / 60)
  }
  return { world, engine, step }
}

describe('the ground follows the bodies that are not the pieces (spec 008, TS.1b)', () => {
  it('lays ground under a body made where there is none, and under a character', () => {
    const { world, engine, step } = labOf()
    expect(engine.tiles.size).toBe(0)
    world.createBody({ shape: { kind: 'sphere', radius: 0.1 }, motion: 'dynamic', mass: 1, layer: 'debris', position: [50, 1, 50], user: 0 })
    world.createCharacter({ halfHeight: 0.5, radius: 0.3, mass: 80, strength: 100, position: [-50, 0.2, 50] })
    step(1)
    expect(engine.tiles.size).toBeGreaterThanOrEqual(2)
  })

  it('takes away the tiles nobody asked for in IDLE_UPDATES, but keeps one with a body asleep on it', () => {
    const { world, engine, step } = labOf()
    const sleeper: BodyId = world.createBody({ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, motion: 'dynamic', mass: 5, layer: 'prop', position: [10, 0.2, 10], user: 0 })
    const mover: BodyId = world.createBody({ shape: { kind: 'sphere', radius: 0.2 }, motion: 'dynamic', mass: 5, layer: 'vehicle', position: [10, 0.2, -30], user: 1 })
    step(1)
    world.setVelocity(mover, [0, 0, 20], [0, 0, 0])
    step(60)
    world.removeBody(mover)
    const afterRun = engine.tiles.size
    expect(afterRun).toBeGreaterThan(4)
    for (let i = 0; i < 40 && world.isSleeping(sleeper) === false; i++) step(20)
    expect(world.isSleeping(sleeper)).toBe(true)
    step(IDLE_UPDATES + 120)
    // the sleeper keeps the tile it lies on; the rest of the path is gone
    expect(engine.tiles.size).toBeLessThan(afterRun)
    expect(engine.tiles.size).toBeGreaterThanOrEqual(1)
    expect(engine.follow.watched).toBe(engine.tiles.size)
  })
})
