import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { discardObject3D } from '@adatechnology/game-shapes-three'

import { buildWeaponModelById, MODEL_ENTRIES } from '../src'
import { modelKit } from '../src/models/kit'

// the kit's materials and box geometries are shared by every model: putting one weapon away (CLAUDE.md, "Memória") frees only what that model owns,
// or the next weapon uploads the kit again (perf-budget: GPU buffers per explosion)
describe('a weapon model put away keeps the shared kit', () => {
  it('frees its own geometry and leaves the kit materials and cached boxes', () => {
    const id = Object.keys(MODEL_ENTRIES).find((key) => buildWeaponModelById(THREE, key))!
    const model = buildWeaponModelById(THREE, id)!
    const kit: THREE.Material[] = Object.values(modelKit(THREE).M)
    const sharedDisposed: string[] = []
    let ownDisposed = 0
    let shared = 0
    model.root.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) if (kit.includes(material) && ++shared) material.addEventListener('dispose', () => sharedDisposed.push('material'))
      mesh.geometry.addEventListener('dispose', () => ownDisposed++)
    })
    discardObject3D(model.root)
    expect(shared).toBeGreaterThan(0)
    expect(sharedDisposed).toEqual([])
    expect(ownDisposed).toBeGreaterThan(0)
  })
})
