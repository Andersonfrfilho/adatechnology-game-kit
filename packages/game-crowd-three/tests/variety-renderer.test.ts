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
