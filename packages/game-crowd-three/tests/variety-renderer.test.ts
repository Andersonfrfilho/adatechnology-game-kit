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
    const bodies = meshes.filter((mesh) => mesh.geometry.attributes.iD && !mesh.geometry.attributes.iAcc)
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
      for (let index = 0; index < used; index++) expect(placement[index * 4 + 3]!).toBeGreaterThan(0.05) // the head or torso height of the variant
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
