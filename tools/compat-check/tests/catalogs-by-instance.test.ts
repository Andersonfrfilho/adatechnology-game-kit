import { buildItemWeaponModel, buildModeledProp, createWeaponProps, itemModelOfWeapon, registerWeaponItemModel } from '@adatechnology/game-weapons-three'
import { createShapePool, createShapes, generate, getGenerator, registerGenerator, unregisterGenerator } from '@adatechnology/game-shapes'
import { buildItem, buildItemLod, createItemModels, itemThumbnail, hasItemModel, listItemModels, registerItemModel, SHIPPED_MODELS, unregisterItemModel } from '@adatechnology/game-items-three'
import * as THREE from 'three'
import { ASSEMBLIES, assemblyPart, createAssemblies, getAssembly, registerAssembly } from '@adatechnology/game-destruction'
import { createFloorplan, engine } from '@adatechnology/game-floorplan'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { describe, expect, it } from 'vitest'

describe('T5.2 floorplan: the old global engine, called as before, matches an engine made by instance', () => {
  registerResidential(engine, { region: 'br' })
  const made = createFloorplan({ packs: [(target) => registerResidential(target, { region: 'br' })] })

  it('generates the same plans for the same seeds', () => {
    for (const seed of [1, 7, 42]) {
      const options = { seed, locale: 'en' }
      expect(JSON.stringify(made.generate('single_storey_a', options))).toBe(JSON.stringify(engine.generate('single_storey_a', options)))
    }
  })

  it('shares nothing with the global engine', () => {
    const lonely = createFloorplan()
    expect(Object.keys(lonely.templates)).toEqual([])
    expect(Object.keys(engine.templates).length).toBeGreaterThan(0)
  })
})

describe('T5.2 destruction: the old global assembly calls match a set made by instance', () => {
  const options = { id: 'wall', width: 4, height: 2.7, position: [0, 1.35, 0] as [number, number, number] }

  it('give the same wall for every shipped assembly', () => {
    const made = createAssemblies()
    for (const assembly of ASSEMBLIES) expect(made.part(assembly.id, options)).toEqual(assemblyPart(assembly.id, options))
  })

  it('registerAssembly on the global list does not reach a set made before or after', () => {
    const before = createAssemblies()
    registerAssembly({ id: 'compat_wall', name: 'Compat', core: { material: 'concrete', thickness: 0.1 } })
    expect(getAssembly('compat_wall')).toBeDefined()
    expect(before.get('compat_wall')).toBeUndefined()
    expect(createAssemblies().get('compat_wall')).toBeUndefined()
  })
})

describe('T5.2 items-three: the old global model registry matches a set made by instance', () => {
  const item = (model: string) => ({ id: model, category: 'x', size: [0.1, 0.12, 0.1] as [number, number, number], model })
  const draw = SHIPPED_MODELS[0]!.entry.id

  it('lists and draws the same shipped models', () => {
    const made = createItemModels()
    expect(made.list()).toEqual(listItemModels())
    expect(made.build(THREE, item(draw)).kind).toBe(buildItem(THREE, item(draw)).kind)
  })

  it('registerItemModel and unregisterItemModel on the global registry do not reach a set made before', () => {
    const before = createItemModels()
    const { entry, builder } = SHIPPED_MODELS[0]!
    registerItemModel({ ...entry, id: 'compat_model' }, builder)
    expect(hasItemModel('compat_model')).toBe(true)
    expect(before.has('compat_model')).toBe(false)
    unregisterItemModel('compat_model')
    expect(createItemModels().has('compat_model')).toBe(false)
  })
})

describe('T5.2 shapes: the old global generator registry matches a set made by instance', () => {
  const stones = (params: { count: number }, context: { random: () => number }) => ({
    kind: 'group' as const,
    children: Array.from({ length: params.count }, () => ({ kind: 'box' as const, size: [1, 1, 1] as [number, number, number], position: [context.random(), 0, 0] as [number, number, number] })),
  })
  const schema = { version: 1 as const, root: { kind: 'custom' as const, generator: 'compat.stones', params: { count: 3 } } }

  it('gives the same bytes through registerGenerator and through a set, and does not share the registration', () => {
    registerGenerator('compat.stones', stones)
    try {
      const made = createShapes({ packs: [{ 'compat.stones': stones }] })
      expect(made.generate(schema, { seed: 3 })).toEqual(generate(schema, { seed: 3 }))
      expect(createShapes().get('compat.stones')).toBeUndefined()
    } finally {
      unregisterGenerator('compat.stones')
    }
    expect(getGenerator('compat.stones')).toBeUndefined()
  })
})

describe('T5.2 weapons-three: the old global weapon prop calls match a set made by instance', () => {
  const box = (object: THREE.Object3D): number[] => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).toArray()

  it('draws the same weapons from the same item models', () => {
    const made = createWeaponProps()
    for (const id of ['knife', 'crossbow', 'extinguisher', 'axe']) {
      expect(made.itemModelOf(id)).toBe(itemModelOfWeapon(id))
      expect(box(made.buildItemModel(THREE, { id })!)).toEqual(box(buildItemWeaponModel(THREE, { id })!))
    }
  })

  it('registerWeaponItemModel on the global set does not reach a set made before or after', () => {
    const before = createWeaponProps()
    registerWeaponItemModel('compat_weapon', { item: 'axe' })
    expect(itemModelOfWeapon('compat_weapon')).toBe('axe')
    expect(before.itemModelOf('compat_weapon')).toBeUndefined()
    expect(createWeaponProps().itemModelOf('compat_weapon')).toBeUndefined()
  })
})

describe('A5 consumers: the old calls without an instance still use the global sets', () => {
  const item = { id: SHIPPED_MODELS[0]!.entry.id, category: 'x', size: [0.1, 0.1, 0.1] as [number, number, number], model: SHIPPED_MODELS[0]!.entry.id }

  it('lod, thumbnail, pool and modeled props with no instance argument', async () => {
    expect(buildItemLod(THREE, item).near.kind).toBe('model')
    expect(itemThumbnail(item)).toEqual({ render: true })
    expect(createItemModels().thumbnail(item)).toEqual({ render: true })
    registerGenerator('compat.none', () => ({ kind: 'box', size: [1, 1, 1] }))
    try {
      await expect(createShapePool().generate({ version: 1, root: { kind: 'custom', generator: 'compat.none', params: {} } })).resolves.toBeDefined()
    } finally {
      unregisterGenerator('compat.none')
    }
    expect(buildModeledProp(THREE, { id: 'baseball_bat' }, 'bat')).toBeDefined()
  })
})
