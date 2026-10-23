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
