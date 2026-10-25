import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import { createVfx } from '@adatechnology/game-vfx'
import { createDestructionRenderer } from '../src/renderer'

describe('settle: the soil offset is drawn under the host root', () => {
  it('moves the parts with the settlement and tilt and leaves the root where the host put it', () => {
    // a 6 m tall block on a small pad on very soft clay: it sinks and leans
    const spec: DestructibleSpec = {
      parts: [
        { id: 'pad', material: 'concrete', shape: { kind: 'box', size: [2, 0.3, 2] }, position: [0, -0.15, 0], structure: { role: 'foundation' } },
        { id: 'block', material: 'concrete', shape: { kind: 'box', size: [1.5, 6, 1.5] }, position: [0, 3, 0], structure: { role: 'column' } },
      ],
      joints: [{ a: 'block', b: 'pad', kind: 'rebar', bears: 'a_on_b' }],
      soil: 'clay_very_soft',
    }
    const world = createDestruction()
    world.add(spec, { id: 'tower', position: [5, 0, 0] })
    const scene = new THREE.Scene()
    const root = new THREE.Group()
    root.position.set(5, 0, 0)
    const meshes = spec.parts.map((p) => {
      const s = p.shape.kind === 'box' ? p.shape.size : [1, 1, 1]
      const m = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), new THREE.MeshStandardMaterial())
      m.name = p.id
      m.position.set(p.position[0], p.position[1], p.position[2])
      root.add(m)
      return m
    })
    scene.add(root)
    root.updateMatrixWorld(true)
    const renderer = createDestructionRenderer(THREE, { scene, world, vfx: createVfx() })
    renderer.bind('tower', root)
    for (let i = 0; i < 10; i++) {
      world.update(0.1)
      renderer.update(0.1)
    }
    const soil = world.state('tower')!.soil!
    expect(soil.settlement).toBeGreaterThan(0)
    const node = root.getObjectByName('destruction-soil')!
    expect(node).toBeDefined()
    expect(meshes.every((m) => m.parent === node)).toBe(true)
    expect(node.position.toArray()).toEqual(soil.offset.position.map((v) => expect.closeTo(v, 9)))
    expect(root.position.toArray()).toEqual([5, 0, 0])
    // the host's pose still reaches the world as the base: the world pose is the root's with the offset on top
    expect(world.state('tower')!.position[1]).toBeCloseTo(soil.offset.position[1], 9)
  })
})
