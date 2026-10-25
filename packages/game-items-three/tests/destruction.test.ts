import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { buildItem, DESTRUCTION_MATERIAL_BY_TAG } from '../src'

function meshesOf(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh)
  })
  return out
}

describe('destruction tags of a drawn item', () => {
  it('gives each mesh the destruction material of its kit tag', () => {
    const { root } = buildItem(THREE, { id: 'claw_hammer', category: 'tools', size: [0.1, 0.3, 0.03], model: 'hammer' }, { destructible: true })
    const materials = new Set(meshesOf(root).map((m) => m.userData.destructionMaterial))
    expect(materials.has(DESTRUCTION_MATERIAL_BY_TAG.metal)).toBe(true)
    expect(materials.has(DESTRUCTION_MATERIAL_BY_TAG.wood)).toBe(true)
  })

  it('draws a can as aluminium welded shell parts with a paper skin', () => {
    const { root } = buildItem(THREE, { id: 'soda_can', category: 'food', size: [0.066, 0.12, 0.066], model: 'soda_can' }, { destructible: true })
    const meshes = meshesOf(root)
    const skins = meshes.filter((m) => m.userData.destructionSkin === true)
    const shell = meshes.filter((m) => !m.userData.destructionSkin)
    expect(skins).toHaveLength(1)
    expect(skins[0].userData.destructionMaterial).toBe('paper')
    expect(shell.length).toBeGreaterThan(3)
    for (const m of shell) {
      expect(m.userData.destructionMaterial).toBe('aluminium')
      expect(m.userData.hollow).toBe(true)
    }
    const roots = shell.filter((m) => m.userData.destructionPart.parent === undefined)
    expect(roots).toHaveLength(1)
    for (const m of shell) if (m !== roots[0]) expect(m.userData.destructionPart).toMatchObject({ parent: 'shell', kind: 'weld' })
  })
})
