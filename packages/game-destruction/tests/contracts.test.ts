import { describe, expect, it } from 'vitest'
import { checkDestructible, checkHit, createDestruction } from '../src'
import type { DestructibleImpl, DestructibleSpec, DestructionEvent, Hit, ObjectState } from '../src'
import { chair } from './helpers'

/** A fake vehicle door that only dents. */
const fakeDoor = (id = 'door_a'): DestructibleImpl & { dents: number } => {
  const spec: DestructibleSpec = { name: 'door', parts: [{ id: 'panel', material: 'steel', shape: { kind: 'box', size: [1, 0.02, 1] }, position: [0, 0.1, 0] }] }
  const impl = {
    id: id,
    dents: 0,
    describe: () => spec,
    hit(hit: Hit): DestructionEvent[] {
      impl.dents++
      return [
        { type: 'dent', object: id, time: 0, part: 'panel', dent: { point: [0, 0, 0], normal: [0, 1, 0], radius: 0.03, depth: 0.01 }, worldPoint: hit.point },
        { type: 'damage', object: id, time: 0, part: 'panel', amount: 1, hp: 99, damageType: hit.type },
      ]
    },
    update: () => [] as DestructionEvent[],
    state(): ObjectState {
      return {
        id, position: [0, 0, 0], rotation: [0, 0, 0, 1], groups: [['panel']], destroyed: false, joints: [],
        parts: [{ id: 'panel', material: 'steel', status: 'damaged', hp: 99, maxHp: 100, mass: 10, temperature: 20, burning: false, fuel: 0, char: 0, melt: 0, dents: [], holes: [], cracks: [], group: 0 }],
      }
    },
    reset() {
      impl.dents = 0
    },
    serialize: () => ({ dents: impl.dents }),
    load(d: unknown) {
      impl.dents = (d as { dents: number }).dents
    },
  }
  return impl
}

describe('contracts', () => {
  it('hosts an impl next to a default object: shoot passes through both in order, events reach listeners', () => {
    const w = createDestruction()
    const c = w.add(chair())
    const door = fakeDoor()
    expect(w.register(door)).toBe('door_a')
    expect(w.ids()).toEqual([c, 'door_a'])
    const seen: string[] = []
    w.on('*', (e) => seen.push(`${e.object}:${e.type}`))
    const res = w.shoot([0, 2, 0], [0, -1, 0], 500, 9)
    expect(res.map((r) => r.object)).toEqual([c, 'door_a'])
    expect(res[0].penetrated).toBe(true)
    expect(res[1].part).toBe('panel')
    expect(res[1].penetrated).toBe(false)
    expect(seen.indexOf(`${c}:hole`)).toBeLessThan(seen.indexOf('door_a:dent'))
    expect(w.raycast([0, 2, 0], [0, -1, 0])!.object).toBe(c)
    expect(w.raycast([0, 2, 0.4], [0, -1, 0])!.object).toBe('door_a')
    expect(door.dents).toBe(1)
    expect(w.state('door_a')!.parts[0].id).toBe('panel')
    expect(w.part('door_a', 'panel')!.hp).toBe(99)
  })

  it('routes hit, explode, update, transform, reset, serialize and remove to the impl', () => {
    const w = createDestruction()
    const door = fakeDoor()
    w.register(door, { position: [10, 0, 0] })
    expect(w.raycast([10, 2, 0], [0, -1, 0])!.object).toBe('door_a')
    expect(w.raycast([0, 2, 0], [0, -1, 0])).toBeNull()
    const r = w.hit('door_a', { type: 'blunt', point: [10, 0.1, 0], energy: 100 })
    expect(r.events.map((e) => e.type)).toEqual(['dent', 'damage'])
    expect(r.damage).toBe(1)
    expect(w.explode([10, 1, 0], 1000, 3).length).toBe(1)
    expect(w.explode([50, 1, 0], 1000, 3).length).toBe(0)
    w.setTransform('door_a', [0, 0, 0], [0, 0, 0, 1])
    expect(w.raycast([0, 2, 0], [0, -1, 0])!.object).toBe('door_a')
    const snap = JSON.parse(JSON.stringify(w.serialize()))
    expect(snap.impls[0].data.dents).toBe(2)
    door.dents = 0
    w.load(snap)
    expect(door.dents).toBe(2)
    w.reset('door_a')
    expect(door.dents).toBe(0)
    expect(w.disassemble('door_a', 'screw' as never, 'hand', 0.1)).toBe(-1)
    expect(() => w.splitGroup('door_a', 0)).toThrow(/cannot be split/)
    expect(w.update(0.1)).toEqual([])
    w.remove('door_a')
    expect(w.has('door_a')).toBe(false)
    expect(() => w.register(fakeDoor(), { id: 'x' })).not.toThrow()
    expect(() => w.register(fakeDoor(), { id: 'x' })).toThrow(/already exists/)
  })

  it('checkDestructible passes a good impl and reports problems of a broken one', () => {
    const ok = checkDestructible(fakeDoor())
    expect(ok.problems).toEqual([])
    expect(ok.ok).toBe(true)
    const bad: DestructibleImpl = {
      id: 'bad',
      describe: () => ({
        parts: [
          { id: 'a', material: 'unobtainium', shape: { kind: 'box', size: [1, 1, 1] }, position: [0, 0, 0] },
          { id: 'a', material: 'steel', shape: { kind: 'box', size: [1, 1, 1] }, position: [0, 0, 0] },
        ],
        joints: [{ a: 'a', b: 'zzz', kind: 'screw' }],
      }),
      hit: () => [{ type: 'damage', object: 'other', time: 0, part: 'ghost', amount: Infinity, hp: -5, damageType: 'ballistic' }],
      update: () => 'nope' as unknown as DestructionEvent[],
      state: () => ({ id: 'bad', position: [0, 0, 0], rotation: [0, 0, 0, 1], groups: [], destroyed: false, joints: [], parts: [{ id: 'b', material: 'steel', status: 'intact', hp: -1, maxHp: 1, mass: 1, temperature: 20, burning: false, fuel: 0, char: 0, melt: 0, dents: [], holes: [], cracks: [], group: 0 }] }),
    }
    const r = checkDestructible(bad)
    expect(r.ok).toBe(false)
    const text = r.problems.join('\n')
    expect(text).toMatch(/duplicate part id "a"/)
    expect(text).toMatch(/unknown material "unobtainium"/)
    expect(text).toMatch(/unknown part/)
    expect(text).toMatch(/expected "bad"/)
    expect(text).toMatch(/negative or invalid hp/)
    expect(text).toMatch(/update\(\) must return an array/)
    expect(text).toMatch(/not a finite number/)
    expect(checkDestructible(bad, { materials: ['unobtainium'] }).problems.join()).not.toMatch(/unknown material/)
  })

  it('checkHit validates the impact contract', () => {
    expect(checkHit({ type: 'ballistic', point: [0, 0, 0], direction: [0, 0, 1], energy: 500, caliber: 9 })).toEqual([])
    expect(checkHit({ type: 'ballistic', point: [0, 0, 0], energy: 500 }).length).toBe(2)
    expect(checkHit({ type: 'fire', point: [0, 0, 0], temperature: 900, radius: 1 })).toEqual([])
    expect(checkHit({ type: 'explosive', point: [0, 0, 0], energy: 10 }).length).toBe(1)
  })
})
