import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { isMesh } from '../src'

describe('isMesh', () => {
  it('tells a mesh from a group, a light and nothing', () => {
    expect(isMesh(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()))).toBe(true)
    expect(isMesh(new THREE.Group())).toBe(false)
    expect(isMesh(new THREE.PointLight())).toBe(false)
    expect(isMesh(null)).toBe(false)
  })
})
