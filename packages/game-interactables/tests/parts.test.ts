import { describe, expect, it } from 'vitest'
import { cabinet, origin, run, world } from './fixtures'

describe('parts', () => {
  it('animates toward the target at motion speed', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    w.setPart('c', 'door', 1)
    expect(w.partT('c', 'door')).toBe(0)
    w.update(0.2)
    expect(w.partT('c', 'door')).toBeCloseTo(0.5)
    run(w, 1)
    expect(w.partT('c', 'door')).toBe(1)
    expect(w.get('c')?.parts.door).toBe(1)
  })

  it('instant moves right away and emits part events', () => {
    const { w, events } = world()
    w.add('c', cabinet, origin)
    w.setPart('c', 'door', 1, true)
    expect(w.partT('c', 'door')).toBe(1)
    expect(events.some((e) => e.type === 'part' && e.part === 'door' && e.target === 1)).toBe(true)
  })

  it('honours requires: an inner drawer waits for the door', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    w.setPart('c', 'drawer', 1)
    run(w, 1)
    expect(w.partT('c', 'drawer')).toBe(0)
    w.setPart('c', 'door', 1, true)
    run(w, 1)
    expect(w.partT('c', 'drawer')).toBe(1)
  })

  it('toggle through the interaction refuses a gated part', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    expect(w.act('c:part.drawer')).toBe(false)
    expect(w.act('c:part.door')).toBe(true)
  })

  it('fitSweep clamps a hinged door against a wall', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    // a wall along z = 0.8 blocks the door once it swings out far enough
    const max = w.fitSweep('c', 'door', (_x, z) => z > 0.8)
    expect(max).toBeGreaterThan(0)
    expect(max).toBeLessThan(1)
    w.setPart('c', 'door', 1)
    run(w, 2)
    expect(w.partT('c', 'door')).toBeCloseTo(max)
  })

  it('fitSweep returns 1 in free space and 0 when blocked from the start', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    expect(w.fitSweep('c', 'door', () => false)).toBe(1)
    expect(w.fitSweep('c', 'door', () => true)).toBe(0)
    w.setPart('c', 'door', 1)
    run(w, 1)
    expect(w.partT('c', 'door')).toBe(0)
  })

  it('fitSweep clamps a drawer and keeps the limit afterwards', () => {
    const { w } = world()
    w.add('c', { ...cabinet, parts: [{ id: 'drawer', pivot: [0, 0.3, 0.3], motion: { kind: 'slide', axis: [0, 0, 1], distance: 0.4 }, sweep: [-0.3, 0.3, 0.3, 0.7] }] }, origin)
    const max = w.fitSweep('c', 'drawer', (_x, z) => z > 0.45)
    expect(max).toBeGreaterThan(0.3)
    expect(max).toBeLessThan(0.55)
    w.setPart('c', 'drawer', 1)
    run(w, 2)
    expect(w.partT('c', 'drawer')).toBeCloseTo(max)
  })

  it('fitSweep takes the object transform into account', () => {
    const { w } = world()
    w.add('c', cabinet, { x: 10, y: 0, z: 0, ry: Math.PI })
    // facing -z in world: the door swings toward z < 0
    expect(w.fitSweep('c', 'door', (_x, z) => z > 0.5)).toBe(1)
    expect(w.fitSweep('c', 'door', (_x, z) => z < -0.8)).toBeLessThan(1)
  })
})

describe('load keeps the fitSweep limit', () => {
  it('a loaded save cannot open a door past the wall found by fitSweep', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    const max = w.fitSweep('c', 'door', (_x, z) => z > 0.8)
    expect(max).toBeLessThan(1)
    const saved = w.serialize()
    w.load(saved)
    w.setPart('c', 'door', 1)
    run(w, 2)
    expect(w.partT('c', 'door')).toBeCloseTo(max)
    // a save made without the wall (t = 1) is clamped as well
    saved.objects.c.parts.door = 1
    w.load(saved)
    expect(w.partT('c', 'door')).toBeCloseTo(max)
  })
})

describe('part groups', () => {
  const blinds = {
    type: 'blinds',
    parts: [
      { id: 'tilt_1', pivot: [0, 1, 0] as [number, number, number], group: 'tilt', motion: { kind: 'hinge' as const, axis: [1, 0, 0] as [number, number, number], angle: 1.4 } },
      { id: 'tilt_2', pivot: [0, 1.1, 0] as [number, number, number], group: 'tilt', motion: { kind: 'hinge' as const, axis: [1, 0, 0] as [number, number, number], angle: 1.4 } },
      { id: 'raise', pivot: [0, 2, 0] as [number, number, number], motion: { kind: 'scale' as const, axis: [0, 1, 0] as [number, number, number], scale: 0.2 } },
    ],
    interactions: [
      { id: 'tilt', pos: [0, 1, 0] as [number, number, number], action: { do: 'toggle_part' as const, part: 'tilt_1' }, label: 'prompt.blinds' },
    ],
  }

  it('setPart on one member moves the whole group and leaves other parts alone', () => {
    const { w } = world()
    w.add('b', blinds, origin)
    w.setPart('b', 'tilt_2', 1)
    run(w, 1)
    expect(w.partT('b', 'tilt_1')).toBe(1)
    expect(w.partT('b', 'tilt_2')).toBe(1)
    expect(w.partT('b', 'raise')).toBe(0)
    w.setPart('b', 'tilt_1', 0, true)
    expect(w.partT('b', 'tilt_2')).toBe(0)
  })

  it('one toggle interaction opens and closes every member', () => {
    const { w } = world()
    w.add('b', blinds, origin)
    expect(w.act('b:tilt')).toBe(true)
    run(w, 1)
    expect(w.partT('b', 'tilt_2')).toBe(1)
    expect(w.act('b:tilt')).toBe(true)
    run(w, 1)
    expect(w.partT('b', 'tilt_1')).toBe(0)
    expect(w.partT('b', 'tilt_2')).toBe(0)
  })

  it('emits one part event per member and survives serialize/load', () => {
    const { w, events } = world()
    w.add('b', blinds, origin)
    w.setPart('b', 'tilt_1', 1, true)
    const ids = events.filter((e) => e.type === 'part' && e.target === 1).map((e) => (e as { part: string }).part)
    expect(ids.sort()).toEqual(['tilt_1', 'tilt_2'])
    const s = w.serialize()
    w.setPart('b', 'tilt_1', 0, true)
    w.load(s)
    expect(w.partT('b', 'tilt_2')).toBe(1)
  })
})
