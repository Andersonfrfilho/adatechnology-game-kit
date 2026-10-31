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

describe('the floor', () => {
  it('is there by default', () => {
    expect(makeRoom().scene.getObjectByName('floor')).toBeTruthy()
  })

  it('is a terrain a blast digs: the ground under the point goes down and the player walks into it', () => {
    const room = makeRoom({ ground: { surface: 'dirt' } })
    expect(room.scene.getObjectByName('floor')).toBeTruthy()
    room.world.explode([0, 0.2, -3], 800_000, 8, 'test')
    run(room, 0.1)
    expect(room.terrain.heightAt(0, -3)).toBeLessThan(-0.1)
    room.look([0, 1.7, -3], [0, 1.7, -6])
    const level = room.camera.position.y
    run(room, 0.1)
    expect(room.camera.position.y).toBeLessThanOrEqual(level)
  })
})


describe('the room runs the film of the liquids that have one', () => {
  it('a punctured can of fuel drips into a film grid on the floor, and clearing the room frees it', () => {
    const room = makeRoom()
    const fluids = room.fluids
    fluids.addContainer({ capacity: 18, liquid: 'fuel', liters: 10, shape: { kind: 'box', size: [0.3, 0.4, 0.15] }, opening: 0.02, closed: true }, { id: 'film_can', position: [0, 0.5, -2] })
    fluids.puncture('film_can', [0.15, 0.2, -2], [1, 0, 0], 0.004)
    for (let i = 0; i < 180; i++) room.update(1 / 60)
    expect(room.scene.getObjectByName('film_grid')).toBeDefined()
    room.clear()
    expect(room.scene.getObjectByName('film_grid')).toBeUndefined()
    room.dispose()
  })

  it('lends the film bridge to the modules: a tinted splat of blood makes a grid in those colours', () => {
    const room = makeRoom()
    expect(room.film.splat({ fluid: 'blood', point: [0, 0.8, -2], count: 2, tint: { fresh: 0x8a0a0a, dry: 0x3b1d14 } })).toBe(2)
    for (let i = 0; i < 30; i++) room.update(1 / 60)
    expect(room.scene.getObjectByName('film_grid')).toBeDefined()
    room.dispose()
  })
})
