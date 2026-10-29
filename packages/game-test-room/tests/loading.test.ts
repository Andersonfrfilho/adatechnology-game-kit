import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import type { TestableModule } from '@adatechnology/game-contracts'

import { createLoading, createTestRoom, LOADING_CSS, loadingMarkup } from '../src'
import { demoItems } from './fixtures/demo-items'
import { stubRenderer } from './helpers'

const box = (): HTMLElement => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

describe('the loading indicator', () => {
  it('shows a card with the label and the text while a task is open, a bar when it has a total, and goes away with the last task', () => {
    const container = box()
    const loading = createLoading({ container, working: 'Working…' })
    expect(loading.active).toBe(false)
    expect(container.querySelector('.tr-loading')).toBeNull()
    const task = loading.begin('Building the house', { total: 4 })
    const card = container.querySelector('.tr-loading') as HTMLElement
    expect(loading.active).toBe(true)
    expect(card.classList.contains('tr-loading-hidden')).toBe(false)
    expect(card.querySelector('.tr-loading-label')!.textContent).toBe('Building the house')
    expect(card.querySelector('.tr-loading-step')!.textContent).toBe('Working…')
    task.step('walls', 1)
    expect(card.querySelector('.tr-loading-step')!.textContent).toBe('walls')
    expect((card.querySelector('.tr-loading-bar i') as HTMLElement).style.width).toBe('25%')
    expect(card.querySelector('.tr-loading-bar')!.classList.contains('tr-loading-indeterminate')).toBe(false)
    const inner = loading.begin('Furniture')
    expect(loading.state()).toMatchObject({ label: 'Furniture', depth: 2 })
    expect(card.querySelector('.tr-loading-bar')!.classList.contains('tr-loading-indeterminate')).toBe(true)
    inner.end()
    expect(loading.state()).toMatchObject({ label: 'Building the house', depth: 1, done: 1, total: 4 })
    task.end()
    task.end()
    expect(loading.active).toBe(false)
    expect(loading.state()).toBeUndefined()
    expect(card.classList.contains('tr-loading-hidden')).toBe(true)
    loading.dispose()
    expect(container.querySelector('.tr-loading')).toBeNull()
  })

  it('draws nothing for a room without a UI, and still tells the state to whoever follows it', () => {
    const container = box()
    const loading = createLoading({ container, draw: false, working: 'Working…' })
    const seen: Array<string | undefined> = []
    const stop = loading.on((state) => seen.push(state?.label))
    const task = loading.begin('Laying the district')
    task.end()
    stop()
    loading.begin('ignored').end()
    expect(seen).toEqual(['Laying the district', undefined])
    expect(container.querySelector('.tr-loading')).toBeNull()
    expect(loading.element).toBeUndefined()
  })

  it('busy shows the indicator, lets it be painted, then runs the work; it hides it after, and when the work throws', async () => {
    const container = box()
    const loading = createLoading({ container, working: 'Working…' })
    const order: string[] = []
    const pending = loading.busy('Heavy', (task) => {
      order.push(`work (shown: ${loading.active}, label: ${container.querySelector('.tr-loading-label')?.textContent})`)
      task.step('half', 1)
      return 42
    })
    order.push('called')
    expect(loading.active).toBe(true)
    expect(await pending).toBe(42)
    expect(order).toEqual(['called', 'work (shown: true, label: Heavy)'])
    expect(loading.active).toBe(false)
    await expect(loading.busy('Broken', () => { throw new Error('boom') })).rejects.toThrow('boom')
    expect(loading.active).toBe(false)
    await expect(loading.busy('Async', async () => 'ok')).resolves.toBe('ok')
  })

  it('writes the same card as markup for a page that shows it before any script runs', () => {
    const markup = loadingMarkup({ title: 'Loading <room>', step: 'Starting…', solid: true, fixed: true, id: 'boot' })
    expect(markup).toContain('id="boot"')
    expect(markup).toContain('tr-loading tr-loading-solid tr-loading-fixed')
    expect(markup).toContain('Loading &lt;room&gt;')
    expect(LOADING_CSS).toContain('.tr-loading-card')
    const holder = box()
    holder.innerHTML = markup
    expect(holder.querySelector('.tr-loading-label')!.textContent).toBe('Loading <room>')
  })
})

describe('the loading indicator in the room', () => {
  const roomOf = (locale: string, ui: boolean, container = box()) => ({ container, room: createTestRoom({ THREE, container, locale, catalog: demoItems(locale), renderer: stubRenderer(), ui }) })

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
    const room = createTestRoom({ THREE, container, locale: 'pt-BR', catalog: [], renderer: stubRenderer(), ui: true })
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

  it('idle() resolves at once when nothing is open, and when the last task ends otherwise', async () => {
    const loading = createLoading({ container: box(), working: 'Working…' })
    await loading.idle()
    const outer = loading.begin('Outer')
    const inner = loading.begin('Inner')
    let woke = false
    const waiting = loading.idle().then(() => (woke = true))
    inner.end()
    await Promise.resolve()
    expect(woke).toBe(false)
    outer.end()
    await waiting
    expect(woke).toBe(true)
    loading.dispose()
  })

  it('an opaque task hides the room behind it, and the others dim it', () => {
    const container = box()
    const loading = createLoading({ container, working: 'Working…' })
    const first = loading.begin('First load', { opaque: true })
    const card = container.querySelector('.tr-loading') as HTMLElement
    expect(card.classList.contains('tr-loading-solid')).toBe(true)
    const later = loading.begin('Later')
    expect(card.classList.contains('tr-loading-solid')).toBe(false)
    later.end()
    expect(card.classList.contains('tr-loading-solid')).toBe(true)
    first.end()
    loading.dispose()
  })
})
