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

  it('writes the loose contents of a carton of cereal on its shell', () => {
    const { root } = buildItem(THREE, { id: 'cereal_box', category: 'food', size: [0.2, 0.3, 0.08], shape: 'box', powder: { color: 0xd8b46a } }, { destructible: true })
    const shell = meshesOf(root).filter((m) => !m.userData.destructionSkin)
    expect(shell.length).toBeGreaterThan(0)
    for (const m of shell) expect(m.userData.destructionPowder).toEqual({ color: 0xd8b46a })
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

  it('rebuilds the cylinders of every can (a family with a tessellation rule) as ringed lathes, so the side, the lid and the bottom all have vertices for a dent, only when destructible', () => {
    for (const model of Object.values(ITEM_FAMILIES).filter((entry) => entry.rule.tessellate?.cylinder).flatMap((entry) => entry.models)) {
      const item = { id: model, category: 'food', size: [0.07, 0.12, 0.07] as [number, number, number], model }
      const plain = meshesOf(buildItem(THREE, item).root)
      const cylinders = plain.filter((m) => m.geometry.type === 'CylinderGeometry')
      const round = plain.filter((m) => m.geometry.type === 'CylinderGeometry' || m.geometry.type === 'LatheGeometry')
      const dented = meshesOf(buildItem(THREE, item, { destructible: true }).root).filter((m) => m.geometry.type === 'LatheGeometry')
      expect(dented.length, model).toBe(round.length)
      expect(meshesOf(buildItem(THREE, item, { destructible: true }).root).filter((m) => m.geometry.type === 'CylinderGeometry'), model).toHaveLength(0)
      for (const mesh of dented) expect((mesh.geometry as THREE.LatheGeometry).parameters.segments, model).toBeGreaterThanOrEqual(40)
      // a closed cylinder gets rings on both ends: more than the centre and the rim at its lowest and at its highest height
      const closed = dented.filter((mesh) => {
        const { points } = (mesh.geometry as THREE.LatheGeometry).parameters
        return points[0]?.x === 0 && points[points.length - 1]?.x === 0
      })
      expect(closed.length, model).toBeGreaterThanOrEqual(cylinders.length)
      for (const mesh of closed) {
        const { points } = (mesh.geometry as THREE.LatheGeometry).parameters
        expect(points.filter((p) => p.y === points[0]!.y).length, model).toBeGreaterThan(3)
        expect(points.filter((p) => p.y === points[points.length - 1]!.y).length, model).toBeGreaterThan(3)
      }
      for (const mesh of cylinders) expect((mesh.geometry as THREE.CylinderGeometry).parameters.heightSegments, model).toBeLessThan(6)
    }
  })

  it('keeps the lathe of a can outward: the side faces away from the axis, the lid up, the bottom down', () => {
    const { root } = buildItem(THREE, { id: 'soda_can', category: 'food', size: [0.066, 0.12, 0.066], model: 'soda_can' }, { destructible: true })
    const shell = meshesOf(root).find((m) => (m.userData.destructionPart as { id: string } | undefined)?.id === 'shell') as THREE.Mesh
    const geometry = shell.geometry
    geometry.computeBoundingBox()
    const box = geometry.boundingBox as THREE.Box3
    const position = geometry.getAttribute('position')
    const normal = geometry.getAttribute('normal')
    let side = 0, top = 0, bottom = 0
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i)
      const radial = Math.hypot(position.getX(i), position.getZ(i))
      if (y === box.max.y && radial < 1e-6) top = normal.getY(i)
      else if (y === box.min.y && radial < 1e-6) bottom = normal.getY(i)
      else if (y > box.min.y && y < box.max.y) side = Math.max(side, (normal.getX(i) * position.getX(i) + normal.getZ(i) * position.getZ(i)) / radial)
    }
    expect(top).toBeGreaterThan(0.9)
    expect(bottom).toBeLessThan(-0.9)
    expect(side).toBeGreaterThan(0.9)
  })

  it('gives each wall of a can its real thickness: a tenth of a millimetre on the body, more on the ends', () => {
    const { root } = buildItem(THREE, { id: 'soda_can', category: 'food', size: [0.066, 0.12, 0.066], model: 'soda_can', weight: 0.37 }, { destructible: true })
    const walls = meshesOf(root).filter((m) => !m.userData.destructionSkin)
    const body = walls.find((m) => (m.userData.destructionPart as { id: string }).id === 'shell') as THREE.Mesh
    expect(body.userData.destructionThickness).toBeCloseTo(0.0001, 6)
    for (const mesh of walls) if (mesh !== body) expect(mesh.userData.destructionThickness).toBeGreaterThan(body.userData.destructionThickness as number)
  })

  it('rebuilds the boxes of a tin too', () => {
    const { root } = buildItem(THREE, { id: 'canned_sardines', category: 'food', size: [0.1, 0.03, 0.06], model: 'canned_sardines' }, { destructible: true })
    const boxes = meshesOf(root).filter((m) => m.geometry.type === 'BoxGeometry')
    expect(boxes.length).toBeGreaterThan(3)
    for (const mesh of boxes) expect((mesh.geometry as THREE.BoxGeometry).parameters.widthSegments).toBeGreaterThanOrEqual(6)
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
