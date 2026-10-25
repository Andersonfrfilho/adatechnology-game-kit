import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { specFromObject3D } from '../src/spec'

describe('specFromObject3D with contents', () => {
  it('makes the part a container when a mesh says it holds a fluid', () => {
    const root = new THREE.Group()
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), new THREE.MeshStandardMaterial())
    shell.userData.destructionMaterial = 'aluminium'
    shell.userData.destructionPart = { id: 'shell' }
    shell.userData.destructionContains = { fluid: 'soda', liters: 0.3 }
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 8), new THREE.MeshStandardMaterial())
    lid.userData.destructionMaterial = 'aluminium'
    lid.userData.destructionPart = { id: 'lid', parent: 'shell', kind: 'weld' }
    lid.position.y = 0.065
    root.add(shell, lid)
    const { spec } = specFromObject3D(THREE, root)
    expect(spec.parts.find((part) => part.id === 'shell')?.contains).toEqual({ fluid: 'soda', liters: 0.3 })
    expect(spec.parts.find((part) => part.id === 'lid')?.contains).toBeUndefined()
  })
})
