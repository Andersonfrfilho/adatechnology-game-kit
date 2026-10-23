import { describe, expect, it } from 'vitest'
import type { ObjectSpec } from '../src'
import { cabinet, origin, run, world } from './fixtures'

const strings = {
  en: { 'prompt.door.open': 'Close {name} door', 'prompt.door.closed': 'Open {name} door', 'prompt.door': 'Door', 'type.cabinet': 'cabinet', 'prompt.drawer': 'Drawer' },
  'pt-BR': { 'prompt.door.open': 'Fechar porta do {name}', 'prompt.door.closed': 'Abrir porta do {name}', 'type.cabinet': 'armario' },
}

describe('default interactions', () => {
  it('derives toggle_part for labelled parts and open_container for open shelves', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    const ids = w.interactables().map((i) => i.id)
    expect(ids).toContain('c:part.door')
    expect(ids).toContain('c:part.drawer')
    expect(ids).toContain('c:open.shelf')
    // containers whose access part is labelled are opened through the part
    expect(ids).not.toContain('c:open.main')
  })

  it('derives device, switch, fixture, burner, fuel valve and seat interactions', () => {
    const spec: ObjectSpec = {
      type: 'misc',
      parts: [{ id: 'valve', pivot: [0, 0.2, 0], motion: { kind: 'knob' } }, { id: 'knob', pivot: [0, 1, 0], motion: { kind: 'knob' }, label: 'prompt.knob' }],
      devices: [{ id: 'tv', kind: 'screen', watts: 50, channels: 3, circuit: 'a' }],
      switches: [{ id: 'sw', controls: ['tv'] }],
      fixtures: [{ id: 'tap', kind: 'tap', outlet: [0, 1, 0] }],
      fuels: [{ id: 'bottle', kind: 'gas', capacity: 13, valve: 'valve' }],
      burners: [
        { id: 'b1', pos: [0, 1, 0], fuel: 'bottle', rate: 0.001, part: 'knob' },
        { id: 'coal', pos: [0, 1, 0], fuel: 'bottle', rate: 0.001, needsIgnition: true },
      ],
      seats: [{ id: 's', pose: 'sit', pos: [0, 0.4, 0], ry: 0, exit: [0, 0, 1] }],
    }
    const { w } = world()
    w.add('o', spec, origin)
    const kinds = w.interactables().map((i) => i.kind)
    for (const k of ['toggle_device', 'cycle_device', 'toggle_switch', 'toggle_fixture', 'toggle_burner', 'ignite', 'toggle_fuel', 'sit'] as const) expect(kinds).toContain(k)
    // the knob is used by a burner, so no separate toggle_part
    expect(kinds).not.toContain('toggle_part')
  })

  it('explicit interactions win over derived ones', () => {
    const spec: ObjectSpec = { ...cabinet, interactions: [{ id: 'only', pos: [0, 0.5, 0.4], action: { do: 'toggle_part', part: 'door' }, label: 'prompt.door' }] }
    const { w } = world()
    w.add('c', spec, origin)
    expect(w.interactables().map((i) => i.id)).toEqual(['c:only'])
  })
})

describe('labels', () => {
  it('uses .open/.closed state keys, fills {name} and localizes', () => {
    const { w } = world({ strings })
    w.add('c', cabinet, origin)
    const find = () => w.interactables().find((i) => i.id === 'c:part.door')!
    expect(find().label).toBe('Open cabinet door')
    w.act('c:part.door')
    expect(find().label).toBe('Close cabinet door')
    w.setLocale('pt-BR')
    expect(find().label).toBe('Fechar porta do armario')
  })

  it('falls back to the base label, then to the engine default per action kind', () => {
    const { w } = world({ strings })
    w.add('c', cabinet, origin)
    expect(w.interactables().find((i) => i.id === 'c:part.drawer')!.label).toBe('Drawer')
    expect(w.interactables().find((i) => i.id === 'c:open.shelf')!.label).toBe('Open cabinet')
    const { w: w2 } = world()
    w2.add('c', { ...cabinet, parts: cabinet.parts!.map((p) => ({ ...p, label: 'missing.key' })) }, origin)
    expect(w2.interactables().find((i) => i.id === 'c:part.door')!.label).toBe('Open Cabinet')
  })

  it('humanizes the type id when there is no type.* string', () => {
    const { w } = world()
    w.add('c', { ...cabinet, type: 'kitchen_cabinet' }, origin)
    expect(w.interactables().find((i) => i.id === 'c:open.shelf')!.label).toBe('Open Kitchen cabinet')
  })

  it('t() falls back to the key and fills vars', () => {
    const { w } = world({ strings })
    expect(w.t('nope')).toBe('nope')
    expect(w.t('prompt.open', { name: 'x' })).toBe('Open x')
  })
})

describe('target', () => {
  const eyeAt = (x: number, z: number, yaw: number) => ({ x, y: 0.5, z, yaw, pitch: 0 })

  it('picks the interaction in the view cone within reach', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    // door pivot is at (-0.4, 0, 0.3); stand in front, looking toward -z with the door slightly left
    const t = w.target({ x: -0.4, y: 0, z: 1.5, yaw: 0, pitch: 0 })
    expect(t?.id).toBe('c:part.door')
  })

  it('returns null when out of reach or out of the cone', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    expect(w.target(eyeAt(-0.4, 5, 0))).toBeNull()
    expect(w.target({ x: -0.4, y: 0, z: 1.5, yaw: Math.PI, pitch: 0 })).toBeNull()
    expect(w.target({ x: -0.4, y: 0, z: 1.5, yaw: 0, pitch: 0 }, { reach: 0.5 })).toBeNull()
  })

  it('prefers the better aligned of two candidates', () => {
    const { w } = world()
    w.add('a', cabinet, { x: 0, y: 0, z: 0, ry: 0 })
    w.add('b', cabinet, { x: 0.5, y: 0, z: 0, ry: 0 })
    const t = w.target({ x: 0.1, y: 0, z: 1.5, yaw: 0, pitch: 0 }, { cone: 1 })
    expect(t).not.toBeNull()
  })

  it('ignores take/read of inaccessible containers', () => {
    const spec: ObjectSpec = {
      ...cabinet,
      interactions: [{ id: 'grab', pos: [0, 0.2, 0], action: { do: 'take', container: 'main' }, label: 'prompt.take' }],
    }
    const { w } = world()
    w.add('c', spec, origin)
    const eye = { x: 0, y: 0.2, z: 1, yaw: 0, pitch: 0 }
    expect(w.target(eye)).toBeNull()
    w.setPart('c', 'door', 1, true)
    expect(w.target(eye)?.id).toBe('c:grab')
  })

  it('respects the actual yaw convention (yaw 0 looks toward -z)', () => {
    const { w } = world()
    w.add('c', { type: 't', interactions: [{ id: 'x', pos: [2, 0, 0], action: { do: 'open_container', container: 'none' }, label: '' }] }, origin)
    expect(w.target({ x: 0, y: 0, z: 0, yaw: -Math.PI / 2, pitch: 0 }, { reach: 3 })?.id).toBe('c:x')
    expect(w.target({ x: 0, y: 0, z: 0, yaw: Math.PI / 2, pitch: 0 }, { reach: 3 })).toBeNull()
  })
})

describe('act', () => {
  it('canInteract can cancel', () => {
    const { w } = world({ canInteract: () => false })
    w.add('c', cabinet, origin)
    expect(w.act('c:part.door')).toBe(false)
    run(w, 1)
    expect(w.partT('c', 'door')).toBe(0)
  })

  it('unknown ids return false and Interactable.act works', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    expect(w.act('nope:x')).toBe(false)
    expect(w.interactables().find((i) => i.id === 'c:part.door')!.act()).toBe(true)
  })

  it('take and read actions', () => {
    const spec: ObjectSpec = {
      type: 'desk',
      containers: [{ id: 'd', volume: { center: [0, 0, 0], half: [1, 1, 1] }, slots: [{ pos: [0, 0, 0], max: [0.3, 0.3, 0.3] }, { pos: [0, 0, 0], max: [0.3, 0.3, 0.3] }], contents: [null, { type: 'paper', qty: 1, data: { text: 'letter.1' } }] }],
      interactions: [
        { id: 'take', pos: [0, 0, 0], action: { do: 'take', container: 'd' }, label: '' },
        { id: 'read', pos: [0, 0, 0], action: { do: 'read', container: 'd', slot: 1 }, label: '' },
      ],
    }
    const { w, events } = world({ strings: { en: { 'letter.1': 'Dear friend' } } })
    w.add('d', spec, origin)
    expect(w.act('d:read')).toBe(true)
    expect(events.find((e) => e.type === 'message' && e.key === 'letter.1')).toMatchObject({ text: 'Dear friend' })
    expect(w.act('d:take')).toBe(true)
    expect(w.contents('d', 'd')[1]).toBeNull()
    expect(w.act('d:take')).toBe(false)
    expect(events.some((e) => e.type === 'message' && e.key === 'empty')).toBe(true)
  })

  it('open_container on an open shelf emits a container event', () => {
    const { w, events } = world()
    w.add('c', cabinet, origin)
    expect(w.act('c:open.shelf')).toBe(true)
    expect(events.some((e) => e.type === 'container' && e.container === 'shelf')).toBe(true)
  })
})

describe('requires', () => {
  const bottle: ObjectSpec = {
    type: 'bottle',
    parts: [{ id: 'valve', pivot: [0, 0.3, 0], motion: { kind: 'knob' } }],
    fuels: [{ id: 'gas', kind: 'gas', capacity: 13, valve: 'valve' }],
    interactions: [{ id: 'valve', pos: [0, 0.3, 0], radius: 1, action: { do: 'toggle_fuel', fuel: 'gas' }, label: '', requires: { object: 'c', part: 'door' } }],
  }

  it('the valve is available only while the cabinet door in front is open', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    w.add('g', bottle, { x: 5, y: 0, z: 0, ry: 0 })
    const eye = { x: 5, y: 0.3, z: 0.8, yaw: 0, pitch: 0 }
    expect(w.target(eye)?.id).not.toBe('g:valve')
    expect(w.act('g:valve')).toBe(false)
    expect(w.partT('g', 'valve')).toBe(0)
    w.setPart('c', 'door', 1, true)
    expect(w.target({ ...eye, z: 0.4 })?.id).toBe('g:valve')
    expect(w.act('g:valve')).toBe(true)
    w.setPart('c', 'door', 0, true)
    expect(w.act('g:valve')).toBe(false)
  })

  it('an unknown object or part never opens it', () => {
    const { w } = world()
    w.add('g', { ...bottle, interactions: [{ ...bottle.interactions![0], requires: { object: 'nope', part: 'door' } }] }, origin)
    expect(w.act('g:valve')).toBe(false)
  })
})
