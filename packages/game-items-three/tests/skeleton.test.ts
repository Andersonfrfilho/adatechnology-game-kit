import { createGoodsItems } from '@adatechnology/game-items-goods'
import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildItem,
  buildItemLod,
  checkBudget,
  countDrawCalls,
  createItemKit,
  cullDistanceOf,
  drawShape,
  ITEM_BUDGETS,
  mergeItem,
  MODEL_BUDGET_DEVIATIONS,
  registerItemModel,
  setWear,
  shapeOf,
  SHAPES,
  sizeClassOf,
  unregisterItemModel,
  WEAR_AMOUNT,
  WEAR_TARGET,
} from '../src'
import type { DrawableItem } from '../src'

const boxOf = (object: THREE.Object3D): THREE.Vector3 => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3())
const catalog = createGoodsItems()

describe('the kit of helpers of the showcase', () => {
  it('makes materials that remember their colour, tag and roughness, and lists them in order', () => {
    const kit = createItemKit(THREE)
    const metal = kit.metal(0x8d9096)
    const glass = kit.glass(0x8fc3dc, 0.55)
    expect(kit.materials).toEqual([metal, glass])
    expect(metal.metalness).toBe(0.55)
    expect(metal.roughness).toBe(0.45)
    expect(glass.transparent).toBe(true)
    expect(glass.opacity).toBe(0.55)
    expect(metal.userData).toMatchObject({ tag: 'metal', rough: 0.45 })
    expect(metal.userData.baseRgb[0]).toBeCloseTo(0x8d / 255, 4)
  })

  it('groups, meshes and geometries are the page helpers', () => {
    const kit = createItemKit(THREE)
    const group = kit.G(kit.mesh(kit.cyl(0.1, 0.1, 0.5), kit.wood(0x8a643c), [1, 2, 3], [0.1, 0, 0], [2, 2, 2]), kit.mesh(kit.bx(1, 1, 1), kit.plastic(0)))
    expect(group.children).toHaveLength(2)
    expect(group.children[0]!.position.toArray()).toEqual([1, 2, 3])
    expect(group.children[0]!.scale.toArray()).toEqual([2, 2, 2])
    expect(kit.extrude([[0, 0], [1, 0], [1, 1]], 0.1)).toBeInstanceOf(THREE.ExtrudeGeometry)
    expect(kit.lathe([[0, 0], [1, 1]])).toBeInstanceOf(THREE.LatheGeometry)
    expect(kit.torus(1, 0.1)).toBeInstanceOf(THREE.TorusGeometry)
  })
})

describe('setWear', () => {
  it('stage 0 is the colour the material was made with, the others go toward the target of the tag by 0.3 and 0.62 in sRGB', () => {
    const kit = createItemKit(THREE)
    const paper = kit.paper(0xe2c36a)
    const metal = kit.metal(0xff0000)
    for (const stage of [0, 1, 2] as const) {
      setWear(kit.materials, stage)
      const out = { r: 0, g: 0, b: 0 }
      paper.color.getRGB(out, 'srgb')
      const base = [0xe2, 0xc3, 0x6a].map((v) => v / 255)
      const target = [(WEAR_TARGET.paper! >> 16) & 255, (WEAR_TARGET.paper! >> 8) & 255, WEAR_TARGET.paper! & 255].map((v) => v / 255)
      const amount = WEAR_AMOUNT[stage]
      expect(out.r).toBeCloseTo(base[0]! + (target[0]! - base[0]!) * amount, 4)
      expect(out.g).toBeCloseTo(base[1]! + (target[1]! - base[1]!) * amount, 4)
      expect(out.b).toBeCloseTo(base[2]! + (target[2]! - base[2]!) * amount, 4)
      expect(paper.roughness).toBeCloseTo(Math.min(1, 0.9 + (0.2 * stage) / 2), 6)
      expect(metal.metalness).toBeCloseTo(Math.max(0.1, 0.55 - 0.2 * stage), 6)
    }
    setWear(kit.materials, 0)
    expect(paper.color.getHex()).toBe(0xe2c36a)
  })

  it('reaches the materials under an object, once each, and remembers the stage', () => {
    const item = buildItem(THREE, { id: 'beans', category: 'food', size: [0.08, 0.11, 0.08], shape: 'can', color: 0x9b3a24 })
    setWear(item.root, 2)
    expect(item.root.userData.wear).toBe(2)
    const metal = item.materials.find((m) => m.userData.tag === 'metal')!
    expect(metal.metalness).toBeCloseTo(0.15, 6)
    setWear(item.root, 0)
    expect(metal.metalness).toBeCloseTo(0.55, 6)
  })

  it('leaves alone a material the kit did not make', () => {
    const plain = new THREE.MeshStandardMaterial({ color: 0x123456 })
    setWear([plain], 2)
    expect(plain.color.getHex()).toBe(0x123456)
  })
})

describe('the simple shapes', () => {
  const SIZES: Record<string, [number, number, number]> = {
    small: [0.08, 0.11, 0.08],
    flat: [0.3, 0.03, 0.2],
    long: [0.9, 0.04, 0.05],
    tall: [0.2, 0.5, 0.2],
    large: [0.4, 0.6, 0.25],
  }

  for (const shape of SHAPES) {
    it(`${shape}: draws inside its size (2%) in every proportion and within the triangle budget`, () => {
      for (const [name, size] of Object.entries(SIZES)) {
        const kit = createItemKit(THREE)
        const group = drawShape(kit, shape, size)
        const measured = boxOf(group)
        measured.toArray().forEach((side, axis) => expect(side, `${shape}/${name} axis ${axis}`).toBeLessThanOrEqual(size[axis]! * 1.02 + 1e-6))
        const sorted = (values: number[]) => [...values].sort((a, b) => b - a)
        // the long side is filled (the shape is not a speck inside a huge box)
        expect(sorted(measured.toArray())[0]!, `${shape}/${name} longest side`).toBeGreaterThanOrEqual(sorted(size)[0]! * 0.7)
        const report = checkBudget(group, size)
        expect(report.ok, `${shape}/${name}: ${report.triangles} > ${report.limit}`).toBe(true)
      }
    })
  }

  it('half the detail has fewer triangles than the full one on the round shapes', () => {
    const kit = createItemKit(THREE)
    const full = checkBudget(drawShape(kit, 'can', [0.08, 0.11, 0.08], { detail: 1 }), [0.08, 0.11, 0.08]).triangles
    const half = checkBudget(drawShape(kit, 'can', [0.08, 0.11, 0.08], { detail: 0.5 }), [0.08, 0.11, 0.08]).triangles
    expect(half).toBeLessThan(full)
  })

  it('refines the household hints by category and proportions', () => {
    expect(shapeOf({ category: 'tools', size: [1.4, 0.05, 0.05], shape: 'tool' })).toBe('long_tool')
    expect(shapeOf({ category: 'tools', size: [0.2, 0.08, 0.05], shape: 'tool' })).toBe('tool')
    expect(shapeOf({ category: 'clothing', size: [0.5, 0.05, 0.4], shape: 'cloth' })).toBe('garment')
    expect(shapeOf({ category: 'bags', size: [0.3, 0.5, 0.2], shape: 'bag' })).toBe('backpack')
    expect(shapeOf({ category: 'bags', size: [0.3, 0.5, 0.2] })).toBe('box')
    expect(shapeOf({ category: 'books', size: [0.15, 0.22, 0.03], shape: 'paper' })).toBe('book')
    expect(shapeOf({ category: 'keys', size: [0.08, 0.04, 0.004], shape: 'tool' })).toBe('key')
    expect(shapeOf({ category: 'electronics', size: [0.07, 0.15, 0.01], shape: 'box' })).toBe('device')
    expect(shapeOf({ category: 'fuel', size: [0.3, 0.45, 0.15], shape: 'jerrycan' })).toBe('jerrycan')
  })

  it('every item of the goods catalog draws at its real size and within the budget of its class', () => {
    const over: string[] = []
    const wrong: string[] = []
    for (const item of catalog.list()) {
      const model = buildItem(THREE, item)
      const measured = boxOf(model.root)
      measured.toArray().forEach((side, axis) => {
        if (side > item.size[axis]! * 1.02 + 1e-6) wrong.push(`${item.id}[${axis}] ${side.toFixed(4)} > ${item.size[axis]}`)
      })
      const report = checkBudget(model.root, item.size)
      if (!report.ok && !(item.id in MODEL_BUDGET_DEVIATIONS)) over.push(`${item.id}: ${report.triangles}/${report.limit}`)
    }
    expect(wrong).toEqual([])
    expect(over).toEqual([])
  })
})

describe('buildItem with a model', () => {
  afterEach(() => unregisterItemModel('test_can'))

  it('keeps the builder group as drawn, scales the root to metres and rests the base on the origin', () => {
    registerItemModel({ id: 'test_can', teamId: 'lata', teamBox: [0.67, 0.57, 0.66], scale: 0.1 }, (kit) => kit.G(kit.mesh(kit.cyl(0.32, 0.32, 0.52), kit.metal(0x8d9096), [0, 0.3, 0])))
    const item: DrawableItem = { id: 'test_can', category: 'food', size: [0.064, 0.052, 0.064], model: 'test_can' }
    const model = buildItem(THREE, item)
    expect(model.kind).toBe('model')
    expect(model.root.scale.x).toBeCloseTo(0.1, 8)
    expect(model.root.children[0]!.name).toBe('lata')
    const box = new THREE.Box3().setFromObject(model.root)
    expect(box.min.y).toBeCloseTo(0, 6)
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 6)
    expect(boxOf(model.root).x).toBeCloseTo(0.064, 2)
  })

  it('draws the simple shape when the model is not registered or when asked to', () => {
    const item: DrawableItem = { id: 'x', category: 'food', size: [0.08, 0.11, 0.08], shape: 'can', model: 'nothing' }
    expect(buildItem(THREE, item).kind).toBe('shape')
    registerItemModel({ id: 'nothing', teamId: 'n', teamBox: [1, 1, 1], scale: 1 }, (kit) => kit.G(kit.mesh(kit.bx(1, 1, 1), kit.metal(0))))
    expect(buildItem(THREE, item).kind).toBe('model')
    expect(buildItem(THREE, item, { simple: true }).kind).toBe('shape')
    unregisterItemModel('nothing')
  })
})

describe('merge, LOD and budgets', () => {
  const beans = catalog.get('canned_beans')

  it('joins an item by material: as many draw calls as materials, same triangles, wear still works', () => {
    const model = buildItem(THREE, beans)
    const merged = mergeItem(THREE, model)
    expect(countDrawCalls(model.root)).toBeGreaterThan(model.materials.length - 1)
    expect(countDrawCalls(merged.root)).toBe(new Set(model.materials).size)
    expect(checkBudget(merged.root, beans.size).triangles).toBe(checkBudget(model.root, beans.size).triangles)
    setWear(merged.root, 2)
    expect(model.materials.some((m) => m.userData.tag === 'metal' && Math.abs(m.metalness - 0.15) < 1e-6)).toBe(true)
  })

  it('classes an item by its longest side and gives each class its triangles and distance', () => {
    expect(sizeClassOf([0.08, 0.11, 0.08])).toBe('small')
    expect(sizeClassOf([0.9, 0.04, 0.05])).toBe('large')
    expect(cullDistanceOf([0.08, 0.11, 0.08])).toBe(30)
    expect(cullDistanceOf([0.9, 0.04, 0.05])).toBe(60)
    expect(ITEM_BUDGETS.drawCalls).toBe(30)
  })

  it('has three levels: detail up close, the half shape farther, nothing past the cull distance', () => {
    const lod = buildItemLod(THREE, beans)
    expect(lod.cullDistance).toBe(30)
    expect(lod.lod1Distance).toBe(10)
    expect(lod.root.getObjectForDistance(2)).toBe(lod.near.root)
    expect(lod.root.getObjectForDistance(15)).toBe(lod.far.root)
    expect(lod.root.getObjectForDistance(31)?.children).toHaveLength(0)
    expect(checkBudget(lod.far.root, beans.size).triangles).toBeLessThanOrEqual(checkBudget(lod.near.root, beans.size).triangles)
    setWear(lod.root, 1)
    expect(lod.root.userData.wear).toBe(1)
  })
})
