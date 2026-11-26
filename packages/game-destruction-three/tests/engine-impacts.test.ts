import { describe, expect, it } from 'vitest'

import type { DestructionWorld, Hit } from '@adatechnology/game-destruction'
import { createPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsWorld } from '@adatechnology/game-physics'

import { createEngineImpacts } from '../src/engine-impacts'
import { EngineStatics } from '../src/engine-statics'
import type { StaticSolid } from '../src/engine-statics'
import { IS_JOLT, physicsOption } from './setup-physics'

// the engine's contact rows are a mode of the engine only
const engineOnly = IS_JOLT ? describe : describe.skip

const MATERIAL = { frictionStatic: 0.6, frictionDynamic: 0.5, restitution: 0, rolling: 0, rollingDamping: 0 }

type Call = { readonly object: string; readonly part: string; readonly hit: Hit }

/** Just what the impacts use of the world: which parts exist, and what is hit. */
const stubWorld = (parts: ReadonlySet<string>): { readonly world: DestructionWorld; readonly calls: Call[] } => {
  const calls: Call[] = []
  const world = {
    part: (object: string, part: string) => (parts.has(`${object}/${part}`) ? {} : null),
    hitPart: (object: string, part: string, hit: Hit) => {
      calls.push({ object, part, hit })
      return {}
    },
  } as unknown as DestructionWorld
  return { world, calls }
}

const wall = (): StaticSolid => ({ center: [0, 1.5, 0], half: [3, 1.5, 0.1], rotation: [0, 0, 0, 1], key: 'slab:0' })

engineOnly('a blow on a fixed part becomes a blunt hit of the destruction world', () => {
  it('a crate thrown into a wall hits the wall part with the energy of the blow, along the way it went', () => {
    const loop = createPhysicsLoop(physicsOption() as PhysicsWorld)
    const statics = new EngineStatics(loop.world, MATERIAL)
    statics.lay(new Map([['wall', [wall()]]]))
    const { world: destruction, calls } = stubWorld(new Set(['wall/slab']))
    const stop = createEngineImpacts(loop, statics, destruction, { minImpulse: 5 })
    loop.world.createBody({ shape: { kind: 'box', half: [0.25, 0.25, 0.25] }, motion: 'dynamic', mass: 20, position: [0, 1, 3], linearVelocity: [0, 0, -12], layer: 'debris', continuous: true, user: 1 })
    for (let frame = 0; frame < 120 && calls.length === 0; frame++) loop.step(1 / 60)
    expect(calls.length).toBeGreaterThan(0)
    const first = calls[0]!
    expect(first.object).toBe('wall')
    expect(first.part).toBe('slab')
    expect(first.hit.type).toBe('blunt')
    expect(first.hit.source).toBe('engine')
    // 20 kg at 12 m/s is 1 440 J: the blow gives the wall a good part of it, never more than that
    expect(first.hit.energy ?? 0).toBeGreaterThan(300)
    expect(first.hit.energy ?? 0).toBeLessThan(1500)
    // the crate came from +z going -z: the blow goes into the wall along -z
    expect(first.hit.direction?.[2] ?? 0).toBeLessThan(-0.9)
    stop()
  })
})
