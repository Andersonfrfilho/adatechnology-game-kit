import { createGoodsItems, goodsText } from '@adatechnology/game-items-goods'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { buildItem, createItemsTestModule, ITEM_PREFIX, itemOpening, openItem, OPENING_NAME, setOpeningContents } from '../src'

const boxOf = (root: THREE.Object3D, only?: (o: THREE.Object3D) => boolean): THREE.Box3 => {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3()
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && (!only || only(o))) box.expandByObject(o)
  })
  return box
}
const inOpening = (o: THREE.Object3D): boolean => o.userData.itemOpening === true

describe('an opened can', () => {
  it('knows how each sealed model opens: a tin by its cut lid, a drink can by its tab, the sardines by peeling, an empty can not at all', () => {
    expect(itemOpening('canned_beans')).toEqual({ style: 'cut_lid', food: '#7a2e1c' })
    expect(itemOpening('soda_can')?.style).toBe('pull_tab')
    expect(itemOpening('canned_sardines')?.style).toBe('peel_lid')
    expect(itemOpening('empty_can')).toBeUndefined()
    expect(itemOpening('hammer')).toBeUndefined()
  })

  it('bends the cut lid of a tin up off its top and shows the food inside the rim, once', () => {
    const { root } = buildItem(THREE, { id: 'canned_beans', category: 'food', size: [0.08, 0.11, 0.08], model: 'canned_beans' }, { destructible: true })
    const shell = boxOf(root)
    expect(openItem(THREE, root, 'canned_beans')).toBe(true)
    const opening = root.getObjectByName(OPENING_NAME)!
    const added = boxOf(root, inOpening)
    // the lid stands up above the top by most of the tin's width, within the tin's footprint
    expect(added.max.y - shell.max.y).toBeGreaterThan(0.6 * 0.04)
    expect(added.min.y).toBeGreaterThan(shell.max.y - 0.002)
    expect(added.max.x).toBeLessThan(shell.max.x + 0.003)
    opening.traverse((o) => (o as THREE.Mesh).isMesh && expect(o.userData.destructionDebris).toBe(true))
    expect(openItem(THREE, root, 'canned_beans')).toBe(true)
    expect(root.children.filter((c) => c.name === OPENING_NAME)).toHaveLength(1)
    const food: THREE.Object3D[] = []
    opening.traverse((o) => o.userData.itemFood && food.push(o))
    expect(food).toHaveLength(1)
    setOpeningContents(root, 0.5)
    expect(food[0]!.visible).toBe(true)
    expect(food[0]!.scale.x).toBeLessThan(1)
    setOpeningContents(root, 0)
    expect(food[0]!.visible).toBe(false)
  })

  it('opens a drink can with a dark mouth on its lid, and draws nothing for a model that does not open', () => {
    const { root } = buildItem(THREE, { id: 'soda_can', category: 'drink', size: [0.066, 0.122, 0.066], model: 'soda_can' }, { destructible: true })
    const shell = boxOf(root)
    expect(openItem(THREE, root, 'soda_can')).toBe(true)
    const mouth = boxOf(root, inOpening)
    expect(mouth.max.y - shell.max.y).toBeLessThan(0.002)
    expect(mouth.getSize(new THREE.Vector3()).x).toBeLessThan(0.66 * 0.5 * 0.066)
    const empty = buildItem(THREE, { id: 'hammer', category: 'tools', size: [0.1, 0.3, 0.03], model: 'hammer' }).root
    expect(openItem(THREE, empty, 'hammer')).toBe(false)
    expect(empty.getObjectByName(OPENING_NAME)).toBeUndefined()
  })
})

describe('an opened jar or bottle', () => {
  it('takes the cap off a jar of honey and shows the honey in its mouth, where the cap sat', () => {
    expect(itemOpening('honey_jar')).toEqual({ style: 'screw_cap', food: '#d99a1c' })
    expect(itemOpening('water_bottle')?.style).toBe('screw_cap')
    const { root } = buildItem(THREE, { id: 'honey_jar', category: 'food', size: [0.08, 0.1, 0.08], model: 'honey_jar' }, { destructible: true })
    const lids: THREE.Object3D[] = []
    root.traverse((o) => o.userData.itemLid && lids.push(o))
    expect(lids).toHaveLength(1)
    const cap = boxOf(root, (o) => o.userData.itemLid === true)
    expect(openItem(THREE, root, 'honey_jar')).toBe(true)
    expect(lids[0]!.visible).toBe(false)
    const mouth = boxOf(root, inOpening)
    expect(mouth.min.y).toBeGreaterThan(cap.min.y - 0.002)
    expect(mouth.max.y).toBeLessThan(cap.min.y + 0.002)
    expect(mouth.getSize(new THREE.Vector3()).x).toBeLessThan(cap.getSize(new THREE.Vector3()).x)
    const food: THREE.Object3D[] = []
    root.getObjectByName(OPENING_NAME)!.traverse((o) => o.userData.itemFood && food.push(o))
    expect(food).toHaveLength(1)
  })

  it('every model drawn with a screw cap marks the cap it takes off', () => {
    for (const id of ['honey_jar', 'home_preserves', 'cooking_oil', 'water_bottle', 'water_jug_5l', 'dirty_water', 'sports_drink', 'coconut_water', 'cachaca', 'communion_wine']) {
      expect(itemOpening(id)?.style, id).toBe('screw_cap')
      const { root } = buildItem(THREE, { id, category: 'food', size: [0.08, 0.2, 0.08], model: id })
      expect(openItem(THREE, root, id), id).toBe(true)
      const lids: THREE.Object3D[] = []
      root.traverse((o) => o.userData.itemLid && lids.push(o))
      expect(lids.length, id).toBeGreaterThan(0)
      expect(lids.every((o) => !o.visible), id).toBe(true)
    }
  })
})

describe('opening and eating a can in the room', () => {
  const catalog = createGoodsItems()
  const stubRenderer = (): THREE.WebGLRenderer =>
    ({ domElement: document.createElement('canvas'), shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined }) as unknown as THREE.WebGLRenderer
  const room = (): TestRoom => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const r = createTestRoom({ THREE, container, locale: 'pt-BR', catalog: [], renderer: stubRenderer(), ui: false })
    expect(r.loadModule(createItemsTestModule({ catalog, locale: 'pt-BR', translate: goodsText })).problems).toEqual([])
    return r
  }
  const hold = (r: TestRoom, id: string): ReturnType<TestRoom['spawn']> => {
    const so = r.spawn(`${ITEM_PREFIX}${id}`, [0, 0, -1.2], 0)
    for (let i = 0; i < 30; i++) r.update(1 / 60)
    r.look([0, 0.6, -0.6], [0, 0.04, -1.2])
    expect(r.grab()).toBe(true)
    return so
  }
  const run = (r: TestRoom, seconds: number): void => {
    for (let i = 0; i < seconds * 60; i++) r.update(1 / 60)
  }
  const texts = (r: TestRoom): string => r.log.entries().map((e) => e.text).join('\n')

  it('a tin of beans asks for an opener, opens with the one on the table and is eaten to the last spoonful', () => {
    const r = room()
    const tin = hold(r, 'canned_beans')
    const fluid = r.fluids.container(`${tin.objectId}_fluid`)!
    const full = fluid.liters
    expect(r.useItem('eat')).toBe(false)
    expect(texts(r)).toMatch(/Para abrir Feijão em lata precisa de Abridor de lata, Canivete/)
    expect(tin.root.getObjectByName(OPENING_NAME)).toBeUndefined()
    r.spawn(`${ITEM_PREFIX}can_opener`, [0.3, 0, -0.4], 0)
    expect(r.useItem('eat')).toBe(true)
    run(r, 1.2)
    expect(texts(r)).toMatch(/Abriu Feijão em lata com Abridor de lata/)
    expect(tin.root.getObjectByName(OPENING_NAME)).toBeDefined()
    expect(r.fluids.container(`${tin.objectId}_fluid`)!.liters).toBeCloseTo(full, 6)
    // a little spilt from the open mouth is not a leak: the rest is still food
    r.fluids.pour(`${tin.objectId}_fluid`, 0.2)
    expect(r.fluids.container(`${tin.objectId}_fluid`)!.liters).toBeLessThan(full)
    const before = r.fluids.container(`${tin.objectId}_fluid`)!.liters
    expect(r.useItem('eat')).toBe(true)
    run(r, 4)
    expect(r.fluids.container(`${tin.objectId}_fluid`)!.liters).toBeLessThan(before * 0.1)
    expect(texts(r)).toMatch(/Comeu (todo o conteúdo de Feijão em lata|\d+ g de Feijão em lata)/)
    // eaten, not drunk: no drinking line for the brine
    expect(texts(r)).not.toMatch(/Feijão em lata: bebeu/)
    // eaten up: the food inside the rim is gone, the open tin stays
    const food: THREE.Object3D[] = []
    tin.root.getObjectByName(OPENING_NAME)!.traverse((o) => o.userData.itemFood && food.push(o))
    expect(food.every((o) => !o.visible)).toBe(true)
  })

  it('a jar of honey is opened by hand before the first spoonful, then eaten', () => {
    const r = room()
    const jar = hold(r, 'honey_jar')
    expect(r.useItem('eat')).toBe(true)
    run(r, 1.5)
    expect(texts(r)).toMatch(/Abriu Pote de mel com a mão/)
    expect(jar.root.getObjectByName(OPENING_NAME)).toBeDefined()
    // the cap comes off first, then the spoonful
    expect(texts(r)).toMatch(/Abriu Pote de mel com a mão[\s\S]*Pote de mel: comer/)
  })

  it('a soda opens by its tab on the way to the mouth; shot through, neither it nor a tin is eaten or drunk', () => {
    const r = room()
    const soda = hold(r, 'soda_can')
    expect(r.useItem('sip')).toBe(true)
    run(r, 1.5)
    expect(texts(r)).toMatch(/Abriu Refrigerante \(lata\) com a mão/)
    expect(soda.root.getObjectByName(OPENING_NAME)).toBeDefined()

    const shot = room()
    const tin = shot.spawn(`${ITEM_PREFIX}canned_corn_and_peas`, [0, 0, -1.2], 0)
    shot.spawn(`${ITEM_PREFIX}can_opener`, [0.3, 0, -0.4], 0)
    run(shot, 0.5)
    shot.setTool('pistol_9mm')
    shot.waitUntilReady(5)
    const box = new THREE.Box3().setFromObject(tin.root)
    const c = box.getCenter(new THREE.Vector3())
    shot.look([c.x, c.y, c.z + 0.8], [c.x, c.y, c.z])
    shot.use()
    run(shot, 0.5)
    shot.setTool('hand')
    shot.look([0, 0.6, -0.6], [tin.root.position.x, 0.04, tin.root.position.z])
    expect(shot.grab()).toBe(true)
    expect(shot.useItem('eat')).toBe(false)
    expect(texts(shot)).toMatch(/a embalagem furou, o conteúdo está contaminado/)
  })
})
