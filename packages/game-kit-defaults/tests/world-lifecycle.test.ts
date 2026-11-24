// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { KitWorld } from '../src/world'
import { makeWorld } from './world-helpers'

const worlds: KitWorld[] = []
const track = async (promise: Promise<KitWorld>): Promise<KitWorld> => {
  const world = await promise
  worlds.push(world)
  return world
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const world of worlds.splice(0)) world.dispose()
})

describe('the loop', () => {
  it('starts, stops and starts again, drawing from one set of systems', async () => {
    const world = await track(makeWorld())
    const stop = world.start({ render: true })
    expect(world.frame.systems().filter((system) => system.id === 'room.render')).toHaveLength(1)
    stop()
    stop()
    const again = world.start({ render: true })
    expect(again).not.toBe(stop)
    expect(world.frame.systems().filter((system) => system.id === 'room.render')).toHaveLength(1)
    expect(world.frame.systems().filter((system) => system.id === 'room.lights-check')).toHaveLength(1)
    again()
    expect(world.start({ render: true })).toBeTypeOf('function')
  })

  it('answers a second start while the loop runs with the same stop', async () => {
    const world = await track(makeWorld())
    const stop = world.start({ render: false })
    expect(world.start({ render: false })).toBe(stop)
    stop()
  })
})

describe('the systems', () => {
  it('forgets a system that was removed, in the list too', async () => {
    const world = await track(makeWorld())
    const before = world.frame.systems().length
    const remove = world.frame.add(() => undefined, { phase: 'lateSimulate', id: 'game.thing' })
    expect(world.frame.systems().map((system) => system.id)).toContain('game.thing')
    remove()
    remove()
    expect(world.frame.systems().map((system) => system.id)).not.toContain('game.thing')
    expect(world.frame.systems()).toHaveLength(before)
  })
})

describe('the sound preload', () => {
  it('takes its first-key listeners off the window when the world is disposed', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ sounds: [] }) }))
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    const world = await track(makeWorld({ audio: { samplesBaseUrl: './sfx/', userSamplesBaseUrl: null } }))
    await vi.waitFor(() => expect(added.mock.calls.some(([type]) => type === 'keydown')).toBe(true), { timeout: 3000 })
    world.dispose()
    expect(removed.mock.calls.some(([type]) => type === 'keydown')).toBe(true)
    expect(removed.mock.calls.some(([type]) => type === 'pointerdown')).toBe(true)
  })
})
