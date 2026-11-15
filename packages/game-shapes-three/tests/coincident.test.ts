import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { GAME_DEPTH_PRECISION, coincidentFacesOf, standOutCoincident } from '../src'

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

  it('ignores triangles past the draw range, which the GPU never draws', () => {
    const plane = new THREE.PlaneGeometry(1, 1)
    const doubled = new THREE.BufferGeometry()
    doubled.setAttribute('position', plane.getAttribute('position'))
    const index = Array.from(plane.index!.array)
    doubled.setIndex([...index, ...index])
    const mesh = new THREE.Mesh(doubled, new THREE.MeshStandardMaterial())
    expect(coincidentFacesOf(mesh).length).toBeGreaterThan(0)
    doubled.setDrawRange(0, index.length)
    expect(coincidentFacesOf(mesh)).toEqual([])
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

describe('standOutCoincident', () => {
  it('grows the smaller piece 2 mm past the body and leaves no fight', () => {
    const root = new THREE.Group()
    root.scale.setScalar(0.25)
    const body = block('body', [1.6, 2.4, 0.8], [0, 0, 0])
    const label = block('label', [1.2, 0.8, 0.8], [0, 0.3, 0])
    root.add(body, label)
    const report = standOutCoincident(root)
    expect(report).toEqual({ grown: 1, left: 0 })
    expect(body.scale.toArray()).toEqual([1, 1, 1])
    const front = new THREE.Box3().setFromObject(label).max.z
    expect(front).toBeCloseTo(0.25 * 0.4 + 0.002, 6)
    expect(new THREE.Box3().setFromObject(label).getCenter(new THREE.Vector3()).y).toBeCloseTo(0.25 * 0.3, 6)
  })

  it('grows a cylinder label radially past a can of the same radius', () => {
    const root = new THREE.Group()
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.11, 16), new THREE.MeshStandardMaterial())
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 16), new THREE.MeshStandardMaterial())
    root.add(can, label)
    expect(standOutCoincident(root).left).toBe(0)
    expect(coincidentFacesOf(root)).toEqual([])
  })
})


describe('coincidentFacesOf and the depth buffer', () => {
  it('lets two layers that write no depth overlap, but not a layer that tests depth over a solid face', () => {
    const smoke = (): THREE.Material => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
    const puffs = new THREE.Group()
    puffs.add(block('puff_a', [1, 1, 0.01], [0, 0, 0], smoke()), block('puff_b', [1, 1, 0.01], [0.3, 0, 0], smoke()))
    expect(coincidentFacesOf(puffs)).toEqual([])
    const scorch = new THREE.Group()
    scorch.add(block('ground', [4, 0.1, 4], [0, -0.05, 0]), block('scorch', [1, 0.1, 1], [0, -0.05, 0], smoke()))
    expect(coincidentFacesOf(scorch).length).toBeGreaterThan(0)
  })
})

describe('near mode on a scene: one material, one colour', () => {
  const near = { depth: GAME_DEPTH_PRECISION }
  const pair = (a: THREE.Material, b: THREE.Material): THREE.Group => {
    const group = new THREE.Group()
    // two slabs side by side whose tops lie on one plane and overlap over 10 cm
    group.add(block('left', [1, 0.1, 1], [0, 0, 0], a), block('right', [1, 0.1, 1], [0.9, 0, 0], b))
    return group
  }

  it('passes two meshes of the same material: their overlap draws the same pixels', () => {
    const plaster = new THREE.MeshStandardMaterial({ color: 0xdddddd })
    expect(coincidentFacesOf(pair(plaster, plaster), near)).toEqual([])
  })

  it('catches them in two materials, even of the same colour', () => {
    expect(coincidentFacesOf(pair(new THREE.MeshStandardMaterial({ color: 0xdddddd }), new THREE.MeshStandardMaterial({ color: 0xdddddd })), near).length).toBeGreaterThan(0)
  })

  it('catches them when the vertex colours differ, and passes them when they agree', () => {
    const painted = new THREE.MeshStandardMaterial({ vertexColors: true })
    const tinted = (mesh: THREE.Mesh, rgb: readonly [number, number, number]): THREE.Mesh => {
      const count = mesh.geometry.getAttribute('position').count
      mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: count }, () => rgb).flat(), 3))
      return mesh
    }
    const scene = (b: readonly [number, number, number]): THREE.Group => {
      const group = new THREE.Group()
      group.add(tinted(block('left', [1, 0.1, 1], [0, 0, 0], painted), [1, 1, 1]), tinted(block('right', [1, 0.1, 1], [0.9, 0, 0], painted), b))
      return group
    }
    expect(coincidentFacesOf(scene([1, 1, 1]), near)).toEqual([])
    expect(coincidentFacesOf(scene([1, 0, 0]), near).length).toBeGreaterThan(0)
  })
})
