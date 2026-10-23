import { describe, expect, it } from 'vitest'
import type { ObjectSpec } from '../src'
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

describe('requires closing', () => {
  it('closing the required part closes the dependent part with it, even after the door passes the gate', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    w.setPart('c', 'door', 1, true)
    w.setPart('c', 'drawer', 1, true)
    expect(w.partT('c', 'drawer')).toBe(1)
    w.setPart('c', 'door', 0)
    run(w, 2)
    expect(w.partT('c', 'door')).toBe(0)
    expect(w.partT('c', 'drawer')).toBe(0)
    expect(w.accessible('c', 'inner')).toBe(false)
  })

  it('a pending open of the dependent is cancelled when the required part closes', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    w.setPart('c', 'drawer', 1) // waits for the door
    w.setPart('c', 'door', 1, true)
    w.setPart('c', 'door', 0, true)
    run(w, 2)
    expect(w.partT('c', 'drawer')).toBe(0)
  })

  it('instant close of the door closes the drawer at once and the drawer cannot be toggled while the door is shut', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    w.setPart('c', 'door', 1, true)
    w.setPart('c', 'drawer', 1, true)
    w.setPart('c', 'door', 0, true)
    expect(w.partT('c', 'drawer')).toBe(0)
    expect(w.act('c:part.drawer')).toBe(false)
  })
})

describe('fitSweep with part bounds', () => {
  const door: ObjectSpec = {
    type: 'door',
    parts: [{ id: 'door', pivot: [-0.4, 0.5, 0.3], motion: { kind: 'hinge', angle: -1.7 }, bounds: [-0.4, 0, 0.28, 0.4, 1, 0.32] }],
  }
  const flap: ObjectSpec = {
    type: 'flap',
    parts: [{ id: 'flap', pivot: [0, 0.1, 0.3], motion: { kind: 'hinge', axis: [1, 0, 0], angle: 1.5 }, bounds: [-0.3, 0.1, 0.26, 0.3, 0.7, 0.34] }],
  }
  const at = (ry: number) => ({ x: 3, y: 0, z: -2, ry })
  const wallAt = (ry: number, pred: (lx: number, lz: number) => boolean) => (x: number, z: number) => {
    const dx = x - 3
    const dz = z + 2
    return pred(Math.cos(-ry) * dx + Math.sin(-ry) * dz, -Math.sin(-ry) * dx + Math.cos(-ry) * dz)
  }

  for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    it(`a wall flush with the hinge side blocks the slab, a 20 cm gap does not (ry ${ry.toFixed(2)})`, () => {
      const { w } = world()
      w.add('d', door, at(ry))
      expect(w.fitSweep('d', 'door', wallAt(ry, (lx) => lx < -0.4 - 1e-9))).toBe(0)
      w.add('e', door, { ...at(ry), x: 30 })
      const far = (x: number, z: number) => wallAt(ry, (lx) => lx < -0.6)(x - 27, z)
      expect(w.fitSweep('e', 'door', far)).toBe(1)
    })

    it(`a wall in front of a horizontal hinge clamps it and the slab stays clear (ry ${ry.toFixed(2)})`, () => {
      const { w } = world()
      w.add('f', flap, at(ry))
      const m = w.fitSweep('f', 'flap', wallAt(ry, (_lx, lz) => lz > 0.5))
      expect(m).toBeGreaterThan(0.05)
      expect(m).toBeLessThan(1)
      // independent check: the top edge of the leaf after rotating m * 1.5 rad about x stays at z <= 0.5
      const z = 0.3 + 0.6 * Math.sin(1.5 * m)
      expect(z).toBeLessThanOrEqual(0.5 + 0.34 - 0.3 + 1e-6)
      expect(w.fitSweep('f', 'flap', () => false)).toBe(1)
    })
  }
})
