import { createBestBuilder } from '@adatechnology/game-characters-three'
import type { BakeBuilders } from '@adatechnology/game-characters-three'
import { UNDEAD_TYPES, undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { createCrowd } from '@adatechnology/game-crowd'
import type { CrowdPack } from '@adatechnology/game-crowd'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createCrowdRenderer } from '../src'

const pack = undeadCrowdPack() as unknown as CrowdPack
const builders = (): BakeBuilders => {
  const best = createBestBuilder(THREE, { types: UNDEAD_TYPES.map((card) => ({ name: card.name['pt-BR'] ?? card.id, eye: Number.parseInt(card.eye.color, 16) })), random: () => 0.5 })
  return {
    buildBest: (spec, lod) => {
      best.setLOD(lod)
      return best.build(spec) as THREE.Object3D
    },
    topMaterial: () => best.topM() as THREE.Material | null,
  }
}
const names = new Map(UNDEAD_TYPES.map((card) => [card.id, card.name['pt-BR'] ?? card.id]))
const frame = { camera: { x: 0, z: 0 }, viewYaw: 0 }

const horde = (variety: boolean) => {
  const crowd = createCrowd({ pack, seed: 5, capacity: 400, physics: { personality: true } })
  for (let k = 0; k < 300; k++) crowd.spawn((k % 20) * 3 - 30, -4 - Math.floor(k / 20) * 5, 0)
  const renderer = createCrowdRenderer(THREE, { crowd, builders: builders(), typeName: (type) => names.get(type.id) ?? type.id, ...(variety ? { variety: {} } : {}) })
  renderer.update(1 / 30, frame)
  return { crowd, renderer }
}

describe('createCrowdRenderer with variety', () => {
  it('without the option it is the game renderer: no identity, no accessories, no blobs, every level casts as before', () => {
    const { renderer } = horde(false)
    const meshes = renderer.group.children as THREE.Mesh[]
    expect(meshes.some((mesh) => mesh.geometry.attributes.iD)).toBe(false)
    expect(meshes.some((mesh) => mesh.name === 'blob-shadows')).toBe(false)
    expect(meshes.filter((mesh) => mesh.castShadow)).toHaveLength(meshes.length / 3 * 2)
  })

  it('draws identity bodies, accessory batches and blobs, and only the near level casts a real shadow', () => {
    const { renderer } = horde(true)
    const meshes = renderer.group.children as THREE.Mesh[]
    const prepasses = meshes.filter((mesh) => mesh.renderOrder < 0 && mesh.geometry.attributes.iD)
    const bodies = meshes.filter((mesh) => mesh.geometry.attributes.iD && !mesh.geometry.attributes.iAcc && mesh.renderOrder >= 0)
    expect(prepasses).toHaveLength(bodies.length / 3)
    const accessories = meshes.filter((mesh) => mesh.geometry.attributes.iAcc)
    expect(bodies.length).toBeGreaterThan(0)
    expect(accessories.length).toBeGreaterThan(0)
    expect(accessories.length).toBeLessThanOrEqual(8)
    expect(meshes.some((mesh) => mesh.name === 'blob-shadows')).toBe(true)
    expect(bodies.filter((mesh) => mesh.castShadow).length).toBe(bodies.length / 3)
    expect(renderer.drawCalls).toBeLessThanOrEqual(30)
  })

  it('puts an accessory batch instance only on a body that carries it, with the placement of its variant', () => {
    const { renderer } = horde(true)
    const accessories = (renderer.group.children as THREE.Mesh[]).filter((mesh) => mesh.geometry.attributes.iAcc)
    const carried = accessories.reduce((sum, mesh) => sum + (mesh as unknown as { count: number }).count, 0)
    expect(carried).toBeGreaterThan(10)
    expect(carried).toBeLessThan(300 * 4)
    for (const mesh of accessories) {
      const placement = mesh.geometry.attributes.iAcc!.array as Float32Array
      const used = (mesh as unknown as { count: number }).count
      for (let index = 0; index < used; index++) {
        const [x, y, z, size] = Array.from(placement.slice(index * 4, index * 4 + 4))
        // on the body, not at its feet and not scaled up: a head or a torso of a person 1.7 m tall
        expect(size!, 'size').toBeGreaterThan(0.2)
        expect(size!, 'size').toBeLessThan(1.1)
        expect(y!, 'height').toBeGreaterThan(0.9)
        expect(y!, 'height').toBeLessThan(2.1)
        expect(Math.hypot(x!, z!), 'offset').toBeLessThan(0.25)
      }
    }
  })
})

describe('the blob shadows', () => {
  it('are soft, dark and transparent, no wider than the body they lie under, flat on the ground', () => {
    const { renderer } = horde(true)
    const blobs = (renderer.group.children as THREE.Mesh[]).find((mesh) => mesh.name === 'blob-shadows')!
    const material = blobs.material as THREE.ShaderMaterial
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    expect(material.uniforms.uOpacity!.value).toBeLessThanOrEqual(0.5)
    expect(material.fragmentShader).toContain('gl_FragColor = vec4(0., 0., 0.')
    const placement = blobs.geometry.attributes.iBlob!.array as Float32Array
    const used = (blobs as unknown as { count: number }).count
    expect(used).toBeGreaterThan(0)
    for (let index = 0; index < used; index++) {
      expect(placement[index * 4 + 1]!, 'on the ground').toBeLessThan(0.5)
      expect(placement[index * 4 + 3]!, 'radius').toBeGreaterThan(0.3)
      expect(placement[index * 4 + 3]!, 'radius').toBeLessThan(1.2)
    }
  })
})

describe('the impostor tier', () => {
  const farHorde = (impostor?: false) => {
    const crowd = createCrowd({ pack, seed: 5, capacity: 400, physics: { personality: true } })
    for (let k = 0; k < 120; k++) crowd.spawn((k % 12) * 6 - 33, -100 - Math.floor(k / 12) * 8, k % 5)
    for (let k = 0; k < 20; k++) crowd.spawn(k * 2 - 20, -8, 0)
    const renderer = createCrowdRenderer(THREE, { crowd, builders: builders(), typeName: (type) => names.get(type.id) ?? type.id, variety: impostor === false ? { impostor: false } : {} })
    renderer.update(1 / 30, frame)
    return { crowd, renderer }
  }

  it('draws the bodies past 90 m that walk as one impostor draw call, with the atlas of every type', () => {
    const { renderer } = farHorde()
    const impostors = (renderer.group.children as THREE.Mesh[]).find((mesh) => mesh.name === 'impostors') as unknown as THREE.Mesh & { count: number }
    expect(impostors).toBeDefined()
    expect(renderer.impostorCount).toBeGreaterThan(80)
    expect(impostors.count).toBe(renderer.impostorCount)
    expect(renderer.lodCounts[0]).toBeGreaterThan(0)
    expect(renderer.variants.filter(Boolean).length).toBeGreaterThanOrEqual(pack.types.length)
  })

  it('keeps the far mesh when the impostor is off', () => {
    const { renderer } = farHorde(false)
    expect(renderer.impostorCount).toBe(0)
    expect((renderer.group.children as THREE.Mesh[]).some((mesh) => mesh.name === 'impostors')).toBe(false)
    expect(renderer.lodCounts[2]).toBeGreaterThan(80)
  })

  it('leaves a body that does not walk on the far mesh', () => {
    const { crowd, renderer } = farHorde()
    crowd.store.crawl[0] = 1
    renderer.update(1 / 30, frame)
    expect(renderer.impostorCount).toBeLessThan(120)
    expect(renderer.lodCounts[2]).toBeGreaterThan(0)
  })
})

describe('createCrowdRenderer prepare', () => {
  it('makes every batch a frame would make on demand, so no batch (and no program) is made during play', () => {
    const crowd = createCrowd({ pack, seed: 5, capacity: 400, physics: { personality: true } })
    const renderer = createCrowdRenderer(THREE, { crowd, builders: builders(), typeName: (type) => names.get(type.id) ?? type.id, variety: {} })
    expect(renderer.group.children).toHaveLength(0)
    renderer.prepare()
    const prepared = renderer.group.children.length
    const materials = new Set(renderer.group.children.flatMap((mesh) => [(mesh as THREE.Mesh).material, (mesh as THREE.Mesh).customDepthMaterial, (mesh as THREE.Mesh).customDistanceMaterial]).filter(Boolean))
    expect(prepared).toBeGreaterThan(pack.types.length)
    expect(materials.size).toBeGreaterThan(prepared)
    for (let k = 0; k < 300; k++) crowd.spawn((k % 20) * 3 - 30, -4 - Math.floor(k / 20) * 40, k % pack.types.length)
    renderer.update(1 / 30, frame)
    expect(renderer.group.children).toHaveLength(prepared)
    renderer.dispose()
  }, 120000)

  it('without variety only the bodies and the plain body are made', () => {
    const crowd = createCrowd({ pack, seed: 5, capacity: 40 })
    const renderer = createCrowdRenderer(THREE, { crowd, builders: builders(), typeName: (type) => names.get(type.id) ?? type.id })
    renderer.prepare()
    const prepared = renderer.group.children.length
    crowd.spawn(0, -4, 0)
    renderer.update(1 / 30, frame)
    expect(renderer.group.children).toHaveLength(prepared)
    renderer.dispose()
  }, 120000)
})

describe('the adaptive detail without the GPU timer extension', () => {
  it('shrinks on long frames down to the floor and grows back on short ones, from the frame time alone', () => {
    const crowd = createCrowd({ pack, seed: 2, capacity: 8 })
    crowd.spawn(0, -5, 0)
    const renderer = createCrowdRenderer(THREE, { crowd, builders: builders(), typeName: (type) => names.get(type.id) ?? type.id, variety: {} })
    const frame = { camera: { x: 0, z: 0 }, viewYaw: 0 }
    expect(renderer.gpuMs).toBe(0)
    for (let step = 0; step < 200; step++) renderer.update(0.05, frame)
    expect(renderer.gpuMs).toBe(0)
    expect(renderer.detailScale).toBeCloseTo(0.1, 5)
    for (let step = 0; step < 6000; step++) renderer.update(1 / 60, frame)
    expect(renderer.detailScale).toBeGreaterThan(0.9)
    renderer.dispose()
  })
})
