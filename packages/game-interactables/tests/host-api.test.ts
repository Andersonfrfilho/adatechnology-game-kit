import { describe, expect, it } from 'vitest'
import type { ObjectSpec, WorldEvent } from '../src'
import { mergeColliders } from '../src'
import { cabinet, origin, world } from './fixtures'

const eye = (x: number, z: number, yaw = 0, y = 1.2) => ({ x, y, z, yaw, pitch: 0 })

const wiredLamp: ObjectSpec = { type: 'lamp', devices: [{ id: 'bulb', kind: 'lamp', watts: 9, circuit: 'lights' }] }

describe('setDevice / setFixture / setBurner', () => {
  it('turns a device on and off with the same events as the interaction, and is quiet when nothing changes', () => {
    const { w, events } = world()
    w.add('l', wiredLamp, origin)
    expect(w.setDevice('l', 'bulb', true)).toBe(true)
    expect(w.power.isOn('l', 'bulb')).toBe(true)
    const dev = events.filter((e): e is Extract<WorldEvent, { type: 'device' }> => e.type === 'device')
    expect(dev).toHaveLength(1)
    expect(dev[0]).toMatchObject({ object: 'l', device: 'bulb', on: true, powered: true })
    w.setDevice('l', 'bulb', true)
    expect(events.filter((e) => e.type === 'device')).toHaveLength(1)
    w.setDevice('l', 'bulb', false)
    expect(w.power.isOn('l', 'bulb')).toBe(false)
    expect(w.setDevice('l', 'nope', true)).toBe(false)
    expect(w.setDevice('zzz', 'bulb', true)).toBe(false)
  })

  it('warns about missing power like the interaction does and follows the part of a device', () => {
    const { w, events } = world({ grid: false })
    w.add('l', { ...wiredLamp, parts: [{ id: 'rock', pivot: [0, 1, 0], motion: { kind: 'rocker' }, label: 'x' }], devices: [{ id: 'bulb', kind: 'lamp', watts: 9, circuit: 'lights', part: 'rock' }] }, origin)
    w.setDevice('l', 'bulb', true)
    expect(events.some((e) => e.type === 'message' && e.key === 'no_power')).toBe(true)
    for (let i = 0; i < 60; i++) w.update(1 / 30)
    expect(w.partT('l', 'rock')).toBe(1)
  })

  it('drives fixtures and burners', () => {
    const { w } = world()
    w.add(
      's',
      {
        type: 'stove',
        fuels: [{ id: 'gas', kind: 'gas', capacity: 10, level: 10 }],
        burners: [{ id: 'b', pos: [0, 1, 0], fuel: 'gas', needsIgnition: true }],
        fixtures: [{ id: 'tap', kind: 'tap', outlet: [0, 1, 0] }],
      } as ObjectSpec,
      origin,
    )
    expect(w.setBurner('s', 'b', true)).toBe(true)
    expect(w.interactables().find((i) => i.id === 's:ignite.b')?.available).toBe(false)
    expect(w.setBurner('s', 'b', false)).toBe(true)
    expect(w.interactables().find((i) => i.id === 's:ignite.b')?.available).toBe(true)
    expect(w.setFixture('s', 'tap', true)).toBe(true)
    expect(w.setFixture('s', 'nope', true)).toBe(false)
    expect(w.setBurner('s', 'nope', true)).toBe(false)
  })
})

describe('target filters, lamps and availability', () => {
  it('hard-wired lamps have no interaction of their own and never steal the key', () => {
    const { w } = world()
    w.add('l', wiredLamp, origin)
    expect(w.interactables().filter((i) => i.object === 'l')).toHaveLength(0)
    expect(w.target(eye(0, 1), { reach: 5, cone: 3.1 })).toBeNull()
  })

  it('a lamp with a pressable part, a plug or no electricity still has its interaction', () => {
    const { w } = world()
    w.add('a', { type: 'a', parts: [{ id: 'p', pivot: [0, 1, 0], motion: { kind: 'rocker' } }], devices: [{ id: 'd', kind: 'lamp', watts: 1, circuit: 'c', part: 'p' }] }, origin)
    w.add('b', { type: 'b', devices: [{ id: 'd', kind: 'lamp', watts: 1, plug: [0, 0.1, 0] }] }, origin)
    w.add('c', { type: 'c', devices: [{ id: 'd', kind: 'lamp', watts: 0, electric: false }] }, origin)
    for (const id of ['a', 'b', 'c']) expect(w.interactables().some((i) => i.id === `${id}:device.d`)).toBe(true)
  })

  it('filter and kinds narrow the candidates; unavailable ones are skipped unless asked for', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    const e = eye(0, 2.3, 0, 0.3)
    const open = (o: object) => ({ reach: 3, cone: 3.1, ...o })
    const all = w.interactables().filter((i) => i.available)
    expect(all.length).toBeGreaterThan(1)
    const any = w.target(e, open({}))
    expect(any).not.toBeNull()
    expect(w.target(e, open({ kinds: ['sit'] }))).toBeNull()
    expect(w.target(e, open({ kinds: [any!.kind] }))?.id).toBe(any!.id)
    const other = w.target(e, open({ filter: (i: { id: string }) => i.id !== any!.id }))
    expect(other?.id).not.toBe(any!.id)
    expect(w.target(e, open({ filter: () => false }))).toBeNull()
    // the drawer needs the door open
    const drawer = w.interactables().find((i) => i.id === 'c:part.drawer')!
    expect(drawer.available).toBe(false)
    expect(drawer.reason).toBe('requires_open')
    expect(w.t(drawer.reason!)).toBe('Open it first')
    const eyeDrawer = eye(0, 0.75, 0, 0.3)
    expect(w.target(eyeDrawer, { reach: 0.45, cone: 1 })?.id).not.toBe('c:part.drawer')
    expect(w.target(eyeDrawer, { reach: 0.45, cone: 1, includeUnavailable: true })?.id).toBe('c:part.drawer')
    w.setPart('c', 'door', 1, true)
    expect(w.interactables().find((i) => i.id === 'c:part.drawer')?.available).toBe(true)
    expect(w.interactables().find((i) => i.id === 'c:part.drawer')?.reason).toBeUndefined()
  })

  it('reports no_power for a channel button and locked when canInteract refuses', () => {
    const { w } = world({ grid: false, canInteract: (i) => i.object !== 'tv2' })
    const tv: ObjectSpec = { type: 'tv', devices: [{ id: 'tv', kind: 'screen', watts: 50, circuit: 'x', channels: 3, on: true, plug: [0, 0.5, 0] }] }
    w.add('tv', tv, origin)
    w.add('tv2', tv, { x: 4, y: 0, z: 0, ry: 0 })
    expect(w.interactables().find((i) => i.id === 'tv:channel.tv')?.reason).toBe('no_power')
    expect(w.interactables().find((i) => i.id === 'tv2:device.tv')?.reason).toBe('locked')
    w.setDevice('tv', 'tv', false)
    expect(w.interactables().find((i) => i.id === 'tv:channel.tv')?.reason).toBe('turn_on_first')
  })
})

describe('structured prompts', () => {
  it('splits label into verb and noun, with no key hint, in both locales', () => {
    const { w } = world({ strings: { en: { 'p.fridge.closed': 'Open the fridge', 'p.lamp.open': 'Turn the lamp off', 'p.lamp.open.verb': 'Turn off', 'p.lamp.open.object': 'the lamp' } } })
    w.add(
      'f',
      {
        type: 'fridge',
        parts: [{ id: 'door', pivot: [0, 0, 0], motion: { kind: 'hinge' }, label: 'p.fridge' }, { id: 'rk', pivot: [0, 1, 0], motion: { kind: 'rocker' }, label: 'p.lamp', t0: 1 }],
      },
      origin,
    )
    const door = w.interactables().find((x) => x.id === 'f:part.door')!
    expect(door).toMatchObject({ label: 'Open the fridge', verb: 'Open', noun: 'the fridge' })
    const rk = w.interactables().find((x) => x.id === 'f:part.rk')!
    expect(rk).toMatchObject({ label: 'Turn the lamp off', verb: 'Turn off', noun: 'the lamp' })
  })

  it('generic prompts split into verb and object type name; no kit string starts with "E:"', () => {
    const { w } = world({ locale: 'pt-BR' })
    w.add('c', { type: 'cabinet', seats: [{ id: 's', pos: [0, 0.5, 0], ry: 0, exit: [1, 0, 0] }] } as ObjectSpec, origin)
    const seat = w.interactables().find((x) => x.id === 'c:seat.s')!
    expect(seat.verb).toBe('Sentar')
    expect(seat.noun).toBe('Cabinet')
    for (const loc of ['en', 'pt-BR']) {
      const { w: x } = world({ locale: loc })
      for (const k of ['prompt.open', 'prompt.take', 'prompt.sit', 'no_power', 'requires_open']) expect(x.t(k)).not.toMatch(/^E[:\s]/)
    }
  })
})

describe('colliders merge', () => {
  const planks: ObjectSpec = {
    type: 'wall',
    colliders: [
      { id: 'a', center: [0, 1, 0], half: [0.5, 1, 0.1] },
      { id: 'b', center: [1, 1, 0], half: [0.5, 1, 0.1] }, // adjacent to a
      { id: 'c', center: [0.5, 1, 0], half: [1, 1, 0.1] }, // covers both
      { id: 'd', center: [3, 1, 0], half: [0.5, 1, 0.1] }, // far away
      { id: 'door', center: [3, 1, 0], half: [0.2, 1, 0.2], part: 'p', offWhenOpen: true },
    ],
    parts: [{ id: 'p', pivot: [3, 0, 0], motion: { kind: 'hinge' } }],
  }

  it('unions overlapping and adjacent boxes of one object, keeps far and part-bound ones, covers the originals', () => {
    for (const ry of [0, 0.7]) {
      const { w } = world()
      w.add('o', planks, { x: 5, y: 0, z: -2, ry })
      const raw = w.colliders()
      const merged = w.colliders({ merge: true })
      expect(raw).toHaveLength(5)
      expect(merged).toHaveLength(3) // a+b+c, d, door
      expect(merged.some((m) => m.id.startsWith('o:door'))).toBe(true)
      // every sample point inside an original (non-part) box is inside a merged one
      const inside = (list: typeof raw, x: number, y: number, z: number) =>
        list.some((c) => {
          const dx = x - c.cx
          const dz = z - c.cz
          const u = dx * Math.cos(c.ry) - dz * Math.sin(c.ry)
          const v = dx * Math.sin(c.ry) + dz * Math.cos(c.ry)
          return Math.abs(u) <= c.hw + 1e-6 && Math.abs(v) <= c.hd + 1e-6 && y >= c.y0 - 1e-6 && y <= c.y1 + 1e-6
        })
      const fixed = raw.filter((c) => !c.id.includes('door'))
      let checked = 0
      for (let x = 3; x < 9; x += 0.13) {
        for (let z = -4; z < 0; z += 0.05) {
          for (const y of [0.2, 1, 1.9]) {
            if (inside(fixed, x, y, z)) {
              checked++
              expect(inside(merged, x, y, z)).toBe(true)
            }
          }
        }
      }
      expect(checked).toBeGreaterThan(20)
    }
  })

  it('does not merge across objects, across rotations, or when the hull would be much larger than the union', () => {
    const box = (id: string, object: string, cx: number, cz: number, ry = 0) => ({ id, object, cx, cz, hw: 0.5, hd: 0.5, ry, y0: 0, y1: 1 })
    expect(mergeColliders([box('a', 'x', 0, 0), box('b', 'y', 0.5, 0)])).toHaveLength(2)
    expect(mergeColliders([box('a', 'x', 0, 0), box('b', 'x', 0.5, 0, 0.3)])).toHaveLength(2)
    // an L shape: hull is far larger than the union
    const L = [{ ...box('a', 'x', 0, 0), hw: 2, hd: 0.2 }, { ...box('b', 'x', 1.8, 1), hw: 0.2, hd: 1.2 }]
    expect(mergeColliders(L)).toHaveLength(2)
  })
})
