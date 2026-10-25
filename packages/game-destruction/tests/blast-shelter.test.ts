import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { BlastOptions, DestructibleImpl, DestructibleSpec, DestructionEvent, DestructionOptions, Hit, PartSpec } from '../src'

/** A body for the world to host: one box part that records what hits it. */
const body = (id: string, at: [number, number, number]) => {
  const hits: Hit[] = []
  const spec: DestructibleSpec = { parts: [{ id: 'torso', material: 'leather', shape: { kind: 'box', size: [0.4, 1.7, 0.3] }, position: [at[0], at[1] + 0.85, at[2]] }] }
  const impl: DestructibleImpl = {
    id,
    describe: () => spec,
    hit(h) {
      hits.push(h)
      return [{ type: 'damage', object: id, time: 0, part: 'torso', amount: (h.energy ?? 0) * 0.001, hp: 100, damageType: h.type }]
    },
    state: () => ({ id, parts: [], joints: [], groups: [], destroyed: false }) as never,
  }
  return { impl, hits, energy: () => hits.filter((h) => h.type === 'explosive').reduce((s, h) => s + (h.energy ?? 0), 0), pushes: () => hits.filter((h) => h.type !== 'explosive') }
}

const slab = (id: string, material: string, size: [number, number, number], at: [number, number, number], extra: Partial<PartSpec> = {}): DestructibleSpec => ({
  parts: [{ id, material, shape: { kind: 'box', size }, position: at, ...extra }],
})

const BLAST = { energy: 200000, radius: 8 }
const centre: [number, number, number] = [0, 1, 0]

interface Scene { wall?: DestructibleSpec; options?: DestructionOptions; call?: BlastOptions; energy?: number; radius?: number }

/** Blast at the origin; a crate at z = 3.2 and a body at z = 3.6 stand behind the optional wall at z = 2. */
const run = ({ wall, options, call, energy = BLAST.energy, radius = BLAST.radius }: Scene) => {
  const world = createDestruction({ seed: 3, ...options })
  const events: DestructionEvent[] = []
  world.on('*', (e) => events.push(e))
  if (wall) world.add(wall, { id: 'wall' })
  const crate = world.add(slab('box', 'wood_soft', [0.5, 0.5, 0.5], [-1, 1, 3.2]), { id: 'crate' })
  const person = body('person', [1, 0, 3.6])
  world.register(person.impl)
  const results = world.explode(centre, energy, radius, 'test', call)
  const of = (id: string) => results.find((r) => r.object === id)
  return { world, events, results, of, crate, person }
}

const brick = (thickness = 0.2) => slab('wall', 'brick', [3, 2.4, thickness], [0, 1.2, 2])
const door = () => slab('wall', 'wood_soft', [3, 2.4, 0.04], [0, 1.2, 2])
const glass = () => slab('wall', 'glass', [3, 2.4, 0.006], [0, 1.2, 2])
const SHELTER = { shelter: true }

describe('blast: everything off', () => {
  it('a plain blast gives no blast report, no blast event and the same damage as before', () => {
    const a = run({ wall: brick() })
    expect(a.results.every((r) => r.blast === undefined)).toBe(true)
    expect(a.events.some((e) => e.type === 'blast' || e.type === 'fragment_hit')).toBe(false)
    const b = run({ wall: brick(), call: {} })
    expect(JSON.stringify(b.events)).toBe(JSON.stringify(a.events))
    expect(a.person.energy()).toBe(BLAST.energy)
  })
})

describe('blast: shelter', () => {
  it('a brick wall cuts the damage and the push on a crate and a body, and the blast event says by how much', () => {
    const open = run({ call: SHELTER })
    const shielded = run({ wall: brick(), call: SHELTER })
    expect(open.of('person')!.blast!.shelter).toBe(1)
    const k = shielded.of('person')!.blast!.shelter
    expect(k).toBeGreaterThan(0.1)
    expect(k).toBeLessThan(0.25)
    expect(shielded.person.energy()).toBeCloseTo(BLAST.energy * k, 3)
    expect(shielded.person.hits.find((h) => h.type === 'explosive')!.shelter).toBeCloseTo(k, 9)
    expect(shielded.of('crate')!.damage).toBeLessThan(open.of('crate')!.damage * 0.4)
    expect(shielded.of('crate')!.blast!.shelter).toBeLessThan(0.25)
    const ev = shielded.events.find((e) => e.type === 'blast')
    expect(ev && ev.type === 'blast' && ev.shelter.find((s) => s.object === 'person')!.factor).toBeCloseTo(k, 9)
    expect(shielded.world.part('wall', 'wall')!.status).not.toBe('broken')
  })

  it('without the option nothing changes behind the wall', () => {
    const plain = run({ wall: brick() })
    expect(plain.person.energy()).toBe(BLAST.energy)
    expect(plain.of('crate')!.blast).toBeUndefined()
  })

  it('a world default turns it on and a call can turn it off', () => {
    const on = run({ wall: brick(), options: { blast: SHELTER } })
    expect(on.of('person')!.blast!.shelter).toBeLessThan(0.25)
    const off = run({ wall: brick(), options: { blast: SHELTER }, call: { shelter: false } })
    expect(off.person.energy()).toBe(BLAST.energy)
  })

  it('orders the materials: glass lets most through, a wooden door about half, a brick wall little', () => {
    const t = (wall: DestructibleSpec) => run({ wall, call: SHELTER, energy: 2000, radius: 8 }).of('person')!.blast!.shelter
    const g = t(glass())
    const d = t(door())
    const b = t(brick())
    expect(g).toBeGreaterThan(d)
    expect(d).toBeGreaterThan(b)
    expect(g).toBeGreaterThan(0.75)
    expect(g).toBeLessThan(0.92)
    expect(d).toBeGreaterThan(0.45)
    expect(d).toBeLessThan(0.7)
    expect(b).toBeGreaterThan(0.1)
    expect(b).toBeLessThan(0.22)
  })

  it('k and damageScale.shelter are options', () => {
    const base = run({ wall: brick(), call: SHELTER }).of('person')!.blast!.shelter
    const stiff = run({ wall: brick(), call: { shelter: { k: 12000 } } }).of('person')!.blast!.shelter
    expect(stiff).toBeGreaterThan(base)
    const heavy = run({ wall: brick(), options: { materials: [{ ...createDestruction().materials.get('brick')!, damageScale: { shelter: 2 } }] }, call: SHELTER }).of('person')!.blast!.shelter
    expect(heavy).toBeCloseTo(base ** 2, 6)
  })

  it('a wall the same blast destroys still lets part of it through', () => {
    const thin = slab('wall', 'brick', [3, 2.4, 0.05], [0, 1.2, 2])
    const big = { energy: 1e7, radius: 10 }
    const broke = run({ wall: thin, call: SHELTER, ...big })
    expect(broke.world.part('wall', 'wall')!.status).toBe('broken')
    const k = broke.of('person')!.blast!.shelter
    const none = run({ call: SHELTER, ...big }).of('person')!.blast!.shelter
    const sealed = run({ wall: thin, call: { shelter: { brokenTransmission: 0 } }, ...big }).of('person')!.blast!.shelter
    const open = run({ wall: thin, call: { shelter: { brokenTransmission: 1 } }, ...big }).of('person')!.blast!.shelter
    expect(k).toBeGreaterThan(sealed)
    expect(k).toBeLessThan(none)
    expect(open).toBeCloseTo(none, 9)
    expect(k).toBeCloseTo(sealed + (1 - sealed) * 0.5, 9)
  })

  it('a wall that is already gone shelters nothing', () => {
    const w = run({ wall: slab('wall', 'brick', [3, 2.4, 0.05], [0, 1.2, 2]), call: SHELTER, energy: 1e7, radius: 10 })
    expect(w.world.part('wall', 'wall')!.status).toBe('broken')
    const again = w.world.explode(centre, 1e7, 10, 'test', SHELTER)
    expect(again.find((r) => r.object === 'person')!.blast!.shelter).toBe(1)
  })
})

describe('blast: fragment hits', () => {
  const frag = { shelter: true, fragmentHits: true }
  const thin = () => slab('wall', 'brick', [3, 2.4, 0.05], [0, 1.2, 2])

  it('the fragments of a wall the blast breaks reach what is behind it', () => {
    const r = run({ wall: thin(), call: frag, energy: 1e7, radius: 12 })
    expect(r.world.part('wall', 'wall')!.status).toBe('broken')
    const hits = r.events.filter((e) => e.type === 'fragment_hit')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.length).toBeLessThanOrEqual(24)
    const onPerson = r.person.pushes()
    expect(onPerson.length).toBeGreaterThan(0)
    expect(onPerson.every((h) => h.type === 'blunt' && (h.energy ?? 0) > 0)).toBe(true)
    expect(r.of('person')!.blast!.fragmentHits).toBe(onPerson.length)
    const ev = r.events.find((e) => e.type === 'blast')
    expect(ev && ev.type === 'blast' && ev.fragmentHits).toBe(hits.length)
  })

  it('is deterministic for a seed and changes with the seed', () => {
    const sig = (seed: number) => {
      const w = run({ wall: thin(), call: frag, energy: 1e7, radius: 12, options: { seed } })
      return JSON.stringify(w.events.filter((e) => e.type === 'fragment_hit'))
    }
    expect(sig(5)).toBe(sig(5))
    expect(sig(5)).not.toBe(sig(6))
  })

  it('respects the cap per blast', () => {
    const r = run({ wall: thin(), call: { ...frag, fragmentHits: { max: 3 } }, energy: 1e7, radius: 12 })
    expect(r.events.filter((e) => e.type === 'fragment_hit').length).toBeLessThanOrEqual(3)
  })

  it('off: no fragment reaches the body', () => {
    const r = run({ wall: thin(), call: SHELTER, energy: 1e7, radius: 12 })
    expect(r.person.pushes()).toHaveLength(0)
    expect(r.events.some((e) => e.type === 'fragment_hit')).toBe(false)
  })

  it('the hit can be ballistic with the fragment mass', () => {
    const r = run({ wall: thin(), call: { shelter: true, fragmentHits: { hitType: 'ballistic' } }, energy: 1e7, radius: 12 })
    const h = r.person.pushes()[0]!
    expect(h.type).toBe('ballistic')
    expect(h.mass).toBeGreaterThan(0)
  })
})

describe('blast: confinement', () => {
  const box = (open = false): DestructibleSpec => {
    const t = 0.2
    const parts: PartSpec[] = [
      { id: 'floor', material: 'concrete', shape: { kind: 'box', size: [6, t, 6] }, position: [0, -0.1, 0] },
      { id: 'roof', material: 'concrete', shape: { kind: 'box', size: [6, t, 6] }, position: [0, 3.1, 0] },
      { id: 'w1', material: 'concrete', shape: { kind: 'box', size: [t, 3, 6] }, position: [3.1, 1.5, 0] },
      { id: 'w2', material: 'concrete', shape: { kind: 'box', size: [t, 3, 6] }, position: [-3.1, 1.5, 0] },
      { id: 'w3', material: 'concrete', shape: { kind: 'box', size: [6, 3, t] }, position: [0, 1.5, 3.1] },
    ]
    if (!open) parts.push({ id: 'w4', material: 'concrete', shape: { kind: 'box', size: [6, 3, t] }, position: [0, 1.5, -3.1] })
    return { parts }
  }
  const mult = (spec: DestructibleSpec | null, call: BlastOptions = { confinement: true }) => {
    const world = createDestruction({ seed: 3 })
    if (spec) world.add(spec, { id: 'room' })
    world.explode([0, 1.5, 0], 1000, 4, 't', call)
    return (world.on as never) && 0
  }
  const measure = (spec: DestructibleSpec | null, call: BlastOptions = { confinement: true }) => {
    const world = createDestruction({ seed: 3 })
    const events: DestructionEvent[] = []
    world.on('*', (e) => events.push(e))
    if (spec) world.add(spec, { id: 'room' })
    const res = world.explode([0, 1.5, 0], 1000, 4, 't', call)
    const ev = events.find((e) => e.type === 'blast')
    return { res, mult: ev && ev.type === 'blast' ? ev.confinement : NaN, energy: ev && ev.type === 'blast' ? ev.energy : NaN }
  }
  void mult

  it('open ground gives 1, a closed room gives the most, a room with an opening in between', () => {
    const ground = measure(null)
    const closed = measure(box())
    const opened = measure(box(true))
    expect(ground.mult).toBe(1)
    expect(closed.mult).toBeGreaterThan(opened.mult)
    expect(opened.mult).toBeGreaterThan(ground.mult)
    expect(closed.mult).toBeGreaterThan(2)
    expect(closed.mult).toBeLessThanOrEqual(3)
    expect(closed.energy).toBeCloseTo(1000 * closed.mult, 6)
  })

  it('a closed room hurts its walls more than the same blast in the open', () => {
    const inside = measure(box())
    const outsideWorld = createDestruction({ seed: 3 })
    outsideWorld.add(box(), { id: 'room' })
    const plain = outsideWorld.explode([0, 1.5, 0], 1000, 4)
    expect(inside.res[0]!.damage).toBeGreaterThan(plain[0]!.damage)
    expect(inside.res[0]!.blast!.confinement).toBeCloseTo(inside.mult, 9)
  })

  it('the host can pass the multiplier itself, on the call or on the explosive hit', () => {
    const fixed = measure(null, { confinement: 2.5 })
    expect(fixed.mult).toBe(2.5)
    const world = createDestruction({ seed: 3 })
    const id = world.add(box(), { id: 'room' })
    const a = world.hit(id, { type: 'explosive', point: [0, 1.5, 0], energy: 1000, radius: 4, confinement: 2 })
    const b = createDestruction({ seed: 3 })
    b.add(box(), { id: 'room' })
    const c = b.hit('room', { type: 'explosive', point: [0, 1.5, 0], energy: 2000, radius: 4 })
    expect(a.damage).toBeCloseTo(c.damage, 9)
    expect(a.blast!.confinement).toBe(2)
  })

  it('is the same on every call for a seed', () => {
    expect(measure(box()).mult).toBe(measure(box()).mult)
  })

  it('the options set the gain, the exponent and the cap', () => {
    const base = measure(box()).mult
    expect(measure(box(), { confinement: { max: 1.2 } }).mult).toBeCloseTo(1.2, 9)
    expect(measure(box(), { confinement: { gain: 0.5 } }).mult).toBeLessThan(base)
  })
})
