import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { discardObject3D, markShared, releaseObject3D } from '../src'

const disposed = (resource: THREE.EventDispatcher<{ dispose: object }>): { value: boolean } => {
  const flag = { value: false }
  resource.addEventListener('dispose', () => (flag.value = true))
  return flag
}

describe('releaseObject3D', () => {
  it('frees the geometry, material and textures of a removed tree', () => {
    const map = new THREE.Texture()
    const normal = new THREE.Texture()
    const material = new THREE.MeshStandardMaterial({ map, normalMap: normal })
    const geometry = new THREE.BoxGeometry()
    const root = new THREE.Group()
    root.add(new THREE.Mesh(geometry, material))
    const flags = [disposed(geometry), disposed(material), disposed(map), disposed(normal)]
    const report = releaseObject3D(root)
    expect(flags.map((f) => f.value)).toEqual([true, true, true, true])
    expect(report).toEqual({ geometries: 1, materials: 1, textures: 2 })
  })

  it('frees the textures held in shader uniforms', () => {
    const texture = new THREE.Texture()
    const material = new THREE.ShaderMaterial({ uniforms: { tMap: { value: texture } } })
    const flag = disposed(texture)
    releaseObject3D(new THREE.Mesh(new THREE.PlaneGeometry(), material))
    expect(flag.value).toBe(true)
  })

  it('keeps what a tree still drawn shares with the removed one', () => {
    const scene = new THREE.Scene()
    const sharedGeometry = new THREE.BoxGeometry()
    const sharedMaterial = new THREE.MeshBasicMaterial()
    const ownGeometry = new THREE.SphereGeometry()
    scene.add(new THREE.Mesh(sharedGeometry, sharedMaterial))
    const gone = new THREE.Group()
    gone.add(new THREE.Mesh(sharedGeometry, sharedMaterial), new THREE.Mesh(ownGeometry, sharedMaterial))
    const flags = [disposed(sharedGeometry), disposed(sharedMaterial), disposed(ownGeometry)]
    releaseObject3D(gone, { keep: scene })
    expect(flags.map((f) => f.value)).toEqual([false, false, true])
  })

  it('leaves a resource marked shared', () => {
    const geometry = new THREE.BoxGeometry()
    geometry.userData.shared = true
    const flag = disposed(geometry)
    releaseObject3D(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()))
    expect(flag.value).toBe(false)
  })

  it('leaves a resource marked with markShared, without touching its userData', () => {
    const material = new THREE.MeshBasicMaterial()
    markShared(material)
    const flag = disposed(material)
    releaseObject3D(new THREE.Mesh(new THREE.BoxGeometry(), material))
    expect(flag.value).toBe(false)
    expect(material.userData).toEqual({})
  })

  it('releases a tree that still hangs under the kept one', () => {
    const scene = new THREE.Scene()
    const geometry = new THREE.BoxGeometry()
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
    scene.add(mesh)
    const flag = disposed(geometry)
    releaseObject3D(mesh, { keep: scene })
    expect(flag.value).toBe(true)
  })
})

describe('discardObject3D', () => {
  it('takes the object out of its scene and keeps what the scene still uses', () => {
    const scene = new THREE.Scene()
    const shared = new THREE.MeshBasicMaterial()
    const own = new THREE.BoxGeometry()
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), shared))
    const piece = new THREE.Mesh(own, shared)
    scene.add(piece)
    const flags = [disposed(shared), disposed(own)]
    discardObject3D(piece)
    expect(piece.parent).toBeNull()
    expect(flags.map((f) => f.value)).toEqual([false, true])
  })
})

describe('discardObject3D with a list', () => {
  it('takes every object out and frees what only they used, in one call', () => {
    const scene = new THREE.Scene()
    const shared = new THREE.MeshBasicMaterial()
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), shared))
    const pieces = [0, 1, 2].map(() => new THREE.Mesh(new THREE.BoxGeometry(), shared))
    for (const piece of pieces) scene.add(piece)
    const flags = pieces.map((piece) => disposed(piece.geometry))
    const sharedFlag = disposed(shared)
    discardObject3D(pieces)
    expect(pieces.every((piece) => piece.parent === null)).toBe(true)
    expect(flags.every((flag) => flag.value)).toBe(true)
    expect(sharedFlag.value).toBe(false)
  })
})
