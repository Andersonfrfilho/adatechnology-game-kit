import { describe, expect, it } from 'vitest'
import type { EffectSink, HostEvent } from '@adatechnology/game-contracts'
import { makeRoom } from './helpers'
import type { TestRoom } from '../src'

const run = (room: TestRoom, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) room.update(1 / 60)
}

const spy = (room: TestRoom): { effects: EffectSink | undefined; explosions: HostEvent[] } => {
  const seen: { effects: EffectSink | undefined; explosions: HostEvent[] } = { effects: undefined, explosions: [] }
  room.loadModule({
    id: 'spy',
    name: 'spy',
    group: 'spy',
    items: () => [],
    attach: (host) => {
      seen.effects = host.effects
      return host.on((event) => event.type === 'explosion' && seen.explosions.push(event))
    },
  })
  return seen
}

const throwGrenade = (room: TestRoom): void => {
  room.setTool('frag_grenade')
  run(room, 0.5)
  room.look([0, 1.7, 5], [0, 0.6, -3])
  room.use()
  run(room, 6)
}

describe('the room lends one effects world', () => {
  it('gives every module the effects sink, and it plays the catalogue', () => {
    const room = makeRoom()
    const { effects } = spy(room)
    expect(effects).toBeDefined()
    expect(effects?.catalog?.()).toContain('m67')
    expect(effects?.play({ effect: 'm67', point: [0, 0.3, -3] })).not.toBeNull()
    expect(effects?.play({ effect: 'not_an_effect', point: [0, 0.3, -3] })).toBeNull()
  })

  it('plays the Workshop recipes by id and the weapon effects too', () => {
    const room = makeRoom()
    const { effects } = spy(room)
    expect(effects?.catalog?.()).toEqual(expect.arrayContaining(['blood_hit', 'muzzle_ak', 'casing_brass', 'impact_concrete']))
    expect(effects?.play({ effect: 'muzzle_ak', point: [0, 1.5, -2], direction: [0, 0, -1], seed: 3 })).not.toBeNull()
    expect(effects?.play({ effect: 'impact', point: [0, 1, -3], param: 'metal' })).not.toBeNull()
    run(room, 0.2)
  })

  it('draws the droplets and steam of the fluids in the same world', () => {
    const room = makeRoom()
    room.fluids.splash('water', [0, 0.01, -2], 0.2)
    run(room, 0.2)
    expect(room.metrics().room.particles).toBeGreaterThan(0)
  })

  it('draws a grenade with its own explosive profile and names the explosive on the host event', () => {
    const room = makeRoom()
    const { explosions } = spy(room)
    throwGrenade(room)
    expect(explosions).toMatchObject([{ type: 'explosion', cause: 'timer', explosive: 'm67' }])
    expect(room.metrics().room.particles).toBeGreaterThan(30)
  })

  it('counts the effects world in the particles metric', () => {
    const room = makeRoom()
    expect(room.metrics().room.particles).toBe(0)
    spy(room).effects?.play({ effect: 'm67', point: [0, 0.3, -3] })
    room.update(1 / 60)
    expect(room.metrics().room.particles).toBeGreaterThan(30)
  })

  it('shakes the camera for the render after an explosion and puts it back', () => {
    const room = makeRoom()
    room.look([0, 1.7, 5], [0, 0.6, -3])
    spy(room).effects?.play({ effect: 'm67', point: [0, 0.3, 3] })
    room.update(1 / 60)
    const before = room.camera.position.clone()
    const restore = room.applyCamera()
    const shaken = room.camera.position.distanceTo(before)
    restore()
    expect(room.camera.position.distanceTo(before)).toBe(0)
    expect(shaken).toBeGreaterThan(0)
  })

  it('puts the screen overlay in the container, once', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = makeRoom({ container })
    expect(container.children.length).toBeGreaterThan(1)
    room.dispose()
  })
})

describe('craters', () => {
  it('replace the floor with a patch that a big explosion digs into', () => {
    const room = makeRoom({ craters: true })
    const floor = room.scene.getObjectByName('floor')
    expect(floor?.visible).toBe(false)
    spy(room).effects?.play({ effect: 'm67', point: [0, 0.2, -3] })
    run(room, 0.1)
    const patch = room.scene.children.find((child) => child.type === 'Mesh' && (child as import('three').Mesh).geometry.type === 'PlaneGeometry')
    const heights = (patch as import('three').Mesh).geometry.attributes.position!
    let lowest = 0
    for (let index = 0; index < heights.count; index++) lowest = Math.min(lowest, heights.getY(index))
    expect(lowest).toBeLessThan(-0.05)
  })

  it('leave the floor alone by default', () => {
    expect(makeRoom().scene.getObjectByName('floor')?.visible).toBe(true)
  })
})

