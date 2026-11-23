import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { FragmentSystem } from '../src/fragments'
import type { FragmentSystemOptions } from '../src/fragments'

type Draw = { side: THREE.Side; material: THREE.Material }

/**
 * What three r160 does with one mesh: `WebGLRenderer.renderObject` (the material's `onBeforeRender`, then two draws flipping `side` for a transparent
 * `DoubleSide` material) and the part of `setProgram` that looks the program up again (`getParameters`) when the material's `version` moved since its last draw.
 */
const drawLikeThree = (renderer: { draws: Draw[]; lookups: number; seen: Map<THREE.Material, number> }, mesh: THREE.Mesh): void => {
  const material = mesh.material as THREE.Material
  const direct = (with_: THREE.Material): void => {
    if (renderer.seen.get(with_) !== with_.version) {
      renderer.lookups++
      renderer.seen.set(with_, with_.version)
    }
    renderer.draws.push({ side: with_.side, material: with_ })
  }
  const hook = (material as unknown as { onBeforeRender: (...args: unknown[]) => void }).onBeforeRender
  hook.call(material, { renderBufferDirect: (_camera: unknown, _scene: unknown, _geometry: unknown, drawn: THREE.Material) => direct(drawn) }, null, null, mesh.geometry, mesh, null)
  if (material.transparent && material.side === THREE.DoubleSide && !material.forceSinglePass) {
    material.side = THREE.BackSide
    material.needsUpdate = true
    direct(material)
    material.side = THREE.FrontSide
    material.needsUpdate = true
    direct(material)
    material.side = THREE.DoubleSide
    return
  }
  direct(material)
}

const glassShards = (count: number): { meshes: THREE.Mesh[]; system: FragmentSystem } => {
  const scene = new THREE.Scene()
  const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life: 0, max: 100 } as unknown as FragmentSystemOptions)
  const glass = system.materialFor('glass', 0xdbe6ee, true, 0.24)
  const meshes: THREE.Mesh[] = []
  for (let i = 0; i < count; i++) {
    const fragment = { id: `g${i}`, shape: 'shard', center: [0.3 * i, 1, 0], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], size: [0.2, 0.2, 0.004], material: 'glass', mass: 0.05 }
    const mesh = system.spawn(fragment as unknown as Parameters<FragmentSystem['spawn']>[0], glass, 'window', 100)
    if (mesh) meshes.push(mesh)
  }
  return { meshes, system }
}

describe('glass shards keep their programs from frame to frame', () => {
  it('looks a program up only on the first draw of each side, not on every draw', () => {
    const { meshes } = glassShards(12)
    expect(meshes).toHaveLength(12)
    const renderer = { draws: [] as Draw[], lookups: 0, seen: new Map<THREE.Material, number>() }
    for (let frame = 0; frame < 30; frame++) for (const mesh of meshes) drawLikeThree(renderer, mesh)
    // three's own two passes on one material: 2 lookups per shard per frame (720 here)
    expect(renderer.lookups).toBe(2)
  })

  it('still draws the back faces, then the front faces, of each shard', () => {
    const { meshes } = glassShards(3)
    const renderer = { draws: [] as Draw[], lookups: 0, seen: new Map<THREE.Material, number>() }
    for (const mesh of meshes) drawLikeThree(renderer, mesh)
    expect(renderer.draws.map((draw) => draw.side)).toEqual([THREE.BackSide, THREE.FrontSide, THREE.BackSide, THREE.FrontSide, THREE.BackSide, THREE.FrontSide])
  })

  it('draws both faces with the same look, and casts the shadow of both faces', () => {
    const { meshes } = glassShards(1)
    const renderer = { draws: [] as Draw[], lookups: 0, seen: new Map<THREE.Material, number>() }
    drawLikeThree(renderer, meshes[0] as THREE.Mesh)
    const [back, front] = renderer.draws.map((draw) => draw.material as THREE.MeshStandardMaterial)
    for (const material of [back, front]) {
      expect(material?.transparent).toBe(true)
      expect(material?.depthWrite).toBe(false)
      expect(material?.opacity).toBe(0.24)
      expect(material?.roughness).toBe(0.15)
      expect(material?.metalness).toBe(0.1)
      expect(material?.color.getHex()).toBe(0xdbe6ee)
    }
    expect(front?.shadowSide).toBe(THREE.DoubleSide)
  })

  it('warms the back-face program with the other shared pieces', () => {
    const { system } = glassShards(0)
    const sides = system.warmMeshes().map((mesh) => mesh.material as THREE.Material).filter((material) => material.transparent).map((material) => material.side)
    expect(sides).toContain(THREE.BackSide)
    expect(sides).toContain(THREE.FrontSide)
  })

  it('releases the back-face twin with the rest', () => {
    const { meshes, system } = glassShards(1)
    const renderer = { draws: [] as Draw[], lookups: 0, seen: new Map<THREE.Material, number>() }
    drawLikeThree(renderer, meshes[0] as THREE.Mesh)
    const disposed: THREE.Material[] = []
    for (const draw of renderer.draws) draw.material.addEventListener('dispose', () => disposed.push(draw.material))
    system.dispose()
    expect(new Set(disposed).size).toBe(2)
  })
})
