import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createVfx } from '@adatechnology/game-vfx'
import { createDestructionRenderer } from '../src/renderer'
import type { RendererOptions } from '../src/types'
import { FakeWorld, partState } from './fake-world'

function setup(options: Partial<RendererOptions> = {}) {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const vfx = createVfx({ seed: 3 })
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), vfx, ...options })
  world.addObject('o1', [partState('wall', 'concrete')])
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 0.2), new THREE.MeshStandardMaterial({ color: 0xcfc8b8 }))
  wall.position.set(0, 1.05, 0)
  const root = new THREE.Group()
  root.add(wall)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('o1', root, { parts: { wall } })
  return { world, renderer, vfx }
}

const alive = (vfx: ReturnType<typeof createVfx>): number => {
  const engine = vfx.workshop()
  return engine.add.count + engine.normal.count + engine.debris.count + engine.decals.count + engine.streaks.count
}

describe('destruction events play their effect', () => {
  it('spall plays the impact of the material', () => {
    const { world, renderer, vfx } = setup()
    world.emit({ type: 'spall', object: 'o1', part: 'wall', layer: 0, point: [0.3, 1.2, 0.1], area: 0.0113 })
    renderer.update(0.016)
    expect(alive(vfx)).toBeGreaterThan(0)
  })

  it('exposed rebar plays rebar_expose, collapse plays collapse_dust and stage 2 the breach dust instead of its own burst', () => {
    const { world, renderer, vfx } = setup()
    world.emit({ type: 'expose', object: 'o1', part: 'wall', bars: [[[-0.5, 1, 0], [0.5, 1, 0]]] })
    renderer.update(0.016)
    const afterExpose = alive(vfx)
    expect(afterExpose).toBeGreaterThan(0)
    world.emit({ type: 'collapse', object: 'o1', parts: ['wall'], mass: 100 })
    renderer.update(0.016)
    expect(alive(vfx)).toBeGreaterThan(afterExpose)

    const staged = setup()
    staged.world.emit({ type: 'stage', object: 'o1', part: 'wall', stage: 2, opening: { center: [0, 1, 0], radius: 0.28 }, fragments: [] })
    staged.renderer.update(0.016)
    expect(alive(staged.vfx)).toBeGreaterThan(0)
    expect(staged.vfx.sprites().live).toBe(0)
  })

  it('falls back to its own dust when no effect is mapped, and takes a map of its own', () => {
    const { world, renderer, vfx } = setup({ eventEffects: { stage: {} } })
    world.emit({ type: 'stage', object: 'o1', part: 'wall', stage: 2, opening: { center: [0, 1, 0], radius: 0.28 }, fragments: [] })
    renderer.update(0.016)
    expect(alive(vfx)).toBe(0)
    expect(vfx.sprites().live).toBeGreaterThan(0)
    const custom = setup({ eventEffects: { expose: 'glass_burst' } })
    custom.world.emit({ type: 'expose', object: 'o1', part: 'wall', bars: [[[0, 1, 0], [0, 1.2, 0]]] })
    custom.renderer.update(0.016)
    custom.vfx.update(1 / 60)
    expect(custom.vfx.workshop().debris.count).toBeGreaterThan(0)
  })

  it('two renderers on one world each hear only their own drips', () => {
    const vfx = createVfx({ seed: 1 })
    const a = setup({ vfx })
    const b = setup({ vfx })
    a.world.addObject('o2', [partState('bar', 'steel')])
    a.renderer.bind('o2', new THREE.Group())
    a.world.emit({ type: 'drip', object: 'o2', part: 'bar', point: [0, 0.5, 0], material: 'steel' })
    for (let at = 0; at < 90; at++) {
      a.renderer.update(1 / 60)
      b.renderer.update(1 / 60)
      vfx.update(1 / 60)
    }
    expect(a.renderer.stats().decals).toBe(1)
    expect(b.renderer.stats().decals).toBe(0)
  })
})
