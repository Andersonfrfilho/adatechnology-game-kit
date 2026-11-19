import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { FragmentSystem } from '../src/fragments'
import type { FragmentSystemOptions } from '../src/fragments'

const fragment = { id: 'f1', shape: 'chunk', center: [0, 0.05, 0], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], size: [0.1, 0.1, 0.1], material: 'wood', mass: 1 }

const makeSystem = (life: number) => {
  const scene = new THREE.Scene()
  const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life } as unknown as FragmentSystemOptions)
  return { system, scene, material: system.materialFor('wood', 0x808080, false) }
}

describe('the fragments asleep are not stepped', () => {
  it('a fragment that settled stays where it is while others fly, and a blast wakes and moves it in the next update', () => {
    const { system, material } = makeSystem(0)
    const rest = system.spawn(fragment as never, material, 'home', 50)!
    for (let frame = 0; frame < 120; frame++) system.update(1 / 60)
    expect(rest.matrixAutoUpdate).toBe(false)
    const lyingAt = rest.position.clone()
    system.spawn({ ...fragment, center: [3, 2, 0], velocity: [1, 0, 0] } as never, material, 'home', 50)
    for (let frame = 0; frame < 5; frame++) system.update(1 / 60)
    expect(rest.position.equals(lyingAt)).toBe(true)
    system.blast([0.5, 0, 0], 2, 5)
    expect(rest.matrixAutoUpdate).toBe(true)
    system.update(1 / 60)
    expect(rest.position.equals(lyingAt)).toBe(false)
  })

  it('a fragment asleep fades away after its life, and is freed with the scene', () => {
    const { system, scene, material } = makeSystem(1)
    system.spawn(fragment as never, material, 'home', 50)
    for (let frame = 0; frame < 60; frame++) system.update(1 / 60)
    expect(system.count).toBe(1)
    for (let frame = 0; frame < 240; frame++) system.update(1 / 60)
    expect(system.count).toBe(0)
    expect(scene.children.filter((child) => child.name === 'fragment')).toHaveLength(0)
  })

  it('a fragment woken before its time does not fade, and clear frees every list', () => {
    const { system, scene, material } = makeSystem(2)
    const mesh = system.spawn(fragment as never, material, 'home', 50)!
    for (let frame = 0; frame < 120; frame++) system.update(1 / 60)
    system.blast([0.5, 0, 0], 2, 5)
    for (let frame = 0; frame < 30; frame++) system.update(1 / 60)
    expect(system.count).toBe(1)
    expect(mesh.scale.x).toBeGreaterThan(0.05)
    system.clear()
    expect(system.count).toBe(0)
    expect(scene.children.filter((child) => child.name === 'fragment')).toHaveLength(0)
    system.dispose()
  })
})
