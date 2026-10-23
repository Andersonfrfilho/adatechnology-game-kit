import { describe, expect, it } from 'vitest'
import type { ObjectSpec, WorldEvent } from '../src'
import { cabinet, origin, run, world } from './fixtures'

const chair: ObjectSpec = {
  type: 'chair',
  seats: [
    { id: 'a', pose: 'sit', pos: [0, 0.45, 0], ry: 0, exit: [0, 0, 0.8] },
    { id: 'b', pose: 'lie', pos: [1, 0.5, 0], ry: Math.PI / 2, exit: [1, 0, 1], eye: 0.3 },
  ],
}

describe('seats', () => {
  it('sit returns eye and yaw; one actor per seat', () => {
    const { w, events } = world()
    w.add('c', chair, { x: 2, y: 0, z: 3, ry: 0 })
    const r = w.sit('c', 'a', 'p1')
    expect(r?.pose).toBe('sit')
    expect(r?.eye[0]).toBeCloseTo(2)
    expect(r?.eye[1]).toBeCloseTo(0.45 + 0.62)
    expect(r?.eye[2]).toBeCloseTo(3)
    expect(r?.yaw).toBeCloseTo(Math.PI)
    expect(w.sit('c', 'a', 'p2')).toBeNull()
    expect(w.seatOf('p1')).toEqual({ object: 'c', seat: 'a' })
    expect(w.seatOf('p2')).toBeNull()
    expect(events.some((e) => e.type === 'seat' && e.seated)).toBe(true)
  })

  it('lie uses its own eye height and rotates with the object', () => {
    const { w } = world()
    w.add('c', chair, { x: 0, y: 1, z: 0, ry: Math.PI / 2 })
    const r = w.sit('c', 'b')
    expect(r?.eye[1]).toBeCloseTo(1 + 0.5 + 0.3)
    expect(r?.eye[0]).toBeCloseTo(0, 5)
    expect(r?.eye[2]).toBeCloseTo(-1)
  })

  it('stand returns the world exit point and frees the seat', () => {
    const { w } = world()
    w.add('c', chair, { x: 2, y: 0, z: 3, ry: 0 })
    w.sit('c', 'a')
    const exit = w.stand()
    expect(exit).toEqual([2, 0, 3.8])
    expect(w.seatOf()).toBeNull()
    expect(w.stand()).toBeNull()
    expect(w.sit('c', 'a', 'other')).not.toBeNull()
  })

  it('the sit interaction toggles for the same actor and prompts get up', () => {
    const { w } = world()
    w.add('c', chair, origin)
    expect(w.interactables().find((i) => i.id === 'c:seat.a')?.label).toBe('Sit')
    expect(w.interactables().find((i) => i.id === 'c:seat.b')?.label).toBe('Lie down')
    w.act('c:seat.a')
    expect(w.seatOf()?.seat).toBe('a')
    expect(w.interactables().find((i) => i.id === 'c:seat.a')?.label).toBe('Get up')
    w.act('c:seat.a')
    expect(w.seatOf()).toBeNull()
  })

  it('moving to another seat frees the previous one; removing the object frees actors', () => {
    const { w } = world()
    w.add('c', chair, origin)
    w.sit('c', 'a')
    w.sit('c', 'b')
    expect(w.sit('c', 'a', 'x')).not.toBeNull()
    w.remove('c')
    expect(w.seatOf()).toBeNull()
    expect(w.get('c')).toBeUndefined()
  })
})

const curtain: ObjectSpec = {
  type: 'curtain',
  soft: [{ id: 'c', kind: 'curtain', anchor: [0, 2, 0], size: [1.2, 1.8, 0.1] }],
  colliders: [{ id: 'rod', center: [0, 2, 0], half: [0.6, 0.02, 0.02] }],
}

describe('soft volumes', () => {
  it('never appear in colliders', () => {
    const { w } = world()
    w.add('c', curtain, origin)
    expect(w.colliders().map((c) => c.id)).toEqual(['c:rod'])
  })

  it('swing when pushed and settle back near zero', () => {
    const { w } = world()
    w.add('c', curtain, origin)
    expect(w.sway('c', 'c')).toEqual({ ax: 0, az: 0 })
    w.push([0, 0, 0.3], 0.3, [0, 0, -1.5])
    run(w, 0.15)
    expect(Math.abs(w.sway('c', 'c').ax)).toBeGreaterThan(0.05)
    expect(w.sway('c', 'c').az).toBe(0)
    run(w, 8)
    expect(Math.abs(w.sway('c', 'c').ax)).toBeLessThan(0.001)
  })

  it('a push toward -z swings the bottom toward -z, sideways pushes use az', () => {
    const { w } = world()
    w.add('c', curtain, origin)
    w.push([0, 0, 0.3], 0.3, [0, 0, -1])
    run(w, 0.05)
    expect(w.sway('c', 'c').ax).toBeGreaterThan(0)
    w.push([0, 0, 0], 0.3, [1, 0, 0])
    run(w, 0.05)
    expect(w.sway('c', 'c').az).toBeGreaterThan(0)
  })

  it('ignores actors that do not overlap, horizontally or vertically', () => {
    const { w } = world()
    w.add('c', curtain, origin)
    w.push([3, 0, 0], 0.3, [-2, 0, 0])
    w.push([0, 5, 0], 0.3, [0, 0, -2])
    run(w, 0.2)
    expect(w.sway('c', 'c')).toEqual({ ax: 0, az: 0 })
  })

  it('clamps to maxAngle', () => {
    const { w } = world()
    w.add('c', { ...curtain, soft: [{ id: 'c', kind: 'curtain', anchor: [0, 2, 0], size: [1.2, 1.8, 0.1], maxAngle: 0.2 }] }, origin)
    for (let i = 0; i < 30; i++) {
      w.push([0, 0, 0.1], 0.3, [0, 0, -5])
      w.update(0.02)
    }
    expect(Math.abs(w.sway('c', 'c').ax)).toBeLessThanOrEqual(0.2 + 1e-9)
  })

  it('wind sways cloth but not panels, and it settles when the wind stops', () => {
    const { w } = world()
    w.add('c', curtain, origin)
    w.add('p', { type: 'p', soft: [{ id: 'd', kind: 'panel', anchor: [0, 2, 0], size: [0.8, 1.8, 0.05] }] }, origin)
    w.setWind(5, 0)
    run(w, 2)
    expect(Math.abs(w.sway('c', 'c').az)).toBeGreaterThan(0.001)
    expect(w.sway('p', 'd')).toEqual({ ax: 0, az: 0 })
    w.setWind(0, 0)
    run(w, 8)
    expect(Math.abs(w.sway('c', 'c').az)).toBeLessThan(0.001)
  })

  it('a panel with a part opens when pushed from the front', () => {
    const { w } = world()
    const door: ObjectSpec = {
      type: 'shower',
      parts: [{ id: 'leaf', pivot: [0, 0, 0], motion: { kind: 'hinge' } }],
      soft: [{ id: 'panel', kind: 'panel', anchor: [0, 2, 0], size: [0.8, 1.9, 0.05], part: 'leaf' }],
    }
    w.add('s', door, origin)
    w.push([0, 0, -0.5], 0.3, [0, 0, 1])
    expect(w.partT('s', 'leaf')).toBe(0)
    w.push([0, 0, 0.3], 0.3, [0, 0, -1])
    run(w, 1)
    expect(w.partT('s', 'leaf')).toBe(1)
  })
})

describe('mirrors', () => {
  const mirrorSpec: ObjectSpec = {
    type: 'wardrobe',
    parts: [{ id: 'door', pivot: [-0.4, 0, 0.3], motion: { kind: 'hinge', angle: -Math.PI / 2 } }],
    mirrors: [{ id: 'm', center: [0, 1, 0.31], normal: [0, 0, 1], w: 0.6, h: 1.6, part: 'door' }],
  }

  it('lists mirrors facing the eye, nearest first', () => {
    const { w } = world()
    w.add('a', { type: 'm', mirrors: [{ id: 'm', center: [0, 1, 0], normal: [0, 0, 1], w: 1, h: 1 }] }, { x: 0, y: 0, z: 0, ry: 0 })
    w.add('b', { type: 'm', mirrors: [{ id: 'm', center: [0, 1, 0], normal: [0, 0, 1], w: 1, h: 1 }] }, { x: 0, y: 0, z: 2, ry: 0 })
    const list = w.mirrors([0, 1, 5], 20, 5)
    expect(list.map((m) => m.id)).toEqual(['b:m', 'a:m'])
    expect(list[0].distance).toBeCloseTo(3)
    expect(w.mirrors([0, 1, 5], 20, 1)).toHaveLength(1)
    expect(w.mirrors([0, 1, 5], 2)).toHaveLength(0)
  })

  it('skips mirrors that face away from the eye', () => {
    const { w } = world()
    w.add('a', mirrorSpec, origin)
    expect(w.mirrors([0, 1, 3])).toHaveLength(1)
    expect(w.mirrors([0, 1, -3])).toHaveLength(0)
  })

  it('normal follows the object rotation and the door pose', () => {
    const { w } = world()
    w.add('a', mirrorSpec, { x: 0, y: 0, z: 0, ry: Math.PI / 2 })
    const n = w.mirrors([5, 1, 0])[0].normal
    expect(n[0]).toBeCloseTo(1)
    const { w: w2 } = world()
    w2.add('a', mirrorSpec, origin)
    w2.setPart('a', 'door', 1, true)
    const open = w2.mirrors([-5, 1, 0.3])[0]
    expect(open.normal[0]).toBeCloseTo(-1)
    expect(open.normal[2]).toBeCloseTo(0, 5)
  })
})

describe('colliders', () => {
  const door: ObjectSpec = {
    type: 'door',
    parts: [{ id: 'leaf', pivot: [-0.5, 0, 0], motion: { kind: 'hinge', angle: Math.PI / 2 } }],
    colliders: [
      { id: 'frame', center: [0, 1, 0], half: [0.6, 1, 0.1] },
      { id: 'leaf', center: [0, 1, 0], half: [0.5, 1, 0.03], part: 'leaf', offWhenOpen: true },
      { id: 'panel', center: [0, 1, 0], half: [0.5, 1, 0.03], part: 'leaf' },
    ],
  }

  it('converts to world space', () => {
    const { w } = world()
    w.add('d', door, { x: 4, y: 1, z: 2, ry: 0 })
    const c = w.colliders().find((x) => x.id === 'd:frame')!
    expect(c).toMatchObject({ cx: 4, cz: 2, hw: 0.6, hd: 0.1, ry: 0, y0: 1, y1: 3 })
  })

  it('offWhenOpen colliders disappear when the part passes half way', () => {
    const { w } = world()
    w.add('d', door, origin)
    expect(w.colliders().map((c) => c.id)).toContain('d:leaf')
    w.setPart('d', 'leaf', 1, true)
    const ids = w.colliders().map((c) => c.id)
    expect(ids).not.toContain('d:leaf')
    expect(ids).toContain('d:panel')
  })

  it('part colliders follow the hinge pose', () => {
    const { w } = world()
    w.add('d', door, origin)
    w.setPart('d', 'leaf', 1, true)
    const p = w.colliders().find((c) => c.id === 'd:panel')!
    // rotated 90 degrees about the hinge at x = -0.5: center moves from (0,0) to (-0.5, -0.5) or (-0.5, 0.5)
    expect(p.cx).toBeCloseTo(-0.5)
    expect(Math.abs(p.cz)).toBeCloseTo(0.5)
    expect(Math.abs(p.ry)).toBeCloseTo(Math.PI / 2)
  })

  it('object rotation adds to the collider rotation', () => {
    const { w } = world()
    w.add('d', { type: 'x', colliders: [{ id: 'b', center: [1, 0.5, 0], half: [0.2, 0.5, 0.2], ry: 0.3 }] }, { x: 0, y: 0, z: 0, ry: Math.PI / 2 })
    const c = w.colliders()[0]
    expect(c.ry).toBeCloseTo(Math.PI / 2 + 0.3)
    expect(c.cx).toBeCloseTo(0)
    expect(c.cz).toBeCloseTo(-1)
  })
})

describe('damage', () => {
  const rig: ObjectSpec = {
    type: 'rig',
    fuels: [{ id: 'gas', kind: 'gas', capacity: 13, level: 10 }],
    tanks: [{ id: 'tank', capacity: 100, level: 50 }],
    parts: [{ id: 'pane', pivot: [0, 0, 0], motion: { kind: 'hinge' } }],
    damage: [
      { target: 'gas', kind: 'gas', hp: 10 },
      { target: 'tank', kind: 'water', hp: 20 },
      { target: 'pane', kind: 'glass', hp: 5 },
      { target: 'self', kind: 'wood', hp: 30 },
    ],
  }

  it('reduces hp, reports destroyed and emits damage events', () => {
    const { w, events } = world()
    w.add('r', rig, origin)
    expect(w.hp('r', 'self')).toBe(30)
    expect(w.damage('r', 'self', 10)).toEqual({ hp: 20, destroyed: false })
    expect(w.damage('r', 'self', 100)).toEqual({ hp: 0, destroyed: true })
    expect(w.damage('r', 'self', 1)).toEqual({ hp: 0, destroyed: true })
    expect(events.filter((e) => e.type === 'damage')).toHaveLength(2)
  })

  it('unknown targets give null', () => {
    const { w } = world()
    w.add('r', rig, origin)
    expect(w.damage('r', 'nope', 1)).toBeNull()
    expect(w.damage('zzz', 'self', 1)).toBeNull()
    expect(w.hp('r', 'nope')).toBeNull()
  })

  it('a destroyed gas source explodes with a radius from its level and empties', () => {
    const { w, events } = world()
    w.add('r', rig, { x: 1, y: 0, z: 2, ry: 0 })
    w.damage('r', 'gas', 4)
    expect(events.some((e) => e.type === 'explosion')).toBe(false)
    w.damage('r', 'gas', 100)
    const ex = events.find((e): e is Extract<WorldEvent, { type: 'explosion' }> => e.type === 'explosion')!
    expect(ex.radius).toBeCloseTo(2 + 10 / 5)
    expect(ex.pos[0]).toBeCloseTo(1)
    expect(w.fuelLevel('r', 'gas')).toBe(0)
    w.damage('r', 'gas', 100)
    expect(events.filter((e) => e.type === 'explosion')).toHaveLength(1)
  })

  it('a damaged tank leaks once and drains', () => {
    const { w, events } = world()
    w.add('r', rig, origin)
    w.damage('r', 'tank', 1)
    w.damage('r', 'tank', 1)
    expect(events.filter((e) => e.type === 'leak')).toHaveLength(1)
    const before = w.water.level('r:tank')
    run(w, 5)
    expect(w.water.level('r:tank')).toBeLessThan(before)
  })

  it('glass breaking is just an event', () => {
    const { w, events } = world()
    w.add('r', rig, origin)
    w.damage('r', 'pane', 10, 'glass')
    expect(events.some((e) => e.type === 'damage' && e.target === 'pane' && e.destroyed)).toBe(true)
    expect(events.some((e) => e.type === 'explosion' || e.type === 'leak')).toBe(false)
  })
})

describe('serialize / load', () => {
  function build() {
    const ctx = world({ seed: 9 })
    const { w } = ctx
    w.add('c', cabinet, { x: 1, y: 0, z: 1, ry: 0 })
    w.add('wall', { type: 'wall', sockets: [{ id: 's', pos: [0, 0.3, 0], circuit: 'k' }] }, origin)
    w.add('tv', { type: 'tv', devices: [{ id: 'tv', kind: 'screen', watts: 5, socket: 'auto', channels: 4 }] }, origin)
    w.add('bot', { type: 'b', parts: [{ id: 'valve', pivot: [0, 0, 0], motion: { kind: 'knob' } }], fuels: [{ id: 'gas', kind: 'gas', capacity: 13, valve: 'valve' }] }, { x: 1, y: 0, z: 0, ry: 0 })
    w.add('st', { type: 'st', burners: [{ id: 'b', pos: [0, 1, 0], fuel: 'auto', rate: 0.01 }], fixtures: [{ id: 'tap', kind: 'tap', outlet: [0, 1, 0] }], tanks: [{ id: 't', capacity: 10 }], damage: [{ target: 'self', kind: 'wood', hp: 9 }] }, origin)
    w.add('ch', { type: 'ch', seats: [{ id: 's', pose: 'sit', pos: [0, 0.4, 0], ry: 0, exit: [0, 0, 1] }] }, { x: 5, y: 0, z: 5, ry: 0 })
    return ctx
  }

  it('round trips exactly: load then serialize equals the input', () => {
    const { w } = build()
    w.setPart('c', 'door', 1, true)
    w.take('c', 'main', 0)
    w.act('tv:device.tv')
    w.act('tv:channel.tv')
    w.setPart('bot', 'valve', 1, true)
    w.act('st:burner.b')
    w.act('st:fixture.tap')
    w.update(2)
    w.damage('st', 'self', 4)
    w.power.setBreaker('k', false)
    w.sit('ch', 's', 'p1')
    w.water.setDefaultTank('st:t')
    const state = w.serialize()
    const copy = JSON.parse(JSON.stringify(state))
    const { w: w2 } = build()
    w2.load(copy)
    expect(w2.serialize()).toEqual(state)
  })

  it('restores gameplay state', () => {
    const { w } = build()
    w.setPart('c', 'door', 1, true)
    w.take('c', 'main', 0)
    w.power.setGrid(false)
    const state = w.serialize()
    const { w: w2 } = build()
    w2.load(state)
    expect(w2.partT('c', 'door')).toBe(1)
    expect(w2.contents('c', 'main')[0]).toBeNull()
    expect(w2.power.grid).toBe(false)
    expect(w2.accessible('c', 'main')).toBe(true)
  })

  it('serialize output is plain JSON and a deep copy', () => {
    const { w } = build()
    const state = w.serialize()
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
    state.objects.c.contents.main[0] = null
    expect(w.contents('c', 'main')[0]).not.toBeNull()
  })

  it('ignores objects that are not in the world', () => {
    const { w } = build()
    const state = w.serialize()
    state.objects.ghost = state.objects.c
    expect(() => w.load(state)).not.toThrow()
  })
})

describe('world basics', () => {
  it('rejects duplicate ids and lists objects', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    expect(() => w.add('c', cabinet, origin)).toThrow()
    expect(w.objects().map((o) => o.id)).toEqual(['c'])
    expect(w.get('c')?.parts).toEqual({ door: 0, drawer: 0 })
  })

  it('same seed and same adds give the same world', () => {
    const a = world({ seed: 'x' })
    const b = world({ seed: 'x' })
    for (const c of [a, b]) c.w.add('c', cabinet, origin)
    expect(a.w.serialize()).toEqual(b.w.serialize())
  })
})
