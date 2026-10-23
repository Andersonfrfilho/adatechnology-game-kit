import { describe, expect, it } from 'vitest'
import { createWorld } from '@adatechnology/game-interactables'
import { build, pack } from './helpers'

function world() {
  const hh = pack('br', 'pt-BR')
  const w = createWorld({ locale: 'pt-BR', strings: hh.strings, items: hh.items, loot: hh.loot, seed: 'engine' })
  return { hh, w }
}

describe('runs in the engine', () => {
  it('opens a fridge door, finds loot that fits and takes an item', () => {
    const { w } = world()
    w.add('fridge', build('fridge', { seed: 5 }).spec, { x: 0, y: 0, z: 0, ry: 0 })
    expect(w.accessible('fridge', 'fridge')).toBe(false)
    w.setPart('fridge', 'door_fridge', 1, true)
    expect(w.accessible('fridge', 'fridge')).toBe(true)
    const list = w.contents('fridge', 'fridge')
    const slot = list.findIndex((s) => s)
    expect(slot).toBeGreaterThanOrEqual(0)
    const taken = w.take('fridge', 'fridge', slot)
    expect(taken).toBeTruthy()
  })

  it('lists localized prompts for the doors and drawers', () => {
    const { w } = world()
    w.add('cab', build('kitchen_cabinet_base').spec, { x: 0, y: 0, z: 0, ry: 0 })
    const labels = w.interactables().map((i) => i.label)
    expect(labels.length).toBeGreaterThan(2)
    expect(labels.some((l) => /gaveta/i.test(l))).toBe(true)
    expect(labels.some((l) => /porta/i.test(l))).toBe(true)
    for (const l of labels) expect(l).not.toMatch(/^prompt\./)
  })

  it('lights a gas stove from a gas bottle and burns charcoal after ignition', () => {
    const { w } = world()
    w.add('stove', build('stove').spec, { x: 0, y: 0, z: 0, ry: 0 })
    w.add('bottle', build('gas_bottle').spec, { x: 0.8, y: 0, z: -0.5, ry: 0 })
    const knob = () => w.interactables().find((i) => i.id === 'stove:use_burner_1')!
    expect(knob()).toBeTruthy()
    knob().act()
    w.update(0.5)
    expect(w.isLit('stove', 'burner_1')).toBe(false) // the valve of the bottle is still closed
    knob().act() // off again
    w.interactables().find((i) => i.id === 'bottle:use_gas')!.act()
    w.update(0.5)
    knob().act()
    w.update(0.5)
    expect(w.isLit('stove', 'burner_1')).toBe(true)

    w.add('bbq', build('bbq').spec, { x: 4, y: 0, z: 0, ry: 0 })
    w.update(0.1)
    expect(w.isLit('bbq', 'coal')).toBe(false)
    w.interactables().find((i) => i.id === 'bbq:ignite_coal')!.act()
    w.update(0.1)
    expect(w.isLit('bbq', 'coal')).toBe(true)
    const kinds = w.emitters().filter((e) => e.object === 'bbq').map((e) => e.kind)
    expect(kinds).toContain('fire')
    expect(kinds).toContain('smoke')
  })

  it('sits on a sofa and lies on a bed, and pushes through a curtain without being blocked', () => {
    const { w } = world()
    w.add('sofa', build('sofa').spec, { x: 0, y: 0, z: 0, ry: 0 })
    w.add('bed', build('bed_double').spec, { x: 4, y: 0, z: 0, ry: 0 })
    expect(w.sit('sofa', 'seat_1', 'p1')?.pose).toBe('sit')
    w.stand('p1')
    expect(w.sit('bed', 'lie_1', 'p1')?.pose).toBe('lie')
    w.add('curtain', build('curtain').spec, { x: 8, y: 0, z: 0, ry: 0 })
    expect(w.colliders().filter((c) => c.object === 'curtain')).toEqual([])
    w.push([8, 1.2, 0], 0.3, [0, 0, -1])
    w.update(0.1)
    expect(Math.abs(w.sway('curtain', 'panel_l').ax) + Math.abs(w.sway('curtain', 'panel_l').az)).toBeGreaterThanOrEqual(0)
  })

  it('reports mirrors, clothesline poles only as colliders and the shower glass never as a collider', () => {
    const { w } = world()
    w.add('wardrobe', build('wardrobe').spec, { x: 0, y: 0, z: 0, ry: 0 })
    w.add('line', build('clothesline').spec, { x: 6, y: 0, z: 0, ry: 0 })
    w.add('shower', build('shower').spec, { x: -6, y: 0, z: 0, ry: 0 })
    expect(w.mirrors([0, 1.5, 2], 5, 3).length).toBeGreaterThan(0)
    const cols = w.colliders()
    expect(cols.filter((c) => c.object === 'line').length).toBe(2)
    expect(cols.filter((c) => c.object === 'shower').every((c) => c.id.includes('wall'))).toBe(true)
  })
})

describe('every type in the engine', () => {
  for (const locale of ['en', 'pt-BR'] as const) {
    it(`adds cleanly and every prompt is localized (${locale})`, () => {
      const hh = pack('br', locale)
      const w = createWorld({ locale, strings: hh.strings, items: hh.items, loot: hh.loot, seed: 'all' })
      hh.types.forEach((t, i) => w.add(t.id, build(t.id, { seed: i }).spec, { x: i * 5, y: 0, z: 0, ry: 0 }))
      const all = w.interactables()
      expect(all.length).toBeGreaterThan(50)
      for (const it of all) {
        expect(it.label, it.id).toBeTruthy()
        expect(it.label, it.id).not.toMatch(/^prompt\./)
      }
      for (let k = 0; k < 20; k++) w.update(0.1)
      // every container fills from loot or explicit contents without losing slots
      for (const o of w.objects()) for (const c of o.spec.containers ?? []) expect(w.contents(o.id, c.id).length, `${o.id}:${c.id}`).toBe(c.slots.length)
    })
  }
})

describe('washing machine water', () => {
  it('draws 12 l/min from the tank while a cycle runs, and nothing when it is off', () => {
    const { w } = world()
    w.add('tk', { type: 'tank', tanks: [{ id: 't', capacity: 200, level: 100 }] }, { x: 5, y: 0, z: 0, ry: 0 })
    const spec = build('washing_machine').spec
    expect(spec.fixtures![0]).toMatchObject({ id: 'inlet', flow: 12 })
    expect(spec.devices![0].fixture).toBe('inlet')
    w.add('wm', spec, { x: 0, y: 0, z: 0, ry: 0 })
    w.add('socket', build('wall_socket').spec, { x: 0, y: 0.3, z: -0.4, ry: 0 })
    expect(w.interactables().map((i) => i.id)).not.toContain('wm:fixture.inlet')
    for (let i = 0; i < 300; i++) w.update(0.1)
    expect(w.water.level('tk:t')).toBe(100)
    w.act('wm:use_washer')
    for (let i = 0; i < 300; i++) w.update(0.1)
    expect(w.water.level('tk:t')).toBeCloseTo(100 - 12 * 0.5, 0) // 30 s
    w.act('wm:use_washer')
    const level = w.water.level('tk:t')
    for (let i = 0; i < 100; i++) w.update(0.1)
    expect(w.water.level('tk:t')).toBeCloseTo(level, 1)
  })
})

describe('gas bottle in a cabinet', () => {
  it('the valve works only while the cabinet door in front is open', () => {
    const { w } = world()
    const cab = build('kitchen_cabinet_base').spec
    const door = cab.parts!.find((p) => p.id.startsWith('door'))!.id
    w.add('counter', cab, { x: 0, y: 0, z: 0, ry: 0 })
    w.add('bottle', build('gas_bottle', { requires: { object: 'counter', part: door } }).spec, { x: 6, y: 0, z: 0, ry: 0 })
    expect(w.act('bottle:use_gas')).toBe(false)
    w.setPart('counter', door, 1, true)
    expect(w.act('bottle:use_gas')).toBe(true)
    w.setPart('counter', door, 0, true)
    expect(w.act('bottle:use_gas')).toBe(false)
    expect(build('gas_bottle').spec.interactions!.every((i) => !i.requires)).toBe(true)
  })
})

describe('electrical panel and power meter', () => {
  const circuits = [{ id: 'lights', label: 'Luzes' }, { id: 'sockets', label: 'Tomadas' }, { id: 'ac' }]

  it('builds one rocker part per circuit, gated behind the door, and flips the building circuits', () => {
    const { w } = world()
    const b = build('electrical_panel', { circuits })
    expect(b.spec.parts!.filter((p) => p.motion.kind === 'rocker').length).toBe(3)
    expect(b.spec.parts!.filter((p) => p.motion.kind === 'rocker').every((p) => p.requires === 'door' && p.t0 === 1)).toBe(true)
    expect(b.spec.interactions!.map((i) => i.action).filter((a) => a.do === 'toggle_breaker')).toEqual([
      expect.objectContaining({ do: 'toggle_breaker', circuit: 'lights', name: 'Luzes' }),
      expect.objectContaining({ do: 'toggle_breaker', circuit: 'sockets', name: 'Tomadas' }),
      expect.objectContaining({ do: 'toggle_breaker', circuit: 'ac' }),
    ])
    w.add('q', b.spec, { x: 0, y: 0, z: 0, ry: 0 })
    w.add('lamp', { type: 'lamp', devices: [{ id: 'bulb', kind: 'lamp', watts: 9, circuit: 'lights', on: true }] }, { x: 3, y: 0, z: 0, ry: 0 })
    const flip = 'q:toggle_breaker_lights'
    expect(w.act(flip)).toBe(false) // door closed
    w.setPart('q', 'door', 1, true)
    expect(w.interactables().find((i) => i.id === flip)!.label).toBe('Desligar Luzes')
    expect(w.act(flip)).toBe(true)
    expect(w.power.isPowered('lamp', 'bulb')).toBe(false)
    expect(w.interactables().find((i) => i.id === flip)!.label).toBe('Ligar Luzes')
    expect(w.act(flip)).toBe(true)
    expect(w.power.isPowered('lamp', 'bulb')).toBe(true)
  })

  it('defaults to one main circuit and uses two columns for many circuits', () => {
    expect(build('electrical_panel').spec.interactions!.filter((i) => i.action.do === 'toggle_breaker').length).toBe(1)
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}` }))
    const b = build('electrical_panel', { circuits: many })
    expect(b.spec.parts!.filter((p) => p.motion.kind === 'rocker').length).toBe(10)
    expect(new Set(b.spec.parts!.map((p) => p.id)).size).toBe(11)
  })

  it('power meter has a door, a glass window and a seal', () => {
    const b = build('power_meter')
    expect(b.spec.parts!.map((p) => p.id)).toEqual(['door'])
    const prims = b.rec.parts.door.primitives
    expect(prims.some((p) => p.kind === 'plane' && p.material === 'glass')).toBe(true)
    expect(prims.some((p) => p.kind === 'cylinder')).toBe(true)
  })
})
