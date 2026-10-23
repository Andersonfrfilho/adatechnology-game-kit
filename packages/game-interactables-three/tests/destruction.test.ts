import { createHousehold } from '@adatechnology/game-interactables-household'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createMeshApi } from '../src'

const M = {}

describe('destruction tags', () => {
  it('copies the spec tags to static meshes, part groups and part meshes', () => {
    const { api, finish } = createMeshApi(THREE)
    api.box(M, 'wood', 0, 0, 0, 1, 1, 1, 0xaa8844, 0, 0, 0)
    api.part('door', [0, 0, 0], 0, () => {
      api.box(M, 'glass', 0, 0, 0, 1, 1, 0.1, 0xffffff, 0, 0, 0)
      api.box(M, 'metal', 0, 0, 0, 0.1, 0.1, 0.1, 0x999999, 0, 0, 0)
    })
    api.part('plain_part', [0, 0, 0], 0, () => api.box(M, 'plain', 0, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0))
    const { group, parts } = finish({
      type: 'x',
      destruction: { material: 'mdf', joint: 'screw' },
      parts: [
        { id: 'door', pivot: [0, 0, 0], motion: { kind: 'hinge', angle: 1 }, destruction: { material: 'tempered_glass', joint: 'hinge', piece: 'door' } },
      ],
    })
    const statics = group.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh)
    expect(statics.length).toBeGreaterThan(0)
    for (const m of statics) expect(m.userData.destructionMaterial).toBe('mdf')
    const door = parts.door
    expect(door.userData.destructionMaterial).toBe('tempered_glass')
    expect(door.userData.destructionPart).toEqual({ id: 'door', piece: 'door', joint: 'hinge' })
    const meshes = door.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh)
    expect(meshes.length).toBe(2)
    for (const m of meshes) {
      expect(m.userData.destructionMaterial).toBe('tempered_glass')
      expect(m.userData.destructionPart).toEqual({ id: 'door', piece: 'door', joint: 'hinge' })
    }
    // a part without tags is left alone
    expect(parts.plain_part.userData.destructionMaterial).toBeUndefined()
    expect(parts.plain_part.userData.destructionPart).toBeUndefined()
  })

  it('leaves userData alone without a spec', () => {
    const { api, finish } = createMeshApi(THREE)
    api.box(M, 'wood', 0, 0, 0, 1, 1, 1, 0xaa8844, 0, 0, 0)
    const { group } = finish()
    expect(group.children[0].userData.destructionMaterial).toBeUndefined()
  })

  it('tags a real wardrobe: mdf body, hinged mdf doors, clip drawers', () => {
    const hh = createHousehold({ region: 'br', locale: 'en' })
    const mesh = createMeshApi(THREE)
    const spec = hh.build('wardrobe', { seed: 3 }, mesh.api)
    const { group, parts } = mesh.finish(spec)
    for (const c of group.children) if ((c as THREE.Mesh).isMesh) expect(c.userData.destructionMaterial).toBe('mdf')
    expect(parts.door_1.userData.destructionPart).toEqual({ id: 'door_1', piece: 'door', joint: 'hinge' })
    expect(parts.drawer_1.userData.destructionPart).toEqual({ id: 'drawer_1', piece: 'drawer', joint: 'clip' })
    for (const g of Object.values(parts)) expect(g.userData.destructionMaterial).toBe('mdf')
  })

  it('merged blind slats keep tags on the shared group', () => {
    const hh = createHousehold({ region: 'br', locale: 'en' })
    const mesh = createMeshApi(THREE, { quality: 'game' })
    const spec = hh.build('blinds', { seed: 1 }, mesh.api)
    const { parts } = mesh.finish(spec)
    const g = parts.slat_1
    expect(g.userData.destructionMaterial).toBe('aluminium')
    expect(g.userData.destructionPart.piece).toBe('slat')
  })
})
