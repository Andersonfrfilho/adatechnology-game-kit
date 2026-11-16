import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestruction } from '@adatechnology/game-destruction'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import { warmUpDestructionJit } from '../src/jit-warmup'
import { createDestructionRenderer } from '../src/renderer'
import type { RendererOptions } from '../src/types'

const make = (options: RendererOptions) => createDestructionRenderer(THREE, options)

describe('the JIT warm-up', () => {
  it('runs one blast on the kit solver, once, and leaves the scene it was given alone', () => {
    const report = warmUpDestructionJit(THREE, make)
    expect(report).toBeDefined()
    expect(report!.fragments + report!.pieces).toBeGreaterThan(0)
    expect(warmUpDestructionJit(THREE, make)).toBeUndefined()
  })

  it('runs on an engine and frees its world, so the wasm heap holds the same worlds as before', async () => {
    const engine = await createJoltEngine()
    let made = 0
    let disposed = 0
    const counted = {
      name: engine.name,
      createWorld: (desc?: Parameters<typeof engine.createWorld>[0]) => {
        made++
        const world = engine.createWorld(desc)
        const dispose = world.dispose.bind(world)
        world.dispose = () => (disposed++, dispose())
        return world
      },
    }
    const report = warmUpDestructionJit(THREE, make, { engine: counted })
    expect(report!.pieces).toBeGreaterThan(0)
    expect(made).toBe(1)
    expect(disposed).toBe(1)
  })

  it('is off with jitWarmUp: false and on, by default, through the renderer', async () => {
    const engine = await createJoltEngine()
    let made = 0
    const fresh = () => ({ name: 'fresh', createWorld: (desc?: Parameters<typeof engine.createWorld>[0]) => (made++, engine.createWorld(desc)) })
    const base = { physics: 'own' as const, scene: new THREE.Scene(), world: createDestruction() }
    const skipped = fresh()
    createDestructionRenderer(THREE, { ...base, jitWarmUp: false }).dispose()
    createDestructionRenderer(THREE, { ...base, jitWarmUp: { engine: skipped } }).dispose()
    expect(made).toBe(1)
    createDestructionRenderer(THREE, { ...base, jitWarmUp: { engine: skipped } }).dispose()
    expect(made).toBe(1)
  })
})
