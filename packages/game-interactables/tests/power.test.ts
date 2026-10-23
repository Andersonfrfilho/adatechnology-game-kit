import { describe, expect, it } from 'vitest'
import type { ObjectSpec, WorldEvent } from '../src'
import { origin, world } from './fixtures'

const tvStand: ObjectSpec = {
  type: 'tv',
  parts: [{ id: 'button', pivot: [0, 1, 0], motion: { kind: 'rocker' } }],
  devices: [{ id: 'tv', kind: 'screen', watts: 80, socket: 'auto', plug: [0, 0, -0.1], part: 'button', channels: 3 }],
}
const wall = (id: string, circuit?: string): ObjectSpec => ({ type: 'wall', sockets: [{ id, pos: [0, 0.3, 0], circuit }] })
const lamp: ObjectSpec = { type: 'lamp', devices: [{ id: 'bulb', kind: 'lamp', watts: 10, circuit: 'lights' }] }
const switchPanel: ObjectSpec = {
  type: 'switch',
  parts: [{ id: 'rocker', pivot: [0, 1.2, 0], motion: { kind: 'rocker' } }],
  switches: [{ id: 'sw', part: 'rocker', controls: ['lamp1:bulb', 'lamp2:bulb'] }],
}

describe('power', () => {
  it('auto-plugs into the nearest free socket within 2 m', () => {
    const { w } = world()
    w.add('far', wall('s'), { x: 5, y: 0, z: 0, ry: 0 })
    w.add('near', wall('s'), { x: 1, y: 0, z: 0, ry: 0 })
    w.add('tv', tvStand, origin)
    expect(w.power.pluggedInto('tv', 'tv')).toBe('near:s')
  })

  it('does not plug into a socket farther than 2 m or one already used', () => {
    const { w } = world()
    w.add('s1', wall('s'), { x: 1, y: 0, z: 0, ry: 0 })
    w.add('tv1', tvStand, origin)
    w.add('tv2', tvStand, { x: 0.2, y: 0, z: 0, ry: 0 })
    expect(w.power.pluggedInto('tv1', 'tv')).toBe('s1:s')
    expect(w.power.pluggedInto('tv2', 'tv')).toBeNull()
    w.add('lonely', tvStand, { x: 50, y: 0, z: 0, ry: 0 })
    expect(w.power.pluggedInto('lonely', 'tv')).toBeNull()
  })

  it('explicit socket ids (world-wide) are honoured', () => {
    const { w } = world()
    w.add('w1', wall('a'), origin)
    w.add('tv', { type: 'tv', devices: [{ id: 'tv', kind: 'screen', watts: 1, socket: 'w1:a' }] }, { x: 9, y: 0, z: 9, ry: 0 })
    expect(w.power.pluggedInto('tv', 'tv')).toBe('w1:a')
    expect(w.power.isPowered('tv', 'tv')).toBe(true)
  })

  it('grid off means unpowered, and a message when switched on', () => {
    const { w, events } = world()
    w.add('wall', wall('s'), origin)
    w.add('tv', tvStand, origin)
    expect(w.power.isPowered('tv', 'tv')).toBe(true)
    w.power.setGrid(false)
    expect(w.power.grid).toBe(false)
    expect(w.power.isPowered('tv', 'tv')).toBe(false)
    expect(w.act('tv:device.tv')).toBe(true)
    expect(w.power.isOn('tv', 'tv')).toBe(true)
    const dev = events.filter((e): e is Extract<WorldEvent, { type: 'device' }> => e.type === 'device').pop()
    expect(dev).toMatchObject({ on: true, powered: false })
    expect(events.some((e) => e.type === 'message' && e.key === 'no_power')).toBe(true)
  })

  it('restoring the grid powers the device again and emits events', () => {
    const { w, events } = world()
    w.add('wall', wall('s'), origin)
    w.add('tv', tvStand, origin)
    w.act('tv:device.tv')
    w.power.setGrid(false)
    events.length = 0
    w.power.setGrid(true)
    expect(events.some((e) => e.type === 'power' && e.grid)).toBe(true)
    expect(events.some((e) => e.type === 'device' && e.powered && e.on)).toBe(true)
  })

  it('circuit breakers cut sockets and hard-wired devices', () => {
    const { w } = world()
    w.add('wall', wall('s', 'kitchen'), origin)
    w.add('tv', tvStand, origin)
    w.add('lamp1', lamp, origin)
    expect(w.power.breaker('kitchen')).toBe(true)
    w.power.setBreaker('kitchen', false)
    expect(w.power.breaker('kitchen')).toBe(false)
    expect(w.power.isPowered('tv', 'tv')).toBe(false)
    expect(w.power.isPowered('lamp1', 'bulb')).toBe(true)
    w.power.setBreaker('lights', false)
    expect(w.power.isPowered('lamp1', 'bulb')).toBe(false)
  })

  it('a socket-less device with a socket field is unpowered', () => {
    const { w } = world()
    w.add('tv', tvStand, origin)
    expect(w.power.isPowered('tv', 'tv')).toBe(false)
  })

  it('non electric devices are always powered', () => {
    const { w } = world()
    w.add('t', { type: 't', devices: [{ id: 'torch', kind: 'lamp', watts: 0, electric: false }] }, origin)
    w.power.setGrid(false)
    expect(w.power.isPowered('t', 'torch')).toBe(true)
  })

  it('switch toggles the listed lamps by world-wide id and moves the rocker', () => {
    const { w, events } = world()
    w.add('lamp1', lamp, origin)
    w.add('lamp2', lamp, origin)
    w.add('panel', switchPanel, origin)
    expect(w.act('panel:switch.sw')).toBe(true)
    expect(w.power.isOn('lamp1', 'bulb')).toBe(true)
    expect(w.power.isOn('lamp2', 'bulb')).toBe(true)
    expect(events.some((e) => e.type === 'switch' && e.on)).toBe(true)
    w.update(1)
    expect(w.partT('panel', 'rocker')).toBe(1)
    w.act('panel:switch.sw')
    expect(w.power.isOn('lamp1', 'bulb')).toBe(false)
  })

  it('a switch with local ids toggles lamps of its own object', () => {
    const { w } = world()
    w.add('room', { type: 'room', devices: [{ id: 'l', kind: 'lamp', watts: 5, circuit: 'x' }], switches: [{ id: 'sw', controls: ['l'] }] }, origin)
    w.act('room:switch.sw')
    expect(w.power.isOn('room', 'l')).toBe(true)
    w.act('room:switch.sw')
    expect(w.power.isOn('room', 'l')).toBe(false)
  })

  it('switching lamps on without power warns', () => {
    const { w, events } = world()
    w.add('lamp1', lamp, origin)
    w.add('lamp2', lamp, origin)
    w.add('panel', switchPanel, origin)
    w.power.setBreaker('lights', false)
    w.act('panel:switch.sw')
    expect(events.some((e) => e.type === 'message' && e.key === 'no_power')).toBe(true)
  })

  it('screens cycle channels only when on and powered', () => {
    const { w } = world()
    w.add('wall', wall('s'), origin)
    w.add('tv', tvStand, origin)
    expect(w.act('tv:channel.tv')).toBe(false)
    w.act('tv:device.tv')
    expect(w.act('tv:channel.tv')).toBe(true)
    expect(w.power.channel('tv', 'tv')).toBe(1)
    w.act('tv:channel.tv')
    w.act('tv:channel.tv')
    expect(w.power.channel('tv', 'tv')).toBe(0)
    w.power.setGrid(false)
    expect(w.act('tv:channel.tv')).toBe(false)
  })

  it('device with on:true starts on and shows the part', () => {
    const { w } = world()
    w.add('l', { type: 'l', parts: [{ id: 'p', pivot: [0, 0, 0], motion: { kind: 'rocker' } }], devices: [{ id: 'd', kind: 'lamp', watts: 1, circuit: 'c', on: true, part: 'p' }] }, origin)
    expect(w.power.isOn('l', 'd')).toBe(true)
    expect(w.partT('l', 'p')).toBe(1)
  })

  it('unknown device queries are false/zero', () => {
    const { w } = world()
    expect(w.power.isOn('x', 'y')).toBe(false)
    expect(w.power.isPowered('x', 'y')).toBe(false)
    expect(w.power.pluggedInto('x', 'y')).toBeNull()
    expect(w.power.channel('x', 'y')).toBe(0)
  })
})
