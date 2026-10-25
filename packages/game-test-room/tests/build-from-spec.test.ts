import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestruction } from '@adatechnology/game-destruction'
import { buildFromSpec, brickWallSpec } from '../src'
import { demoItems, DEMO_ITEMS, DEMO_MATERIALS } from './fixtures/demo-items'

describe('buildFromSpec', () => {
  const spec = {
    name: 'thing',
    parts: [
      { id: 'a', material: 'steel', shape: { kind: 'box' as const, size: [1, 1, 1] as [number, number, number] }, position: [0, 0.5, 0] as [number, number, number] },
      { id: 'b', material: 'glass', shape: { kind: 'cylinder' as const, radius: 0.2, height: 0.5 }, position: [1, 0.25, 0] as [number, number, number], rotation: [0, 0, 0.5] as [number, number, number] },
      { id: 'c', material: 'foliage', shape: { kind: 'sphere' as const, radius: 0.3 }, position: [2, 0.3, 0] as [number, number, number] },
    ],
  }

  it('draws one mesh per part, named and tagged for the renderer', () => {
    const root = buildFromSpec(THREE, spec)
    const meshes = root.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh)
    expect(meshes.map((m) => m.name)).toEqual(['a', 'b', 'c'])
    expect(meshes.map((m) => m.userData.destructionPart)).toEqual(['a', 'b', 'c'])
    expect(meshes[1].userData.destructionMaterial).toBe('glass')
    expect(meshes[1].rotation.z).toBeCloseTo(0.5)
    expect((meshes[1].material as THREE.MeshStandardMaterial).transparent).toBe(true)
  })

  it('takes colours per part first, then per material', () => {
    const root = buildFromSpec(THREE, spec, { colors: { a: 0xff0000, foliage: 0x00ff00 } })
    const color = (name: string) => ((root.getObjectByName(name) as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHex()
    expect(color('a')).toBe(0xff0000)
    expect(color('c')).toBe(0x00ff00)
  })
})

describe('demo catalogue', () => {
  it('has the documented items in six groups, translated', () => {
    const ids = DEMO_ITEMS.map((i) => i.id)
    for (const id of ['chair', 'wooden_crate', 'steel_drum', 'steel_sheet', 'glass_pane', 'concrete_block', 'brick_column', 'plastic_bucket', 'glass_bottle', 'coffee_cup', 'jerrycan', 'gas_bottle', 'small_tree', 'potted_plant', 'old_tv', 'car_door', 'sofa', 'shelf', 'building_frame']) {
      expect(ids).toContain(id)
    }
    expect(new Set(DEMO_ITEMS.map((i) => i.group))).toEqual(new Set(['Furniture', 'Structure', 'Vehicles', 'Plants', 'Items', 'Containers']))
    const pt = demoItems('pt-BR')
    expect(pt.find((i) => i.id === 'chair')?.name).toBe('Cadeira de madeira')
    expect(new Set(pt.map((i) => i.group))).toEqual(new Set(['Móveis', 'Estrutura', 'Veículos', 'Plantas', 'Itens', 'Recipientes']))
  })

  it('every item builds meshes that match its spec parts and the spec is valid in a world', () => {
    const world = createDestruction({ seed: 1, materials: DEMO_MATERIALS })
    for (const item of DEMO_ITEMS) {
      const root = item.build(THREE)
      const spec = typeof item.spec === 'function' ? item.spec(root) : item.spec!
      const meshNames = new Set<string>()
      root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshNames.add(o.userData.destructionPart)
      })
      expect([...meshNames].sort(), item.id).toEqual(spec.parts.map((p) => p.id).sort())
      const id = world.add(JSON.parse(JSON.stringify(spec)), { id: `t_${item.id}` })
      expect(world.state(id)!.parts.length, item.id).toBe(spec.parts.length)
    }
  })

  it('containers carry a fluid definition that points at a part with contents', () => {
    for (const item of DEMO_ITEMS.filter((i) => i.fluid)) {
      const spec = (typeof item.spec === 'function' ? item.spec(item.build(THREE)) : item.spec)!
      const part = spec.parts.find((p) => p.id === item.fluid!.part)
      expect(part?.contains, item.id).toBeTruthy()
    }
  })

  it('brick wall spec anchors the first row', () => {
    const spec = brickWallSpec(4, 3)
    expect(spec.parts).toHaveLength(12)
    expect(spec.parts.filter((p) => p.anchored)).toHaveLength(4)
  })
})
