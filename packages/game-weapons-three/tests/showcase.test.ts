import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import { createArsenal } from '@adatechnology/game-weapons'
import { createWeaponsTestModule } from '../src'
import { hasWeaponModel } from '../src/models'
import { SHOWCASE, SHOWCASE_IDS, showcaseControls, showcasePhoto } from '../src/test-area/showcase'
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

function areaRoom(options: { readonly referencePhotos?: boolean; readonly ui?: boolean } = {}): TestRoom {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: options.ui ?? false, arsenal })
  rooms.push(room)
  expect(room.loadModule(createWeaponsTestModule({ locale: 'en', arsenal, ...(options.referencePhotos === undefined ? {} : { referencePhotos: options.referencePhotos }) })).problems).toEqual([])
  return room
}
const thumbnail = (): HTMLButtonElement | null => document.querySelector('.tr-corner')
const lightbox = (): HTMLElement | null => document.querySelector('.tr-lightbox')
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

  it('lists the photo of the real weapon with its credit, or none for a weapon in missing', () => {
    const photo = showcasePhoto(arsenal, text, 'hk_g36c')
    expect(photo?.url).toMatch(/^https:\/\/upload\.wikimedia\.org\//)
    expect(photo?.page).toMatch(/^https:\/\/commons\.wikimedia\.org\//)
    expect(photo?.credit).toMatch(/CC BY/)
    expect(showcasePhoto(arsenal, text, 'hk_g36k')).toBeUndefined()
  })

  describe('the reference photo', () => {
    afterEach(() => {
      document.body.replaceChildren()
    })

    it('is off by default: no thumbnail, no sheet image, in a room with a screen', () => {
      const room = areaRoom({ ui: true })
      room.bench('weapons_area')!.set(SHOWCASE_IDS.weapon, 'hk_g36c')
      expect(thumbnail()).toBeNull()
      expect(document.querySelector('.tr-sheet-image, .tr-sheet')).toBeNull()
      expect(document.querySelector('.tr-corner, .tr-lightbox, img')).toBeNull()
    })

    it('shows a small thumbnail with the credit, opens large, and closes on a click outside or Esc', () => {
      const room = areaRoom({ ui: true, referencePhotos: true })
      room.bench('weapons_area')!.set(SHOWCASE_IDS.weapon, 'hk_g36c')
      const small = thumbnail()!
      expect(small.tagName).toBe('BUTTON')
      expect(small.querySelector('img')?.alt).toBe('Photo of a real HK G36C')
      expect(small.title).toMatch(/CC BY/)
      expect(lightbox()).toBeNull()
      expect(document.querySelector('.tr-sheet-image')).toBeNull()
      small.click()
      const big = lightbox()!
      expect(big.querySelector('a')?.getAttribute('href')).toMatch(/^https:\/\/commons\.wikimedia\.org\//)
      big.querySelector('figure')!.click()
      expect(lightbox()).not.toBeNull()
      big.click()
      expect(lightbox()).toBeNull()
      small.click()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(lightbox()).toBeNull()
    })

    it('follows the weapon on the showcase and hides for one in missing or none', () => {
      const room = areaRoom({ ui: true, referencePhotos: true })
      const bench = room.bench('weapons_area')!
      bench.set(SHOWCASE_IDS.weapon, 'hk_g36c')
      const first = thumbnail()?.querySelector('img')?.src
      bench.set(SHOWCASE_IDS.weapon, 'ak_47')
      const second = thumbnail()?.querySelector('img')?.src
      expect(second).toBeTruthy()
      expect(second).not.toBe(first)
      expect(document.querySelectorAll('.tr-corner')).toHaveLength(1)
      bench.set(SHOWCASE_IDS.weapon, 'hk_g36k')
      expect(thumbnail()).toBeNull()
      bench.set(SHOWCASE_IDS.weapon, 'hk_g36c')
      expect(thumbnail()).not.toBeNull()
      bench.set(SHOWCASE_IDS.weapon, 'none')
      expect(thumbnail()).toBeNull()
    })
  })
})
