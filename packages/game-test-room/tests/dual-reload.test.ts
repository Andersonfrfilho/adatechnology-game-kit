import { describe, expect, it } from 'vitest'
import type { HostEvent, ToolHand } from '@adatechnology/game-contracts'
import { createDualReload } from '../src/dual-reload'
import { makeRoom } from './helpers'

describe('the magazine change with a tool in each hand', () => {
  it('tucks the other weapon, reloads, draws it back, then the same the other way round', () => {
    const log: string[] = []
    const reloading: Record<ToolHand, number> = { R: 0, L: 0 }
    const reload = createDualReload(
      {
        needs: () => true,
        startReload: (hand) => {
          reloading[hand] = 1
          log.push(`reload ${hand}`)
          return true
        },
        reloading: (hand) => reloading[hand] > 0,
        stow: (hand, on) => log.push(`${on ? 'stow' : 'draw'} ${hand}`),
      },
      () => 0.4,
    )
    reload.start(['R', 'L'])
    expect(reload.stowed('L')).toBe(true)
    expect(reload.stowed('R')).toBe(false)
    reload.step(0.5)
    expect(log).toEqual(['stow L', 'reload R'])
    reloading.R = 0
    reload.step(0.1)
    expect(reload.stowed('L')).toBe(false)
    reload.step(0.5)
    expect(reload.stowed('R')).toBe(true)
    reload.step(0.5)
    reloading.L = 0
    reload.step(0.1)
    reload.step(0.5)
    expect(log).toEqual(['stow L', 'reload R', 'draw L', 'stow R', 'reload L', 'draw R'])
    expect(reload.busy).toBe(false)
  })

  it('in the room: neither weapon fires while a hand works a magazine, and both end full', () => {
    const room = makeRoom()
    const events: HostEvent[] = []
    room.loadModule({ id: 'spy', name: 'Spy', group: 'Test', items: () => [], attach: (host) => host.on((event) => void events.push(event)) })
    room.setTool('glock_17')
    expect(room.setOffTool('glock_17')).toBe(true)
    for (let i = 0; i < 40; i++) room.update(1 / 60)
    room.look([0, 1.6, 2], [0, 1.2, -11])
    expect(room.use()).toBe('ok')
    room.update(0.2)
    expect(room.useOff()).toBe('ok')
    room.reload()
    room.update(1 / 60)
    const stows = (): Extract<HostEvent, { type: 'stow' }>[] => events.filter((event): event is Extract<HostEvent, { type: 'stow' }> => event.type === 'stow')
    expect(stows().at(-1)).toMatchObject({ type: 'stow', weapon: 'glock_17', on: true, hand: 'L' })
    // the right hand's gun waits for the left hand; the tucked one cannot fire
    expect(room.use()).toBe('reloading')
    expect(room.useOff()).toBe('reloading')
    for (let i = 0; i < 60 * 8; i++) room.update(1 / 60)
    expect(stows().map((event) => `${event.on ? 'stow' : 'draw'} ${event.hand ?? 'R'}`)).toEqual(['stow L', 'draw L', 'stow R', 'draw R'])
    expect(room.tool.ammo).toBe(room.tool.capacity)
    expect(room.offTool!.ammo).toBe(room.offTool!.capacity)
    expect(room.use()).toBe('ok')
    room.dispose()
  })

  it('Q and B act on the weapon of the hand that fired last; X clears the stuck one', () => {
    const room = makeRoom()
    room.setTool('glock_18')
    expect(room.setOffTool('glock_18')).toBe(true)
    for (let i = 0; i < 40; i++) room.update(1 / 60)
    room.look([0, 1.6, 2], [0, 1.2, -11])
    expect(room.useOff()).toBe('ok')
    const rightMode = room.tool.mode
    const leftMode = room.offTool!.mode
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }))
    expect(room.tool.mode).toBe(rightMode)
    expect(room.offTool!.mode).not.toBe(leftMode)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }))
    expect(room.offTool!.safety).toBe(true)
    expect(room.tool.safety).toBe(false)
    room.update(0.5)
    expect(room.use()).toBe('ok')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }))
    expect(room.tool.safety).toBe(true)
    room.dispose()
  })
})
