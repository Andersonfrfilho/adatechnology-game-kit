import { describe, expect, it } from 'vitest'
import { genericWeapons } from '@adatechnology/game-weapons'
import * as THREE from 'three'
import { createTestRoom } from '../src'
import type { TestRoomItem } from '../src'
import { demoItems } from './fixtures/demo-items'
import { stubRenderer } from './helpers'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 20" fill="currentColor"><path d="M0 0H10V10Z"/></svg>'

const open = (catalog: TestRoomItem[] = demoItems('pt-BR'), extra: { toolMenu?: false } = {}) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'pt-BR', catalog, renderer: stubRenderer(), ui: true, ...extra })
  return { container, room }
}
const menuOf = (container: HTMLElement): HTMLElement => container.querySelector('[data-tool-menu]') as HTMLElement
const toolButtons = (container: HTMLElement): HTMLElement[] => [...menuOf(container).querySelectorAll<HTMLElement>('[data-tool]')]

describe('the weapon picker of the room', () => {
  it('opens with the key left of 1 and lists the whole arsenal by group, beyond the hotbar', () => {
    const { container, room } = open()
    expect(menuOf(container).classList.contains('open')).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }))
    expect(menuOf(container).classList.contains('open')).toBe(true)
    const tabs = [...menuOf(container).querySelectorAll<HTMLElement>('[data-group]')].map((tab) => tab.dataset.group)
    expect(tabs).toEqual(['firearms', 'melee', 'explosives', 'tools'])
    let listed = 0
    for (const tab of menuOf(container).querySelectorAll<HTMLElement>('[data-group]')) {
      tab.click()
      listed += toolButtons(container).length
    }
    expect(listed).toBe(room.arsenal.weapons.size - genericWeapons(room.arsenal).size)
    room.dispose()
  })

  it('equips the weapon picked, adds it to the hotbar and closes', () => {
    const { container, room } = open()
    expect(room.toggleToolMenu(true)).toBe(true)
    ;(menuOf(container).querySelector('[data-group="firearms"]') as HTMLElement).click()
    const glock = toolButtons(container).find((button) => button.dataset.tool === 'glock_17') as HTMLElement
    expect(glock).toBeDefined()
    glock.click()
    expect(room.tool.def.id).toBe('glock_17')
    expect(menuOf(container).classList.contains('open')).toBe(false)
    room.dispose()
  })

  it('finds a weapon in any group by name and shows the silhouette of the catalogue item that equips it', () => {
    const catalog = [...demoItems('pt-BR'), { id: 'weapon_m79', name: 'M79', group: 'Armas', weapon: 'm79', thumbnail: SVG, build: () => new THREE.Group() } as TestRoomItem]
    const { container, room } = open(catalog)
    room.toggleToolMenu(true)
    const search = menuOf(container).querySelector('.tr-search') as HTMLInputElement
    search.value = 'granadas m79'
    search.dispatchEvent(new Event('input'))
    const found = toolButtons(container)
    expect(found.map((button) => button.dataset.tool)).toEqual(['m79'])
    expect(found[0]?.querySelector('.tr-thumb')).not.toBeNull()
    room.dispose()
  })

  it('finds the weapons of a maker', () => {
    const { container, room } = open()
    room.toggleToolMenu(true)
    const search = menuOf(container).querySelector('.tr-search') as HTMLInputElement
    search.value = 'taurus'
    search.dispatchEvent(new Event('input'))
    const found = toolButtons(container).map((button) => button.dataset.tool)
    expect(found.length).toBeGreaterThan(1)
    expect(found.every((id) => room.arsenal.weapons.get(id ?? '')?.maker?.toLowerCase().includes('taurus') || (id ?? '').includes('taurus'))).toBe(true)
    room.dispose()
  })

  it('is left out with toolMenu: false', () => {
    const { container, room } = open(demoItems('pt-BR'), { toolMenu: false })
    expect(menuOf(container)).toBeNull()
    expect(room.toggleToolMenu()).toBe(false)
    room.dispose()
  })
})

describe('a weapon in each hand from the picker', () => {
  const pick = (container: HTMLElement, room: ReturnType<typeof open>['room'], id: string, shiftKey: boolean): void => {
    room.toggleToolMenu(true)
    const search = menuOf(container).querySelector('.tr-search') as HTMLInputElement
    search.value = id
    search.dispatchEvent(new Event('input'))
    const button = toolButtons(container).find((entry) => entry.dataset.tool === id) as HTMLElement
    expect(button, id).toBeDefined()
    button.dispatchEvent(new MouseEvent('click', { shiftKey, bubbles: true }))
  }

  it('Shift+click puts two of the weapon in the hands, a second Shift+click changes the left one, a plain click goes back to one', () => {
    const { container, room } = open()
    pick(container, room, 'glock_17', true)
    expect(room.tool.def.id).toBe('glock_17')
    expect(room.offTool?.def.id).toBe('glock_17')
    expect(room.offTool).not.toBe(room.tool)
    pick(container, room, 'mini_uzi', true)
    expect(room.tool.def.id).toBe('glock_17')
    expect(room.offTool?.def.id).toBe('mini_uzi')
    room.toggleToolMenu(true)
    ;(menuOf(container).querySelector('[data-group="firearms"]') as HTMLElement).click()
    expect((menuOf(container).querySelector('[data-left]') as HTMLElement | null)?.dataset.tool).toBe('mini_uzi')
    room.toggleToolMenu(false)
    pick(container, room, 'beretta_92fs', false)
    expect(room.tool.def.id).toBe('beretta_92fs')
    expect(room.offTool).toBeNull()
    room.dispose()
  })

  it('a rifle goes in the hands alone, Shift or not', () => {
    const { container, room } = open()
    pick(container, room, 'glock_17', true)
    pick(container, room, 'ak_47', true)
    expect(room.tool.def.id).toBe('ak_47')
    expect(room.offTool).toBeNull()
    room.dispose()
  })

  it('the left mouse button fires the right hand, the right button the left hand, each with its own magazine', async () => {
    const renderer = stubRenderer()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, locale: 'pt-BR', catalog: demoItems('pt-BR'), renderer, ui: true })
    room.setTool('glock_17')
    expect(room.setOffTool('glock_17')).toBe(true)
    for (let i = 0; i < 40; i++) room.update(1 / 60)
    room.look([0, 1.6, 2], [0, 1.2, -11])
    const dom = renderer.domElement
    // no pointer lock here: a press held past the drag delay is a pull of the trigger
    dom.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 300))
    room.update(1 / 60)
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }))
    for (let i = 0; i < 3; i++) room.update(1 / 60)
    expect(room.tool.ammo).toBe(room.tool.capacity - 1)
    expect(room.offTool!.ammo).toBe(room.offTool!.capacity)
    dom.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }))
    room.update(1 / 60)
    window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }))
    for (let i = 0; i < 3; i++) room.update(1 / 60)
    expect(room.offTool!.ammo).toBe(room.offTool!.capacity - 1)
    expect(room.tool.ammo).toBe(room.tool.capacity - 1)
    // with one weapon the right button grabs again: nothing fires
    room.setOffTool(null)
    const before = room.tool.ammo
    dom.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }))
    room.update(1 / 60)
    expect(room.tool.ammo).toBe(before)
    room.dispose()
  })
})
