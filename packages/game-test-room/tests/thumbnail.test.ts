import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { TestableModule } from '@adatechnology/game-contracts'
import { createTestRoom, demoItems } from '../src'
import type { TestRoomItem } from '../src'
import { stubRenderer } from './helpers'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" fill="currentColor"><path d="M0 0H10V10Z"/></svg>'
const URL_THUMB = 'assets/weapon-svg/generated/glock_17.svg'

const withThumbnails = (): TestRoomItem[] =>
  demoItems('en').map((item) => (item.id === 'chair' ? { ...item, thumbnail: SVG } : item.id === 'sofa' ? { ...item, thumbnail: URL_THUMB } : item))

const open = (catalog: TestRoomItem[]) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog, renderer: stubRenderer(), ui: true })
  return { container, room }
}
const buttonOf = (container: HTMLElement, name: string): HTMLElement => [...container.querySelectorAll<HTMLElement>('.tr-item button')].find((b) => b.textContent === name) as HTMLElement
const pictureOf = (button: HTMLElement): string => (button.querySelector('.tr-thumb') as HTMLElement | null)?.style.getPropertyValue('--tr-thumb') ?? ''

describe('item thumbnails in the catalogue', () => {
  it('draws the thumbnail above the name for an item that has one, and the name alone for one that has not', () => {
    const { container, room } = open(withThumbnails())
    const names = [...container.querySelectorAll('.tr-item button')].map((b) => b.textContent)
    expect(names).toContain('Wooden chair')
    const chair = buttonOf(container, 'Wooden chair')
    expect(chair.classList.contains('has-thumb')).toBe(true)
    expect(pictureOf(chair)).toContain('data:image/svg+xml,%3Csvg')
    const plain = [...container.querySelectorAll<HTMLElement>('.tr-item .tr-btn:not(.has-thumb)')][0] as HTMLElement
    expect(plain.querySelector('.tr-thumb')).toBeNull()
    chair.click()
    expect(room.spawned().map((s) => s.itemId)).toEqual(['chair'])
    room.dispose()
  })

  it('takes a URL as the picture source as it is', () => {
    const { container, room } = open(withThumbnails())
    const sofa = [...container.querySelectorAll<HTMLElement>('.tr-item button.has-thumb')].find((b) => b.textContent !== 'Wooden chair') as HTMLElement
    expect(sofa).toBeDefined()
    expect(pictureOf(sofa)).toBe(`url("${URL_THUMB}")`)
    room.dispose()
  })

  it('shows the thumbnail in the search results too, with the group next to the name', () => {
    const { container, room } = open(withThumbnails())
    const search = container.querySelector('.tr-search') as HTMLInputElement
    search.value = 'chair'
    search.dispatchEvent(new Event('input'))
    const chair = buttonOf(container, 'Wooden chairFurniture')
    expect(chair).toBeDefined()
    expect(pictureOf(chair)).toContain('data:image/svg+xml')
    expect(chair.querySelector('small')).not.toBeNull()
    room.dispose()
  })

  it('cannot break out of the url() with a quote in the source', () => {
    const catalog = demoItems('en').map((item) => (item.id === 'chair' ? { ...item, thumbnail: 'a.svg") ; background:red;("' } : item))
    const { container, room } = open(catalog)
    const value = pictureOf(buttonOf(container, 'Wooden chair'))
    expect(value).toBe('url("a.svg%22) ; background:red;(%22")')
    room.dispose()
  })
})

describe('thumbnail of the aimed item', () => {
  it('goes to the inspector with the object and the part', () => {
    const { container, room } = open(withThumbnails())
    room.spawn('chair', [0, 0, -4], 0)
    room.look([0, 0.6, -2], [0, 0.45, -4])
    expect(room.inspectInfo()?.thumbnail).toBe(SVG)
    room.update(0.2)
    expect(container.querySelector('.tr-insp .tr-thumb')).not.toBeNull()
    room.dispose()
  })

  it('shows no picture for an item without one', () => {
    const { container, room } = open(withThumbnails())
    room.spawn('shelf', [0, 0, -4], 0)
    room.look([0, 0.6, -2], [0, 0.45, -4])
    room.update(0.2)
    expect(room.inspectInfo()?.thumbnail).toBeUndefined()
    expect(container.querySelector('.tr-insp .tr-thumb')).toBeNull()
    room.dispose()
  })
})

describe('thumbnail of a module item', () => {
  it('reaches the catalogue from TestableItem.thumbnail', () => {
    const mod: TestableModule = {
      id: 'thumb_module',
      name: 'Thumb module',
      group: 'Thumbs',
      items: () => [{ id: 'plank', name: 'Plank', thumbnail: SVG, build: (T: unknown) => new (T as typeof THREE).Group(), spec: { name: 'plank', parts: [{ id: 'body', material: 'wood_soft', shape: { kind: 'box', size: [1, 0.1, 0.2] }, position: [0, 0.05, 0] }], joints: [] } }],
    }
    const { container, room } = open(demoItems('en'))
    room.loadModule(mod)
    ;([...container.querySelectorAll('.tr-tabs button')].find((b) => b.textContent === 'Thumbs') as HTMLElement).click()
    const plank = buttonOf(container, 'Plank')
    expect(plank).toBeDefined()
    expect(pictureOf(plank)).toContain('data:image/svg+xml')
    room.dispose()
  })
})
