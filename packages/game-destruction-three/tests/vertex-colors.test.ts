import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

describe('vertex-coloured meshes', () => {
  it('fragments take the average vertex colour times material.color instead of white', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    world.addObject('o1', [partState('top', 'wood_soft')])
    const geo = new THREE.BoxGeometry(1, 0.05, 1)
    const n = geo.getAttribute('position').count
    // half the vertices red, half green: the average is (0.5, 0.5, 0)
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) colors.set(i % 2 ? [0, 1, 0] : [1, 0, 0], i * 3)
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true }))
    mesh.position.y = 1.5
    const root = new THREE.Group()
    root.add(mesh)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('o1', root, { parts: { top: mesh } })
    const fragment = { id: 'f0', part: 'top', material: 'wood_soft', shape: 'shard' as const, center: [0, 1.5, 0] as [number, number, number], size: [0.2, 0.15, 0.01] as [number, number, number], rotation: [0, 0, 0, 1] as [number, number, number, number], velocity: [0, 0, 0] as [number, number, number], angularVelocity: [0, 0, 0] as [number, number, number], mass: 0.2 }
    world.emit({ type: 'fracture', object: 'o1', part: 'top', style: 'splinter', fragments: [fragment], point: [0, 1.5, 0] })
    renderer.update(0.016)
    const frag = scene.children.find((c) => c instanceof THREE.Mesh && c !== mesh && c.scale.z < 0.02) as THREE.Mesh
    const c = (frag.material as THREE.MeshLambertMaterial).color
    expect([c.r, c.g, c.b].map((v) => Math.round(v * 100) / 100)).toEqual([0.5, 0.5, 0])
  })

  it('multiplies by material.color', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    world.addObject('o1', [partState('top', 'wood_soft')])
    const geo = new THREE.BoxGeometry(1, 1, 1)
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3).fill(0.5), 3))
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color(1, 0.5, 0), vertexColors: true }))
    const root = new THREE.Group()
    root.add(mesh)
    scene.add(root)
    renderer.bind('o1', root, { parts: { top: mesh } })
    const probe = (renderer as unknown as { partColor(pv: unknown, d: undefined): number }).partColor
    const pv = (renderer as unknown as { bounds: Map<string, { parts: Map<string, unknown> }> }).bounds.get('o1')!.parts.get('top')
    const hex = probe.call(renderer, pv, undefined)
    const col = new THREE.Color(hex)
    expect([col.r, col.g, col.b].map((v) => Math.round(v * 100) / 100)).toEqual([0.5, 0.25, 0])
  })
})
