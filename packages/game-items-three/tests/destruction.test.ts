import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { buildItem, DESTRUCTION_MATERIAL_BY_TAG, ITEM_FAMILIES, itemContents, itemDestruction, itemFamily } from '../src'
import { listItemModels } from '../src/models/registry'

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

describe('families of models', () => {
  it('gives every model of a family the one rule of that family', () => {
    for (const [family, entry] of Object.entries(ITEM_FAMILIES)) {
      for (const model of entry.models) {
        expect(itemFamily(model)).toBe(family)
        expect(itemDestruction(model)).toBe(entry.rule)
      }
    }
  })

  it('lists every model once, and only models that exist', () => {
    const known = new Set(listItemModels())
    const all = Object.values(ITEM_FAMILIES).flatMap((entry) => entry.models)
    expect(new Set(all).size).toBe(all.length)
    for (const model of all) expect(known.has(model)).toBe(true)
  })

  it('never makes what a container holds a loose part', () => {
    for (const model of Object.values(ITEM_FAMILIES).flatMap((entry) => entry.models)) {
      const { root } = buildItem(THREE, { id: model, category: 'food', size: [0.07, 0.12, 0.07], model }, { destructible: true })
      for (const mesh of meshesOf(root)) {
        if (mesh.userData.destructionSkin === true) continue
        const part = mesh.userData.destructionPart as { id: string; parent?: string } | undefined
        expect(part, `${model} has a loose mesh`).toBeDefined()
        expect(part?.id === 'shell' || part?.parent === 'shell').toBe(true)
      }
    }
  })

  it('draws the sauce of the beans as a skin, not as a part', () => {
    const { root } = buildItem(THREE, { id: 'canned_beans', category: 'food', size: [0.075, 0.12, 0.075], model: 'canned_beans' }, { destructible: true })
    const skins = meshesOf(root).filter((mesh) => mesh.userData.destructionSkin === true && mesh.userData.destructionMaterial === DESTRUCTION_MATERIAL_BY_TAG.food)
    expect(skins).toHaveLength(1)
  })
})

describe('what a container holds', () => {
  it('fills a soda can with soda, no more than the shell or the weight allow', () => {
    const contents = itemContents({ model: 'soda_can', size: [0.066, 0.12, 0.066], weight: 0.37 })
    expect(contents?.liquid).toBe('soda')
    expect(contents?.liters).toBeGreaterThan(0.2)
    expect(contents?.liters).toBeLessThanOrEqual(contents?.container.capacity ?? 0)
    expect(contents?.liters).toBeLessThanOrEqual(0.37 / 1.04 + 1e-9)
  })

  it('holds nothing in an empty can and puts the liquid on the shell of a drawn can', () => {
    expect(itemContents({ model: 'empty_can', size: [0.066, 0.12, 0.066] })).toBeUndefined()
    const { root } = buildItem(THREE, { id: 'soda_can', category: 'food', size: [0.066, 0.12, 0.066], model: 'soda_can', weight: 0.37 }, { destructible: true })
    const shell = meshesOf(root).filter((mesh) => (mesh.userData.destructionPart as { id: string } | undefined)?.id === 'shell')
    expect(shell).toHaveLength(1)
    expect(shell[0]?.userData.destructionContains).toMatchObject({ fluid: 'soda' })
  })
})
