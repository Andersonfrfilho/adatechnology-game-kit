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
