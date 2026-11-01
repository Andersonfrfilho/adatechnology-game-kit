import { createGoodsItems, goodsText } from '@adatechnology/game-items-goods'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { kitOriginOf } from '@adatechnology/game-contracts'
import { createItemModels, createItemsTestModule, FINDS_TABLE_ID, HUMAN_ID, ITEM_PREFIX, listItemModels, RULER_ID, SHELF_HEIGHT, shelvesLayout, SHIPPED_MODELS, SHOWCASE_PREFIX, SHOWCASE_STAND_ID } from '../src'

const catalog = createGoodsItems()
const translate = (key: string, locale: string): string | undefined => goodsText(key, locale)

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

// what the host's person builder returns (a survivor of game-characters-three in the kit's page): any object, the module brings it to 1.80 m
const person = (T: unknown): THREE.Object3D => {
  const root = new (T as typeof THREE).Group()
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.3)))
  root.children[0]!.position.y = 0.85
  return root
}

function roomWithItems(locale = 'pt-BR', withPerson = true): { room: TestRoom; module: ReturnType<typeof createItemsTestModule> } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale, catalog: [], renderer: stubRenderer(), ui: false })
  const module = createItemsTestModule({ catalog, locale, translate, ...(withPerson ? { person } : {}) })
  const report = room.loadModule(module)
  expect(report.problems).toEqual([])
  return { room, module }
}

describe('shelves layout', () => {
  const items = catalog.list()
  const categories = [...new Set(items.map((item) => item.category))]
  const plans = shelvesLayout(items, categories)

  it('has one shelf per category and every item once, in the place of its shelf', () => {
    expect(plans.map((plan) => plan.category)).toEqual(categories)
    const placed = plans.flatMap((plan) => plan.items.map((p) => p.item))
    expect(placed.sort()).toEqual(items.map((item) => `${ITEM_PREFIX}${item.id}`).sort())
    for (const plan of plans) {
      for (const placement of plan.items) {
        expect(Math.abs(placement.position[0] - plan.position[0]), placement.item).toBeLessThanOrEqual(plan.length / 2)
        expect(Math.abs(placement.position[2] - plan.position[2]), placement.item).toBeLessThanOrEqual(plan.depth / 2)
        expect(placement.position[1]).toBeCloseTo(SHELF_HEIGHT + 0.01, 5)
      }
    }
  })

  it('keeps the items of a shelf apart: no two overlap on the top', () => {
    for (const plan of plans) {
      const boxes = plan.items.map((p) => {
        const item = catalog.get(p.item.slice(ITEM_PREFIX.length))
        return { id: item.id, x0: p.position[0] - item.size[0] / 2, x1: p.position[0] + item.size[0] / 2, z0: p.position[2] - item.size[2] / 2, z1: p.position[2] + item.size[2] / 2 }
      })
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!
          const b = boxes[j]!
          const overlap = a.x0 < b.x1 - 1e-9 && b.x0 < a.x1 - 1e-9 && a.z0 < b.z1 - 1e-9 && b.z0 < a.z1 - 1e-9
          expect(overlap, `${a.id} and ${b.id} on the shelf of ${plan.category}`).toBe(false)
        }
      }
    }
  })

  it('keeps the shelves from each other and inside the arena', () => {
    for (let i = 0; i < plans.length; i++) {
      const a = plans[i]!
      expect(Math.abs(a.position[0]) + a.length / 2).toBeLessThan(14)
      expect(Math.abs(a.position[2]) + a.depth / 2).toBeLessThan(14)
      for (const b of plans.slice(i + 1)) {
        const apart = Math.abs(a.position[0] - b.position[0]) >= (a.length + b.length) / 2 || Math.abs(a.position[2] - b.position[2]) >= (a.depth + b.depth) / 2
        expect(apart, `${a.category} and ${b.category}`).toBe(true)
      }
    }
  })

  it('is the same every time', () => {
    expect(shelvesLayout(items, categories)).toEqual(plans)
  })
})

describe('items test area', () => {
  it('passes the contract checks of the host and opens with every item, the 24 models, the references and the finds table', () => {
    const { room } = roomWithItems()
    const placed = room.openArea('items_area')
    const sealed = catalog.list().filter((item) => item.seal?.openWith?.some((tool) => catalog.has(tool)))
    expect(placed.filter((o) => o.itemId.startsWith(ITEM_PREFIX))).toHaveLength(catalog.list().length + sealed.length)
    expect(new Set(placed.filter((o) => o.itemId.startsWith(ITEM_PREFIX)).map((o) => o.itemId)).size).toBe(catalog.list().length)
    expect(placed.filter((o) => o.itemId.startsWith(SHOWCASE_PREFIX))).toHaveLength(listItemModels().length)
    for (const id of [SHOWCASE_STAND_ID, RULER_ID, HUMAN_ID, FINDS_TABLE_ID]) expect(placed.some((o) => o.itemId === id), id).toBe(true)
  })

  it('lays an opening tool beside each sealed tin, within reach of whoever picks the tin up', () => {
    const { room } = roomWithItems()
    const placed = room.openArea('items_area')
    const sealed = catalog.list().filter((item) => item.seal?.openWith?.some((tool) => catalog.has(tool)))
    expect(sealed.length).toBeGreaterThan(0)
    for (const item of sealed) {
      const tin = placed.find((o) => o.itemId === `${ITEM_PREFIX}${item.id}`)!
      const tools = new Set(item.seal!.openWith!.map((tool) => `${ITEM_PREFIX}${tool}`))
      const near = placed.filter((o) => tools.has(o.itemId)).map((o) => Math.hypot(o.root.position.x - tin.root.position.x, o.root.position.z - tin.root.position.z))
      expect(Math.min(...near), item.id).toBeLessThan(0.4)
    }
  })

  it('draws the shelves and the finds table with the furniture catalogue, and the person the host gives at 1.80 m (none without one)', () => {
    const { room } = roomWithItems()
    const placed = room.openArea('items_area')
    const rootOf = (itemId: string): THREE.Object3D => placed.find((o) => o.itemId === itemId)!.root as THREE.Object3D
    for (const id of [FINDS_TABLE_ID, ...placed.filter((o) => o.itemId.startsWith('shelf_')).map((o) => o.itemId)]) {
      expect(kitOriginOf(rootOf(id)), id).toMatchObject({ owner: 'game-floorplan-three', kind: 'furniture' })
    }
    expect(new THREE.Box3().setFromObject(rootOf(HUMAN_ID)).getSize(new THREE.Vector3()).y).toBeCloseTo(1.8, 2)
    const bare = roomWithItems('pt-BR', false).room.openArea('items_area')
    expect(bare.some((o) => o.itemId === HUMAN_ID)).toBe(false)
  })

  it('declares a valid bench in both languages', () => {
    for (const locale of ['pt-BR', 'en']) {
      const module = createItemsTestModule({ catalog, locale, translate })
      expect(module.controls?.(locale).map((c) => c.id)).toEqual(expect.arrayContaining(['category', 'wear', 'age_days', 'storage', 'powered', 'place', 'container', 'state', 'day', 'seed', 'roll_finds', 'recipe', 'craft']))
      expect(module.layers?.(locale).map((l) => l.id)).toEqual(['labels', 'boxes', 'simple_shapes'])
      expect(module.items(locale).every((item) => item.name.length > 0)).toBe(true)
    }
  })

  it('gives every catalog item a thumbnail and its name in the language of the room', () => {
    const items = createItemsTestModule({ catalog, locale: 'pt-BR', translate }).items('pt-BR')
    const beans = items.find((item) => item.id === `${ITEM_PREFIX}canned_beans`)
    expect(beans?.name).toBe('Feijão em lata')
    expect(items.filter((item) => item.id.startsWith(ITEM_PREFIX) && !item.thumbnail?.startsWith('<svg'))).toEqual([])
  })

  it('hides the shelves and items of the other categories', () => {
    const { room, module } = roomWithItems()
    const placed = room.openArea('items_area')
    const bench = room.bench('items_area')
    expect(bench?.set('category', 'food')).toBe(true)
    const visible = placed.filter((o) => o.itemId.startsWith(ITEM_PREFIX) && o.root.visible)
    expect(visible.length).toBe(catalog.byCategory('food').length)
    expect(module.shelves().length).toBeGreaterThan(10)
    expect(bench?.set('category', 'all')).toBe(true)
    expect(placed.filter((o) => o.itemId.startsWith(ITEM_PREFIX) && !o.root.visible)).toEqual([])
  })

  it('wears the items with the bench and spoils the food with age, less in a fridge with power', () => {
    const { room, module } = roomWithItems()
    room.openArea('items_area')
    const bench = room.bench('items_area')!
    const colorOf = (itemId: string): number => {
      const entry = module.placed().find((p) => p.itemId === itemId && p.group === 'shelf')!
      let color = -1
      entry.root.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (color < 0 && mesh.isMesh) color = (mesh.material as THREE.MeshStandardMaterial).color.getHex()
      })
      return color
    }
    const fresh = colorOf('canned_beans')
    bench.set('wear', 'spoiled')
    expect(colorOf('canned_beans')).not.toBe(fresh)
    bench.set('wear', 'new')
    expect(colorOf('canned_beans')).toBe(fresh)
    const apple = catalog.list().find((item) => item.shelfLife !== undefined && item.shelfLife < 30)
    if (apple) {
      const before = colorOf(apple.id)
      bench.set('age_days', 400)
      expect(colorOf(apple.id)).not.toBe(before)
      bench.set('storage', 'freezer')
      bench.set('age_days', 20)
      expect(module.state.storage).toBe('freezer')
    }
  })

  it('rolls the finds of the container on the table, the same for the same seed', () => {
    const { room, module } = roomWithItems()
    room.openArea('items_area')
    const bench = room.bench('items_area')!
    bench.set('place', 'house')
    bench.set('container', 'fridge')
    bench.set('seed', 5)
    expect(bench.act('roll_finds')).toBe(true)
    const first = JSON.stringify(module.finds())
    expect(module.finds().length).toBeGreaterThan(0)
    expect(module.finds().every((stack) => catalog.has(stack.itemId))).toBe(true)
    bench.act('roll_finds')
    expect(JSON.stringify(module.finds())).toBe(first)
    bench.set('seed', 6)
    bench.act('roll_finds')
    expect(JSON.stringify(module.finds())).not.toBe(first)
  })

  it('makes a recipe with what it asks for and lays the result on the table', () => {
    const { room, module } = roomWithItems()
    room.openArea('items_area')
    const bench = room.bench('items_area')!
    const recipe = [...catalog.recipes.values()].find((r) => 'item' in r.output)!
    expect(bench.set('recipe', recipe.id)).toBe(true)
    expect(bench.act('craft')).toBe(true)
    expect(module.finds().length).toBe(1)
  })

  it('counts what is on show and follows the category', async () => {
    const { room } = roomWithItems()
    room.openArea('items_area')
    const bench = room.bench('items_area')!
    const all = room.metrics().module
    expect(Number(all.items)).toBeGreaterThan(catalog.list().length)
    expect(Number(all.draw_calls)).toBeGreaterThan(Number(all.items))
    expect(String(all.modeled)).toBe(`${SHIPPED_MODELS.filter(({ entry }) => catalog.has(entry.id)).length}/${catalog.list().length}`)
    bench.set('category', 'keys')
    const keys = room.metrics().module
    expect(Number(keys.items)).toBeLessThan(Number(all.items))
  })

  it('turns the size boxes on and off', () => {
    const { room } = roomWithItems()
    room.openArea('items_area')
    const bench = room.bench('items_area')!
    const before = room.scene.children.length
    bench.setLayer('boxes', true)
    expect(room.scene.children.length).toBeGreaterThan(before)
    bench.setLayer('boxes', false)
    expect(room.scene.children.length).toBe(before)
  })

  it('runs its own scenarios and they pass', async () => {
    const { room } = roomWithItems()
    room.openArea('items_area')
    const own = room.scenarios.filter((s) => ['real_size', 'models', 'budgets', 'ruler', 'finds', 'freshness', 'craft'].some((id) => s.id.endsWith(id)))
    expect(own).toHaveLength(7)
    const report = await room.runScenarios(own)
    const failed = report.results.filter((r) => !r.ok).map((r) => ({ id: r.id, checks: r.checks.filter((c) => !c.ok).map((c) => c.label).slice(0, 5) }))
    expect(failed).toEqual([])
  })
})

describe('items test area by instance', () => {
  it('shows the models of the set it is given, not the global registry', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, locale: 'pt-BR', catalog: [], renderer: stubRenderer(), ui: false })
    const removed = SHIPPED_MODELS[0]!.entry.id
    const module = createItemsTestModule({ catalog, translate, models: createItemModels({ remove: [removed] }) })
    expect(room.loadModule(module).problems).toEqual([])
    const stand = module.placed().filter((entry) => entry.group === 'showcase')
    expect(stand.map((entry) => entry.itemId)).not.toContain(removed)
    expect(stand).toHaveLength(SHIPPED_MODELS.length - 1)
    expect(listItemModels()).toContain(removed)
  })
})
