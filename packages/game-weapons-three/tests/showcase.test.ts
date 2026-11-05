import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import { createArsenal } from '@adatechnology/game-weapons'
import { createWeaponsTestModule } from '../src'
import { hasWeaponModel } from '../src/models'
import { SHOWCASE, SHOWCASE_IDS, showcaseControls, showcaseSheet } from '../src/test-area/showcase'
import { showcaseTextOf } from '../src/test-area/showcase-text'

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

const rooms: TestRoom[] = []
afterEach(() => {
  for (const room of rooms.splice(0)) room.dispose()
})

const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
const text = showcaseTextOf('en')

function areaRoom(): TestRoom {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, arsenal })
  rooms.push(room)
  expect(room.loadModule(createWeaponsTestModule({ locale: 'en', arsenal })).problems).toEqual([])
  return room
}
const showcased = (room: TestRoom): THREE.Object3D[] => room.scene.children.filter((child) => child.name === 'weapon_showcase')

describe('the weapon showcase', () => {
  it('offers every weapon with a model, by section, and nothing without one', () => {
    const [choice] = showcaseControls(arsenal, text, 'en')
    const options = choice?.kind === 'choice' ? choice.options.slice(1) : []
    expect(options.map((option) => option.id)).toContain('hk_g36c')
    expect(options.every((option) => hasWeaponModel(option.id) && option.group)).toBe(true)
  })

  it('puts one weapon over the pedestal, turns it, and swaps it for the next', () => {
    const room = areaRoom()
    const bench = room.bench('weapons_area')!
    expect(bench.set(SHOWCASE_IDS.weapon, 'hk_g36c')).toBe(true)
    const [first] = showcased(room)
    expect(first?.getObjectByName('hk_g36c')).toBeDefined()
    expect(first?.position.toArray()).toEqual([SHOWCASE.at[0], SHOWCASE.height + SHOWCASE.lift, SHOWCASE.at[2]])
    room.update(1)
    expect(first?.rotation.y).toBeCloseTo(SHOWCASE.spin, 5)
    bench.set(SHOWCASE_IDS.spin, false)
    room.update(1)
    expect(first?.rotation.y).toBeCloseTo(SHOWCASE.spin, 5)
    bench.set(SHOWCASE_IDS.weapon, 'ak_47')
    expect(showcased(room).map((root) => root.children[0]?.name)).toEqual(['ak_47'])
    expect(first?.parent).toBeNull()
    bench.set(SHOWCASE_IDS.weapon, 'none')
    expect(showcased(room)).toEqual([])
  })

  it('shows the photo of the real weapon with its credit, or says there is none', () => {
    const sheet = showcaseSheet(arsenal, text, 'hk_g36c')
    expect(sheet.image?.url).toMatch(/^https:\/\/upload\.wikimedia\.org\//)
    expect(sheet.image?.page).toMatch(/^https:\/\/commons\.wikimedia\.org\//)
    expect(sheet.image?.credit).toMatch(/CC BY/)
    expect(showcaseSheet(arsenal, text, 'hk_g36k')).toMatchObject({ note: text.noPhoto })
  })
})
