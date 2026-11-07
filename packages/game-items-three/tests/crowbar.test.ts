import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createGoodsItems } from '@adatechnology/game-items-goods'
import { buildItem, checkBudget } from '../src'

describe('the crowbar corrected to its photo', () => {
  const item = createGoodsItems().get('crowbar')!
  const { root } = buildItem(THREE, item)
  const meshes: THREE.Mesh[] = []
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh)
  })

  it('is 75 cm long and a hand-thick bar, not the 5 cm tube it was', () => {
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(0.75, 2)
    expect(Math.min(size.x, size.y, size.z)).toBeLessThan(0.035)
  })

  it('is a hexagonal bar with a forked claw and a chisel, inside the triangle budget of its class', () => {
    const bar = meshes.find((mesh) => mesh.geometry.type === 'TubeGeometry')!
    expect((bar.geometry as THREE.TubeGeometry).parameters.radialSegments).toBe(6)
    expect(meshes.filter((mesh) => mesh.geometry.type === 'BoxGeometry')).toHaveLength(2)
    expect(meshes.some((mesh) => mesh.geometry.type === 'ExtrudeGeometry')).toBe(true)
    expect(checkBudget(root, item.size).ok).toBe(true)
  })

  it('builds the bar and the chisel once and shares them between crowbars', () => {
    const again = buildItem(THREE, item).root
    const geometries = (object: THREE.Object3D): Set<THREE.BufferGeometry> => {
      const found = new Set<THREE.BufferGeometry>()
      object.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (mesh.isMesh && (mesh.geometry.type === 'TubeGeometry' || mesh.geometry.type === 'ExtrudeGeometry')) found.add(mesh.geometry)
      })
      return found
    }
    expect([...geometries(again)].every((geometry) => geometries(root).has(geometry))).toBe(true)
  })
})
