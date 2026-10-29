import { TOWER_PATTERNS, createUrban } from '@adatechnology/game-urban'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createUrbanThree } from '../src'
import { fakeDocument } from './fake-dom'

// The towers of the city (design T10-estrutura-real.md §11.7) are boxes, cylinders and window instances: the drawer needs nothing new. Smoke test.
describe('towers drawn by the three adapter', () => {
  const drawFinancialDistrict = (towers: boolean) => {
    const kit = createUrban({ packs: { neighbourhoods: TOWER_PATTERNS }, towers })
    const b = kit.builder({ seed: 7 })
    const plan = kit.neighbourhoods.get('financial_district').compose(b, { x: 0, z: 0 })
    return { plan, scene: b.scene(), drawn: createUrbanThree(THREE, { document: fakeDocument }).draw(b.scene()) }
  }

  it('the avenue of towers draws meshes and window instances, taller than the boxes it replaces and with windows on every storey', () => {
    const on = drawFinancialDistrict(true)
    const off = drawFinancialDistrict(false)
    const box = (root: THREE.Object3D) => new THREE.Box3().setFromObject(root)
    expect(on.plan.buildings).toHaveLength(8)
    expect(box(on.drawn.root).max.y).toBeGreaterThan(70)
    let meshes = 0, instances = 0
    on.drawn.root.traverse((node: any) => { if (node.isMesh) meshes++; if (node.isInstancedMesh) instances += node.count })
    let boxMeshes = 0
    off.drawn.root.traverse((node: any) => { if (node.isMesh) boxMeshes++ })
    expect(meshes).toBeGreaterThan(boxMeshes)
    expect(instances).toBeGreaterThan(on.plan.buildings.length * 100)
  })

  it('without the option the scene is the boxes of before: no podium colour in it', () => {
    const off = drawFinancialDistrict(false)
    expect(off.scene.parts.some((p) => p.shape === 'box' && p.color === 0x2a2d31)).toBe(false)
  })
})
