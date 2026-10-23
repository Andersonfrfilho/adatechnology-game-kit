import { describe, expect, it } from 'vitest'
import type { ObjectSpec, WorldEvent } from '../src'
import { origin, run, world } from './fixtures'

const bottle: ObjectSpec = {
  type: 'bottle',
  parts: [{ id: 'valve', pivot: [0, 0.5, 0], motion: { kind: 'knob' }, label: 'prompt.valve' }],
  fuels: [{ id: 'gas', kind: 'gas', capacity: 13, valve: 'valve' }],
}
const stove: ObjectSpec = {
  type: 'stove',
  parts: [{ id: 'knob', pivot: [0, 0.9, 0.3], motion: { kind: 'knob' } }],
  burners: [{ id: 'b', pos: [0, 0.9, 0], fuel: 'auto', rate: 0.01, part: 'knob' }],
  emitters: [{ id: 'flame', kind: 'flame', pos: [0, 0.9, 0], source: 'b' }],
}
const grill: ObjectSpec = {
  type: 'grill',
  fuels: [{ id: 'coal', kind: 'charcoal', capacity: 2, level: 0.05 }],
  burners: [{ id: 'bed', pos: [0, 0.8, 0], fuel: 'coal', rate: 0.01, needsIgnition: true }],
  emitters: [
    { id: 'fire', kind: 'fire', pos: [0, 0.8, 0], source: 'bed' },
    { id: 'smoke', kind: 'smoke', pos: [0, 1, 0], source: 'bed' },
  ],
}

describe('fuel', () => {
  it('a closed bottle valve keeps the burner from lighting', () => {
    const { w, events } = world()
    w.add('bot', bottle, { x: 1, y: 0, z: 0, ry: 0 })
    w.add('st', stove, origin)
    w.act('st:burner.b')
    expect(w.isLit('st', 'b')).toBe(false)
    expect(events.some((e) => e.type === 'message' && e.key === 'no_gas')).toBe(true)
  })

  it('opening the valve first lights the burner and it burns fuel', () => {
    const { w } = world()
    w.add('bot', bottle, { x: 1, y: 0, z: 0, ry: 0 })
    w.add('st', stove, origin)
    w.act('bot:fuel.gas')
    expect(w.act('st:burner.b')).toBe(true)
    expect(w.isLit('st', 'b')).toBe(true)
    run(w, 10)
    expect(w.fuelLevel('bot', 'gas')).toBeCloseTo(13 - 0.1, 3)
  })

  it('a knob left open before the valve opens lights by itself when the valve opens', () => {
    const { w, events } = world()
    w.add('bot', bottle, { x: 1, y: 0, z: 0, ry: 0 })
    w.add('st', stove, origin)
    w.act('st:burner.b')
    run(w, 0.5)
    expect(w.isLit('st', 'b')).toBe(false)
    w.act('bot:fuel.gas')
    run(w, 0.1)
    expect(w.isLit('st', 'b')).toBe(true)
    expect(events.some((e) => e.type === 'burner' && e.burner === 'b' && e.lit)).toBe(true)
    expect(w.emitters().some((e) => e.id === 'st:flame')).toBe(true)
    run(w, 10)
    expect(w.fuelLevel('bot', 'gas')).toBeLessThan(13)
  })

  it('does not light by itself without fuel, after turning the knob off, or for a burner that needs ignition', () => {
    const { w } = world()
    w.add('bot', { ...bottle, fuels: [{ id: 'gas', kind: 'gas', capacity: 13, level: 0, valve: 'valve' }] }, { x: 1, y: 0, z: 0, ry: 0 })
    w.add('st', stove, origin)
    w.add('g', grill, { x: 5, y: 0, z: 0, ry: 0 })
    w.act('st:burner.b')
    w.act('bot:fuel.gas')
    run(w, 1)
    expect(w.isLit('st', 'b')).toBe(false)
    w.act('st:burner.b') // off
    w.setPart('bot', 'valve', 0, true)
    w.setPart('bot', 'valve', 1, true)
    run(w, 1)
    expect(w.isLit('st', 'b')).toBe(false)
    expect(w.isLit('g', 'bed')).toBe(false)
  })

  it('closing the valve puts the flame out', () => {
    const { w } = world()
    w.add('bot', bottle, { x: 1, y: 0, z: 0, ry: 0 })
    w.add('st', stove, origin)
    w.act('bot:fuel.gas')
    w.act('st:burner.b')
    w.act('bot:fuel.gas')
    run(w, 0.1)
    expect(w.isLit('st', 'b')).toBe(false)
  })

  it('turning the knob off extinguishes', () => {
    const { w } = world()
    w.add('bot', bottle, { x: 1, y: 0, z: 0, ry: 0 })
    w.add('st', stove, origin)
    w.act('bot:fuel.gas')
    w.act('st:burner.b')
    w.act('st:burner.b')
    expect(w.isLit('st', 'b')).toBe(false)
  })

  it('auto fuel ignores bottles farther than 2 m and picks the nearest', () => {
    const { w } = world()
    w.add('far', bottle, { x: 3, y: 0, z: 0, ry: 0 })
    w.add('st', stove, origin)
    w.setPart('far', 'valve', 1, true)
    w.act('st:burner.b')
    expect(w.isLit('st', 'b')).toBe(false)
    w.add('near', bottle, { x: 1.5, y: 0, z: 0, ry: 0 })
    w.setPart('near', 'valve', 1, true)
    w.act('st:burner.b')
    w.act('st:burner.b')
    expect(w.isLit('st', 'b')).toBe(true)
    run(w, 5)
    expect(w.fuelLevel('near', 'gas')).toBeLessThan(13)
    expect(w.fuelLevel('far', 'gas')).toBe(13)
  })

  it('running out of gas puts the flame out and emits an event', () => {
    const { w, events } = world()
    w.add('bot', { ...bottle, fuels: [{ id: 'gas', kind: 'gas', capacity: 13, level: 0.05, valve: 'valve' }] }, { x: 1, y: 0, z: 0, ry: 0 })
    w.add('st', stove, origin)
    w.setPart('bot', 'valve', 1, true)
    w.act('st:burner.b')
    expect(w.isLit('st', 'b')).toBe(true)
    run(w, 10)
    expect(w.isLit('st', 'b')).toBe(false)
    expect(w.fuelLevel('bot', 'gas')).toBe(0)
    expect(events.filter((e): e is Extract<WorldEvent, { type: 'burner' }> => e.type === 'burner').pop()?.lit).toBe(false)
    w.act('st:burner.b')
    w.act('st:burner.b')
    w.act('st:burner.b')
    expect(w.isLit('st', 'b')).toBe(false)
  })

  it('charcoal needs ignition, burns until empty, and toggle extinguishes', () => {
    const { w } = world()
    w.add('g', grill, origin)
    expect(w.act('g:burner.bed')).toBe(false)
    expect(w.act('g:ignite.bed')).toBe(true)
    expect(w.isLit('g', 'bed')).toBe(true)
    expect(w.act('g:ignite.bed')).toBe(false)
    expect(w.act('g:burner.bed')).toBe(true)
    expect(w.isLit('g', 'bed')).toBe(false)
    w.act('g:ignite.bed')
    run(w, 10)
    expect(w.fuelLevel('g', 'coal')).toBe(0)
    expect(w.isLit('g', 'bed')).toBe(false)
    expect(w.act('g:ignite.bed')).toBe(false)
  })

  it('target hides ignite while lit and the toggle while unlit', () => {
    const { w } = world()
    w.add('g', grill, origin)
    const eye = { x: 0, y: 0.8, z: 1, yaw: 0, pitch: 0 }
    expect(w.target(eye)?.id).toBe('g:ignite.bed')
    w.act('g:ignite.bed')
    expect(w.target(eye)?.id).toBe('g:burner.bed')
  })

  it('emitters follow the burner; charcoal smoke lingers 20 s and fades', () => {
    const { w } = world()
    w.add('g', grill, origin)
    expect(w.emitters()).toHaveLength(0)
    w.act('g:ignite.bed')
    expect(w.emitters().map((e) => e.kind).sort()).toEqual(['fire', 'smoke'])
    w.act('g:burner.bed')
    expect(w.emitters().map((e) => e.kind)).toEqual(['smoke'])
    const first = w.emitters()[0].intensity
    run(w, 10)
    const later = w.emitters()[0].intensity
    expect(later).toBeLessThan(first)
    expect(later).toBeGreaterThan(0)
    run(w, 11)
    expect(w.emitters()).toHaveLength(0)
  })

  it('gas flame emitter intensity drops with the fuel left', () => {
    const { w } = world()
    w.add('bot', bottle, { x: 1, y: 0, z: 0, ry: 0 })
    w.add('st', stove, origin)
    w.setPart('bot', 'valve', 1, true)
    w.act('st:burner.b')
    const full = w.emitters()[0].intensity
    run(w, 600)
    expect(w.emitters()[0].intensity).toBeLessThan(full)
  })
})

const tank: ObjectSpec = { type: 'tank', tanks: [{ id: 't', capacity: 100, level: 10, rainArea: 4 }] }
const bath: ObjectSpec = {
  type: 'bath',
  parts: [{ id: 'handle', pivot: [0, 1, 0], motion: { kind: 'knob' } }],
  fixtures: [
    { id: 'tap', kind: 'tap', outlet: [0, 1, 0], flow: 6, part: 'handle' },
    { id: 'wc', kind: 'flush', outlet: [0, 1, 0], volume: 6 },
  ],
  emitters: [{ id: 'water', kind: 'water', pos: [0, 1, 0], source: 'tap' }],
}

describe('water', () => {
  it('draws from the default tank (first tank) and stops flowing when dry', () => {
    const { w } = world()
    w.add('tk', tank, origin)
    w.add('b', bath, origin)
    w.act('b:fixture.tap')
    expect(w.water.isFlowing('b', 'tap')).toBe(true)
    run(w, 60)
    expect(w.water.level('tk:t')).toBeCloseTo(4, 1)
    run(w, 120)
    expect(w.water.level('tk:t')).toBe(0)
    expect(w.water.isFlowing('b', 'tap')).toBe(false)
    expect(w.emitters()).toHaveLength(0)
  })

  it('refill returns what fit, and a dry tap flows again after refilling', () => {
    const { w } = world()
    w.add('tk', tank, origin)
    w.add('b', bath, origin)
    expect(w.water.refill('tk:t', 500)).toBe(90)
    expect(w.water.level('tk:t')).toBe(100)
    expect(w.water.refill('nope:x', 5)).toBe(0)
  })

  it('opening a tap on an empty tank says no water and does not flow', () => {
    const { w, events } = world()
    w.add('tk', { type: 'tank', tanks: [{ id: 't', capacity: 10, level: 0 }] }, origin)
    w.add('b', bath, origin)
    w.act('b:fixture.tap')
    expect(w.water.isFlowing('b', 'tap')).toBe(false)
    expect(events.some((e) => e.type === 'message' && e.key === 'no_water')).toBe(true)
    // still "on" so a refill makes it flow
    w.water.refill('tk:t', 10)
    run(w, 1)
    expect(w.water.isFlowing('b', 'tap')).toBe(true)
  })

  it('no tank at all: not flowing', () => {
    const { w } = world()
    w.add('b', bath, origin)
    w.act('b:fixture.tap')
    expect(w.water.isFlowing('b', 'tap')).toBe(false)
  })

  it('setDefaultTank chooses the tank and null clears it', () => {
    const { w } = world()
    w.add('a', tank, origin)
    w.add('c', tank, origin)
    w.add('b', bath, origin)
    w.water.setDefaultTank('c:t')
    w.act('b:fixture.tap')
    run(w, 30)
    expect(w.water.level('c:t')).toBeLessThan(10)
    expect(w.water.level('a:t')).toBe(10)
    w.water.setDefaultTank(null)
    run(w, 1)
    expect(w.water.isFlowing('b', 'tap')).toBe(false)
  })

  it('explicit tank ids on fixtures work', () => {
    const { w } = world()
    w.add('a', tank, origin)
    w.add('c', tank, origin)
    w.add('b', { ...bath, fixtures: [{ id: 'tap', kind: 'tap', outlet: [0, 1, 0], tank: 'c:t' }] }, origin)
    w.act('b:fixture.tap')
    run(w, 10)
    expect(w.water.level('c:t')).toBeLessThan(10)
    expect(w.water.level('a:t')).toBe(10)
  })

  it('rain fills tanks with a rain area: mm/h * m2 / 3600 liters per second', () => {
    const { w } = world()
    w.add('tk', tank, origin)
    w.water.setRain(36)
    run(w, 100, 0.5)
    expect(w.water.level('tk:t')).toBeCloseTo(10 + 36 * 4 / 3600 * 100, 1)
    w.water.setRain(0)
    const level = w.water.level('tk:t')
    run(w, 10)
    expect(w.water.level('tk:t')).toBe(level)
  })

  it('rain option at creation and capacity clamp', () => {
    const { w } = world({ rain: 1000 })
    w.add('tk', tank, origin)
    run(w, 100)
    expect(w.water.level('tk:t')).toBe(100)
  })

  it('an external waterSupply replaces the tanks', () => {
    const drawn: Array<[string, number]> = []
    let dry = false
    const { w } = world({ waterSupply: { draw: (id, l) => { drawn.push([id, l]); return dry ? 0 : l } } })
    w.add('tk', tank, origin)
    w.add('b', bath, origin)
    w.act('b:fixture.tap')
    run(w, 1)
    expect(w.water.isFlowing('b', 'tap')).toBe(true)
    expect(drawn[0][0]).toBe('b:tap')
    expect(w.water.level('tk:t')).toBe(10)
    dry = true
    run(w, 0.1)
    expect(w.water.isFlowing('b', 'tap')).toBe(false)
  })

  it('external waterSupply returning 0 from the start: not flowing', () => {
    const { w, events } = world({ waterSupply: { draw: () => 0 } })
    w.add('tk', tank, origin)
    w.add('b', bath, origin)
    w.act('b:fixture.tap')
    run(w, 1)
    expect(w.water.isFlowing('b', 'tap')).toBe(false)
    expect(events.some((e) => e.type === 'message' && e.key === 'no_water')).toBe(true)
  })

  it('flush draws its volume once and stops by itself', () => {
    const { w } = world()
    w.add('tk', tank, origin)
    w.add('b', bath, origin)
    w.act('b:fixture.wc')
    expect(w.water.isFlowing('b', 'wc')).toBe(true)
    expect(w.water.level('tk:t')).toBeCloseTo(4)
    run(w, 3)
    expect(w.water.isFlowing('b', 'wc')).toBe(false)
    expect(w.water.level('tk:t')).toBeCloseTo(4)
  })

  it('flush with not enough water: partial, then nothing', () => {
    const { w } = world()
    w.add('tk', { type: 'tank', tanks: [{ id: 't', capacity: 10, level: 3 }] }, origin)
    w.add('b', bath, origin)
    w.act('b:fixture.wc')
    expect(w.water.level('tk:t')).toBe(0)
    run(w, 3)
    w.act('b:fixture.wc')
    expect(w.water.isFlowing('b', 'wc')).toBe(false)
  })

  it('the water emitter is active only while flowing', () => {
    const { w } = world()
    w.add('tk', tank, origin)
    w.add('b', bath, origin)
    expect(w.emitters()).toHaveLength(0)
    w.act('b:fixture.tap')
    expect(w.emitters()[0]).toMatchObject({ kind: 'water', id: 'b:water' })
    w.act('b:fixture.tap')
    expect(w.emitters()).toHaveLength(0)
  })
})
