import { createBestBuilder } from '@adatechnology/game-characters-three'
import type { BakeBuilders } from '@adatechnology/game-characters-three'
import { UNDEAD_TYPES, undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { createCrowd } from '@adatechnology/game-crowd'
import type { CrowdPack } from '@adatechnology/game-crowd'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createCrowdRenderer } from '../src'

const pack = undeadCrowdPack() as unknown as CrowdPack
const names = new Map(UNDEAD_TYPES.map((card) => [card.id, card.name['pt-BR'] ?? card.id]))
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

describe('createCrowdRenderer', () => {
  it('bakes a type the first time one of its bodies is drawn and puts each agent in its variant and level', () => {
    const crowd = createCrowd({ pack, seed: 2, capacity: 64 })
    for (let k = 0; k < 30; k++) crowd.spawn((k % 6) * 2 - 5, -5 - Math.floor(k / 6) * 15, 0)
    const renderer = createCrowdRenderer(THREE, { crowd, builders: builders(), typeName: (type) => names.get(type.id) ?? type.id })
    renderer.update(1 / 30, { camera: { x: 0, z: 0 }, viewYaw: 0 })
    expect(renderer.variants.filter(Boolean)).toHaveLength(4) // the walker's four variants, nothing else baked
    expect(renderer.lodCounts[0] + renderer.lodCounts[1] + renderer.lodCounts[2]).toBe(30)
    expect(renderer.lodCounts[0]).toBeGreaterThan(0)
    expect(renderer.lodCounts[2]).toBeGreaterThan(0)
    expect(renderer.drawCalls).toBeLessThanOrEqual(12)
    crowd.kill(0)
    renderer.update(1 / 30, { camera: { x: 0, z: 0 }, viewYaw: 0 })
    expect(renderer.lodCounts[0] + renderer.lodCounts[1] + renderer.lodCounts[2]).toBe(30) // 29 standing, one on the ground
    renderer.dispose()
    expect(renderer.group.children).toHaveLength(0)
  })
})
