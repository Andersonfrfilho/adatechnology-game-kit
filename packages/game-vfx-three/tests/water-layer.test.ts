import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createWaterEffects } from '@adatechnology/game-vfx'
import { createWaterEffectsLayer } from '../src/water-layer'

describe('the water layer draws the pools of the water effects', () => {
  it('draws every live record as one instance and nothing once they are gone', () => {
    const effects = createWaterEffects({ seed: 4 })
    const layer = createWaterEffectsLayer(THREE, effects)
    effects.blast({ point: [0, -0.5, 0], level: 0, depth: 2, explosive: 'm67' })
    effects.shot({ point: [2, 0, 0], direction: [0, -1, 0], profile: 'rifle' })
    effects.update(0.2)
    const drawn = layer.sync()
    expect(drawn).toBeGreaterThan(50)
    const meshes = layer.group.children as THREE.Mesh[]
    expect(meshes.length).toBe(4)
    const instances = meshes.reduce((sum, mesh) => sum + (mesh.geometry as THREE.InstancedBufferGeometry).instanceCount, 0)
    expect(instances).toBe(drawn)
    for (let t = 0; t < 20; t += 0.05) effects.update(0.05)
    expect(layer.sync()).toBe(0)
    layer.dispose()
  })

  it('fills the buffers with the same geometries frame after frame and frees them on dispose', () => {
    const effects = createWaterEffects({ seed: 1 })
    const layer = createWaterEffectsLayer(THREE, effects)
    const geometries = new Set((layer.group.children as THREE.Mesh[]).map((mesh) => mesh.geometry))
    let disposed = 0
    for (const geometry of geometries) geometry.addEventListener('dispose', () => disposed++)
    for (let frame = 0; frame < 120; frame++) {
      effects.shot({ point: [frame % 5, 0, 0], direction: [0, -1, 0], profile: 'pistol' })
      effects.update(1 / 60)
      layer.sync()
    }
    expect(new Set((layer.group.children as THREE.Mesh[]).map((mesh) => mesh.geometry))).toEqual(geometries)
    layer.dispose()
    expect(disposed).toBe(geometries.size)
  })
})
