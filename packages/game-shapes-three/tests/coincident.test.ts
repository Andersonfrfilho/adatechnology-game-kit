import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { coincidentFacesOf } from '../src'

function block(name: string, size: readonly [number, number, number], at: readonly [number, number, number], material: THREE.Material = new THREE.MeshStandardMaterial()): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material)
  mesh.name = name
  mesh.position.set(at[0], at[1], at[2])
  return mesh
}

describe('coincidentFacesOf', () => {
  it('finds a flush lining inside a moved and turned group, and names both meshes', () => {
    const box = new THREE.Group()
    box.name = 'meter_box'
    box.position.set(3, 1, -2)
    box.rotation.y = 0.7
    box.add(block('body', [0.4, 0.6, 0.2], [0, 0, 0]), block('lining', [0.3, 0.5, 0.2], [0, 0, 0]))
    const hits = coincidentFacesOf(box)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]!.labelA).toContain('body')
    expect(hits[0]!.labelB).toContain('lining')
  })

  it('accepts a lining set back 2 mm', () => {
    const root = new THREE.Group()
    root.add(block('body', [0.4, 0.6, 0.2], [0, 0, 0]), block('lining', [0.3, 0.5, 0.2], [0, 0, -0.002]))
    expect(coincidentFacesOf(root)).toEqual([])
  })

  it('checks every instance of an InstancedMesh', () => {
    const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 1), new THREE.MeshStandardMaterial(), 2)
    tiles.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, 0))
    tiles.setMatrixAt(1, new THREE.Matrix4().makeTranslation(0.5, 0, 0))
    expect(coincidentFacesOf(tiles).length).toBeGreaterThan(0)
  })

  it('skips hidden meshes and polygon-offset decals unless asked', () => {
    const root = new THREE.Group()
    const hidden = block('core', [1, 1, 1], [0, 0, 0])
    hidden.visible = false
    const decal = block('hole', [1, 1, 1], [0, 0, 0], new THREE.MeshBasicMaterial({ polygonOffset: true, polygonOffsetFactor: -1 }))
    root.add(block('wall', [1, 1, 1], [0, 0, 0]), hidden, decal)
    expect(coincidentFacesOf(root)).toEqual([])
    expect(coincidentFacesOf(root, { includeHidden: true }).length).toBeGreaterThan(0)
  })
})

describe('coincidentFacesOf on a LOD', () => {
  it('checks only the nearest level', () => {
    const lod = new THREE.LOD()
    lod.addLevel(block('near', [1, 1, 1], [0, 0, 0]), 0)
    lod.addLevel(block('far', [1, 1, 1], [0, 0, 0]), 20)
    expect(coincidentFacesOf(lod)).toEqual([])
  })
})
