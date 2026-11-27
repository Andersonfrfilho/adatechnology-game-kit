import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import type { TestableModule } from '@adatechnology/game-contracts'

import { createTestRoom } from '../src'
import { demoItems } from './fixtures/demo-items'
import { stubRenderer } from './helpers'
import { roomPhysics } from './support/room-physics'

const box = (): HTMLElement => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

describe('the loading indicator in the room', () => {
  const roomOf = (locale: string, ui: boolean, container = box()) => ({ container, room: createTestRoom({ physics: roomPhysics(), THREE, container, locale, catalog: demoItems(locale), renderer: stubRenderer(), ui }) })

  it('openAreaAsync shows "Opening <area>" in the locale of the room while the area is laid, then takes it down', async () => {
    for (const [locale, text] of [['en', 'Opening Furniture…'], ['pt-BR', 'Abrindo Móveis…']] as const) {
      const { container, room } = roomOf(locale, true)
      const labels: string[] = []
      room.loading.on((state) => state && labels.push(state.label))
      const spawned = await room.openAreaAsync('furniture')
      expect(labels[0]).toBe(text)
      expect(spawned.length).toBeGreaterThan(0)
      expect(room.loading.active).toBe(false)
      expect(container.querySelector('.tr-loading')).not.toBeNull()
      room.dispose()
    }
  })

  it('draws no overlay when ui is false; room.busy works all the same', async () => {
    const { container, room } = roomOf('en', false)
    const states: string[] = []
    room.loading.on((state) => state && states.push(state.label))
    await room.busy('Slow thing', () => undefined)
    expect(states).toEqual(['Slow thing'])
    expect(container.querySelector('.tr-loading')).toBeNull()
    room.dispose()
  })

  it('lends the indicator to modules as host.loading, and a control a module declares slow runs behind it when the panel presses it', async () => {
    const { container, room } = roomOf('en', true)
    let busy: unknown
    const ran: string[] = []
    const module: TestableModule = {
      id: 'slow_module',
      name: 'Slow module',
      group: 'Slow',
      items: () => [],
      controls: () => [
        { kind: 'action', id: 'build', name: 'Build', slow: 'Building the house…' },
        { kind: 'action', id: 'quick', name: 'Quick' },
      ],
      attach: (host) => {
        busy = host.loading
        host.bench?.onChange((change) => {
          if (change.kind === 'action') ran.push(`${change.id}:${room.loading.active}`)
        })
        return () => undefined
      },
    }
    room.loadModule(module)
    expect(busy).toBe(room.loading)
    const press = (name: string): void => ([...container.querySelectorAll('.tr-bench button')].find((b) => b.textContent === name) as HTMLButtonElement).click()
    press('Quick')
    expect(ran).toEqual(['quick:false'])
    const labels: string[] = []
    room.loading.on((state) => state && labels.push(state.label))
    press('Build')
    expect(ran).toEqual(['quick:false'])
    await vi.waitFor(() => expect(ran).toEqual(['quick:false', 'build:true']))
    expect(labels).toEqual(['Building the house…'])
    await vi.waitFor(() => expect(room.loading.active).toBe(false))
    // a change made through the bench handle runs at once, behind no indicator
    room.bench('slow_module')!.act('build')
    expect(ran[2]).toBe('build:false')
    room.dispose()
  })

  it('spawns an item that declares itself slow behind the indicator, with its name, and any other at once', async () => {
    const container = box()
    const room = createTestRoom({ physics: roomPhysics(), THREE, container, locale: 'pt-BR', catalog: [], renderer: stubRenderer(), ui: true })
    const plain = (id: string, name: string, slow?: boolean) => ({ id, name, group: 'Veículos', movable: false, ...(slow ? { slow } : {}), build: () => new THREE.Group() })
    room.loadModule({ id: 'fleet', name: 'Frota', group: 'Veículos', items: () => [plain('fast_car', 'Carro rápido'), plain('heavy_bus', 'Ônibus', true)] })
    const click = (name: string): void => ([...container.querySelectorAll('.tr-item button')].find((b) => b.textContent?.includes(name)) as HTMLButtonElement).click()
    const labels: string[] = []
    room.loading.on((state) => state && labels.push(state.label))
    click('Carro rápido')
    expect(room.spawned().map((o) => o.itemId)).toEqual(['fast_car'])
    click('Ônibus')
    expect(room.spawned().map((o) => o.itemId)).toEqual(['fast_car'])
    await vi.waitFor(() => expect(room.spawned().map((o) => o.itemId)).toEqual(['fast_car', 'heavy_bus']))
    expect(labels).toEqual(['Montando Ônibus…'])
    room.dispose()
  })
})
