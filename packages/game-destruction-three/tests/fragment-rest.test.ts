import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FragmentSystem } from '../src/fragments'
import type { FragmentSystemOptions } from '../src/fragments'

function makeSystem(): { system: FragmentSystem; scene: THREE.Scene } {
  const scene = new THREE.Scene()
  const options = { scene, gravity: 9.8, groundAt: () => 0, life: 0 } as unknown as FragmentSystemOptions
  return { system: new FragmentSystem(THREE, options), scene }
}

const fragment = { id: 'f1', shape: 'chunk', center: [0, 0.05, 0], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], size: [0.1, 0.1, 0.1], material: 'wood', mass: 1 }

describe('a fragment at rest', () => {
  it('stops having its matrix rebuilt every frame, and has it again when something moves it', () => {
    const { system } = makeSystem()
    const material = system.materialFor('wood', 0x808080, false)
    const mesh = system.spawn(fragment as never, material, 'home', 10)!
    for (let frame = 0; frame < 120; frame++) system.update(1 / 60)
    expect(mesh.matrixAutoUpdate).toBe(false)
    system.blast([0.2, 0, 0], 2, 5)
    expect(mesh.matrixAutoUpdate).toBe(true)
  })
})

describe('a fragment asleep on a top that is gone', () => {
  it('looks under itself again and falls to the floor, not stay where the top was', () => {
    const scene = new THREE.Scene()
    let top = 0.8
    const options = { scene, gravity: 9.8, groundAt: () => 0, surfaceAt: (_x: number, y: number) => (y >= top ? Math.max(top, 0) : 0), life: 0 } as unknown as FragmentSystemOptions
    const system = new FragmentSystem(THREE, options)
    const material = system.materialFor('wood', 0x808080, false)
    const mesh = system.spawn({ ...fragment, center: [0, 0.9, 0] } as never, material, 'home', 10)!
    for (let frame = 0; frame < 120; frame++) system.update(1 / 60)
    expect(mesh.matrixAutoUpdate).toBe(false)
    expect(mesh.position.y).toBeCloseTo(0.85, 2)
    top = -Infinity
    for (let frame = 0; frame < 120; frame++) system.update(1 / 60)
    expect(mesh.position.y).toBeCloseTo(0.05, 2)
  })
})

describe('a fragment sliding on the floor', () => {
  it('slows by Coulomb friction (mu 0.5): a half handle leaving flat at 7.5 m/s comes to rest about v^2 / (2 mu g) = 5.7 m away, not a metre', () => {
    const { system } = makeSystem()
    const material = system.materialFor('wood', 0x808080, false)
    // a 0.5 m half of a 3.5 cm ash handle lying on the floor, sent along x
    const mesh = system.spawn({ ...fragment, shape: 'slab', size: [0.5, 0.035, 0.035], center: [0, 0.0175, 0], velocity: [7.5, 0, 0] } as never, material, 'home', 10)!
    for (let frame = 0; frame < 300; frame++) system.update(1 / 60)
    const slid = (7.5 * 7.5) / (2 * 0.5 * 9.8)
    expect(mesh.position.x).toBeGreaterThan(slid * 0.8)
    expect(mesh.position.x).toBeLessThan(slid * 1.1)
  })
})

describe('a fragment that lands on its edge', () => {
  const landOnEdge = (size: [number, number, number]): number => {
    const { system } = makeSystem()
    const material = system.materialFor('paper', 0xf0f0e8, false)
    // let down slowly with its thinnest axis level: it comes to the floor on an edge
    const mesh = system.spawn({ ...fragment, shape: 'scrap', size, center: [0, size[1] / 2 + 0.005, 0], material: 'paper', mass: 0.005 } as never, material, 'home', 10)!
    for (let frame = 0; frame < 240; frame++) system.update(1 / 60)
    mesh.updateMatrixWorld(true)
    return new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).y
  }

  it('a sheet of paper lies down flat, it does not stay standing on its edge', () => {
    expect(landOnEdge([0.12, 0.09, 0.002])).toBeLessThan(0.02)
  })

  it('a splinter does not stand on its end', () => {
    expect(landOnEdge([0.03, 0.15, 0.012])).toBeLessThan(0.04)
  })

  it('a lump nearly as wide as it is tall stays on the side it landed on', () => {
    expect(landOnEdge([0.07, 0.08, 0.06])).toBeGreaterThan(0.07)
  })
})
