import { CALIBERS } from '@adatechnology/game-weapons'
import { describe, expect, it } from 'vitest'
import { buildFrame, createDestruction, piercingOf, sizeStructure } from '../src'
import type { DestructibleSpec, DestructionEvent, DestructionOptions, PartSpec } from '../src'

/**
 * What the beams and columns of a building do under bullets and blasts. The calibers are the ones of `@adatechnology/game-weapons` (energy
 * `m v^2 / 2` from its mass and muzzle speed, `piercing` from its kind); the elements are sized like real ones:
 * - reinforced concrete column 30 x 30 cm, 3 m, bars every 15 cm of 16 mm; reinforced concrete beam 25 x 40 cm, 4 m
 * - steel I-beam IPE 200 (22 kg/m, flange 8.5 mm), 4 m, as a box with the real mass and thickness
 * - hardwood beam 10 x 20 cm, 4 m; brick pillar 40 x 40 cm, 3 m
 */

const caliber = (id: string) => {
  const c = CALIBERS.find((x) => x.id === id)
  if (!c) throw new Error(`no caliber ${id}`)
  return { id, mm: c.diameter, grams: c.bulletGrams, pellets: c.pellets ?? 1, energy: 0.5 * (c.bulletGrams / 1000) * c.muzzleSpeed ** 2, piercing: piercingOf(id, c.kind) }
}
const SHOTS = {
  '.22 LR': caliber('22lr'), '9x19': caliber('9x19'), '.45 ACP': caliber('45acp'), '5.56x45': caliber('5_56x45'), '7.62x51': caliber('7_62x51'),
  '.50 BMG': caliber('50bmg'), '12ga slug': caliber('12ga_slug'), '12ga 00 buck': caliber('12ga_00buck'),
} as const
type ShotName = keyof typeof SHOTS

const REBAR = { material: 'steel', spacing: 0.15, diameter: 0.016, residualCapacity: 0.15 } as const
const ELEMENTS = {
  rc_column: { id: 'e', material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [0, 1.5, 0], structure: { role: 'column' }, reinforcement: REBAR, breach: { area: 0.25 } },
  rc_beam: { id: 'e', material: 'concrete', shape: { kind: 'box', size: [0.25, 0.4, 4] }, position: [0, 1.5, 0], structure: { role: 'beam' }, reinforcement: REBAR, breach: { area: 0.25 } },
  steel_ibeam: { id: 'e', material: 'steel', shape: { kind: 'box', size: [0.1, 0.2, 4] }, position: [0, 1.5, 0], structure: { role: 'beam' }, mass: 88, thickness: 0.0085 },
  wood_beam: { id: 'e', material: 'wood_hard', shape: { kind: 'box', size: [0.1, 0.2, 4] }, position: [0, 1.5, 0], structure: { role: 'beam' } },
  brick_pillar: { id: 'e', material: 'brick', shape: { kind: 'box', size: [0.4, 3, 0.4] }, position: [0, 1.5, 0], structure: { role: 'column' } },
} satisfies Record<string, PartSpec>
type ElementName = keyof typeof ELEMENTS

const isBeam = (name: ElementName) => name.endsWith('beam')
/** Fire along -x at the middle of the element, from 3 m. `n` shots a hair apart; a shotgun shell throws all its pellets. */
const fire = (world: ReturnType<typeof createDestruction>, name: ElementName, shot: ShotName, n = 1) => {
  const s = SHOTS[shot]
  const out: DestructionEvent[] = []
  let through = 0
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < s.pellets; i++) {
      const y = 1.5 + (i + k * 0.37) * 0.004 - 0.016
      const r = world.shoot([3, y, isBeam(name) ? 0.2 : 0], [-1, 0, 0], s.energy, s.mm, 'test', s.piercing)
      if (r[0]?.penetrated) through++
      for (const x of r) out.push(...x.events)
    }
  }
  return { events: out, through }
}
const single = (name: ElementName, options: DestructionOptions = {}) => {
  const world = createDestruction({ seed: 1, ...options })
  const id = world.add({ parts: [ELEMENTS[name]] })
  const events: DestructionEvent[] = []
  world.on('*', (e) => events.push(e))
  return { world, id, events, part: () => world.part(id, 'e')! }
}
const types = (events: readonly DestructionEvent[]) => new Set(events.map((e) => e.type))
const hpShare = (p: { hp: number; maxHp: number }) => p.hp / p.maxHp

describe('shots: reinforced concrete', () => {
  it.each(['rc_column', 'rc_beam'] as const)('%s: a pistol only chips and cracks the surface, forty rounds do not expose the bars', (name) => {
    for (const shot of ['.22 LR', '9x19', '.45 ACP'] as const) {
      const s = single(name)
      const r = fire(s.world, name, shot, 40)
      expect(r.through).toBe(0)
      expect(hpShare(s.part())).toBeGreaterThan(0.9)
      expect(s.part().stripped).toBeFalsy()
      expect(types(s.events).has('expose')).toBe(false)
      expect(s.part().status).toBe('damaged')
      expect(s.part().cracks.length).toBeGreaterThan(0)
      expect(types(s.events).has('debris')).toBe(true)
    }
  })

  it('a rifle or a slug does not go through the column either', () => {
    for (const shot of ['5.56x45', '7.62x51', '12ga slug', '12ga 00 buck'] as const) {
      const s = single('rc_column')
      expect(fire(s.world, 'rc_column', shot, 10).through).toBe(0)
      expect(s.part().stripped).toBeFalsy()
    }
  })

  it('a .50 BMG goes through, and enough of them chip the concrete off: the bars show and the bare cage stays', () => {
    const s = single('rc_column')
    expect(fire(s.world, 'rc_column', '.50 BMG', 1).through).toBe(1)
    expect(s.part().holes.length).toBe(1)
    let shots = 1
    while (!s.part().stripped && shots < 80) {
      fire(s.world, 'rc_column', '.50 BMG', 1)
      shots++
    }
    expect(shots).toBeGreaterThan(10)
    expect(shots).toBeLessThan(60)
    expect(s.part().stripped).toBe(true)
    expect(s.part().status).toBe('damaged')
    expect(s.part().stage).toBe(3)
    expect(types(s.events).has('expose')).toBe(true)
    expect(types(s.events).has('fracture')).toBe(true)
    expect(s.part().mass).toBeLessThan(40)
    // the cage lets bullets through and keeps standing until something finishes it
    expect(fire(s.world, 'rc_column', '9x19', 1).through).toBe(1)
    expect(s.part().status).not.toBe('broken')
  })

  it('a hand grenade at 1 m does not cut a column (reach 0.12 m per cbrt kJ, always on); at contact it strips it', () => {
    const grenade = { energy: 200000, radius: 15 }
    const far = single('rc_column')
    far.world.explode([1, 1.5, 0], grenade.energy, grenade.radius)
    expect(far.part().stripped).toBeFalsy()
    expect(far.part().stage ?? 0).toBeLessThanOrEqual(1)
    const near = single('rc_column')
    near.world.explode([0.2, 1.5, 0], grenade.energy, grenade.radius)
    expect(near.part().stripped).toBe(true)
    expect(types(near.events).has('expose')).toBe(true)
  })
})

describe('shots: steel I-beam', () => {
  it('pistols and the soft-core rimfire and 5.56 dent it and do not pierce it', () => {
    for (const shot of ['.22 LR', '9x19', '.45 ACP', '5.56x45'] as const) {
      const s = single('steel_ibeam')
      expect(fire(s.world, 'steel_ibeam', shot, 5).through).toBe(0)
      expect(s.part().dents.length).toBeGreaterThan(0)
      expect(s.part().holes.length).toBe(0)
      expect(hpShare(s.part())).toBeGreaterThan(0.99)
      expect(s.part().status).not.toBe('broken')
    }
  })

  it('a 12 ga slug (soft lead) and buckshot do not pierce it, a .50 BMG does', () => {
    for (const shot of ['12ga slug', '12ga 00 buck'] as const) {
      const s = single('steel_ibeam')
      expect(fire(s.world, 'steel_ibeam', shot, 3).through).toBe(0)
    }
    const s = single('steel_ibeam')
    expect(fire(s.world, 'steel_ibeam', '.50 BMG').through).toBe(1)
    expect(s.part().holes[0]!.through).toBe(true)
    expect(s.part().status).not.toBe('broken')
  })

  it('without the piercing factor a slug would go through (the old energy-only rule)', () => {
    const s = single('steel_ibeam')
    const slug = SHOTS['12ga slug']
    const r = s.world.shoot([3, 1.5, 0.2], [-1, 0, 0], slug.energy, slug.mm)
    expect(r[0]!.penetrated).toBe(true)
  })

  it('a grenade or C4 at 1 m dents it and leaves it standing', () => {
    for (const energy of [200000, 345600]) {
      const s = single('steel_ibeam')
      s.world.explode([1, 1.5, 0], energy, 15)
      expect(s.part().dents.length).toBeGreaterThan(0)
      expect(hpShare(s.part())).toBeGreaterThan(0.95)
      expect(s.part().status).not.toBe('broken')
    }
  })
})

describe('shots: wooden beam and brick pillar', () => {
  it('a wooden beam is pierced by rifle rounds and splinters; a pistol stays in it', () => {
    for (const shot of ['9x19', '.45 ACP'] as const) {
      const s = single('wood_beam')
      expect(fire(s.world, 'wood_beam', shot, 5).through).toBe(0)
      expect(s.part().holes.length).toBe(5)
    }
    for (const shot of ['5.56x45', '7.62x51', '.50 BMG', '12ga slug'] as const) {
      const s = single('wood_beam')
      expect(fire(s.world, 'wood_beam', shot, 1).through).toBe(1)
      expect(s.events.some((e) => e.type === 'debris' && e.kind === 'splinters')).toBe(true)
    }
  })

  it('and breaks into splinters under enough .50 rounds', () => {
    const s = single('wood_beam')
    let shots = 0
    while (s.part().status !== 'broken' && shots < 80) {
      fire(s.world, 'wood_beam', '.50 BMG', 1)
      shots++
    }
    expect(s.part().status).toBe('broken')
    const fracture = s.events.find((e) => e.type === 'fracture')
    expect(fracture && fracture.type === 'fracture' && fracture.style).toBe('splinter')
  })

  it('a brick pillar stops a 7.62 (crack, chips) and is pierced by a .50 BMG', () => {
    const a = single('brick_pillar')
    expect(fire(a.world, 'brick_pillar', '7.62x51', 3).through).toBe(0)
    expect(a.part().cracks.length).toBeGreaterThan(0)
    const b = single('brick_pillar')
    expect(fire(b.world, 'brick_pillar', '.50 BMG', 1).through).toBe(1)
  })
})

describe('a framed building', () => {
  /** Two floors of reinforced concrete columns and beams, sized so every structural part rests at 65% of its capacity. */
  const frame = (options: DestructionOptions = {}) => {
    const raw = buildFrame({ floors: 2 })
    const spec: DestructibleSpec = {
      ...raw,
      parts: raw.parts.map((p) => (p.id.startsWith('column') || p.id.startsWith('beam') ? { ...p, reinforcement: REBAR, breach: { area: 0.25 } } : p)),
    }
    const world = createDestruction({ seed: 5, ...options })
    const id = world.add(sizeStructure(spec, { safety: 0.65 }))
    const events: DestructionEvent[] = []
    world.on('*', (e) => events.push(e))
    const stress = (pid: string) => world.part(id, pid)!.stress ?? 0
    /** A blow at the face of a column that its concrete cannot take (columns are on a 4 m grid, floors 3.2 m apart). */
    const lose = (pid: string) => {
      const [, floor, i, j] = pid.split('_').map(Number)
      return world.hitPart(id, pid, { type: 'blunt', point: [-4 + 4 * i! + 0.15, 1.5 + 3.2 * floor!, -4 + 4 * j!], direction: [-1, 0, 0], energy: 1e8, radius: 0.05 })
    }
    const run = (seconds: number) => {
      for (let t = 0; t < seconds; t += 0.25) world.update(0.25)
    }
    return { world, id, events, stress, lose, run }
  }

  it('starts at the stress it was sized for', () => {
    const f = frame()
    expect(f.stress('column_0_1_1')).toBeCloseTo(0.65, 2)
    expect(f.stress('beam_x_0_0_1')).toBeCloseTo(0.65, 2)
  })

  it('a bare cage keeps its residual capacity: the column carries on at a fraction of its strength', () => {
    const f = frame()
    f.lose('column_0_0_0')
    const p = f.world.part(f.id, 'column_0_0_0')!
    expect(p.stripped).toBe(true)
    expect(p.status).not.toBe('broken')
    // the load is the same, the capacity is 15%: the stress is above 1 and it gives way in seconds
    expect(f.stress('column_0_0_0')).toBeGreaterThan(1)
    f.run(10)
    expect(f.world.part(f.id, 'column_0_0_0')!.status).toBe('broken')
  })

  it('losing a column passes its load on to the others', () => {
    const f = frame()
    const before = f.stress('column_0_1_0')
    f.lose('column_0_1_1')
    f.run(10)
    expect(f.world.part(f.id, 'column_0_1_1')!.status).toBe('broken')
    expect(f.stress('column_0_1_0')).toBeGreaterThan(before)
    expect(f.stress('column_0_0_1')).toBeGreaterThan(before)
    expect(f.stress('column_0_0_0')).toBeCloseTo(before, 2)
  })

  it('losing two neighbouring columns overloads the rest and can bring the floor down', () => {
    const f = frame()
    f.lose('column_0_1_1')
    f.lose('column_0_1_0')
    f.run(30)
    const gone = [...f.world.state(f.id)!.parts].filter((p) => p.status === 'broken' || p.status === 'collapsed').length
    expect(gone).toBeGreaterThan(2)
    expect(f.events.some((e) => e.type === 'stress')).toBe(true)
    expect(f.events.some((e) => e.type === 'collapse')).toBe(true)
  })

  it('rifle fire at a column does not bring the building down', () => {
    const f = frame()
    for (let i = 0; i < 60; i++) f.world.hitPart(f.id, 'column_0_1_1', { type: 'ballistic', point: [0.15, 1.5, 0.1], direction: [-1, 0, 0], energy: SHOTS['7.62x51'].energy, caliber: 7.8, piercing: 1 })
    f.run(10)
    expect(f.world.part(f.id, 'column_0_1_1')!.status).not.toBe('broken')
    expect(f.events.some((e) => e.type === 'collapse')).toBe(false)
  })
})

describe('blasts next to a column', () => {
  const column = (x: number): PartSpec => ({ ...ELEMENTS.rc_column, id: 'column', position: [x, 1.5, 0] })
  const crate = (x: number): PartSpec => ({ id: 'box', material: 'wood_soft', shape: { kind: 'box', size: [0.5, 0.5, 0.5] }, position: [x, 0.25, 0] })

  it('shelter: a column between the blast and a crate takes the blast first and passes on a few percent', () => {
    const world = createDestruction({ seed: 2 })
    world.add({ parts: [column(0)] }, { id: 'pillar' })
    world.add({ parts: [crate(2)] }, { id: 'crate' })
    world.add({ parts: [crate(-2)] }, { id: 'open' })
    const hits = world.explode([-1.5, 0.8, 0], 100000, 8, 'test', { shelter: true })
    const k = (id: string) => hits.find((h) => h.object === id)!.blast!.shelter
    expect(k('open')).toBeGreaterThan(0.99)
    expect(k('crate')).toBeLessThan(0.1)
    expect(hits.find((h) => h.object === 'crate')!.damage).toBeLessThan(hits.find((h) => h.object === 'open')!.damage * 0.1)
    expect(world.part('pillar', 'column')!.hp).toBeLessThan(world.part('pillar', 'column')!.maxHp)
    // a crate beside the column, off the line, is not covered
    const beside = createDestruction({ seed: 2 })
    beside.add({ parts: [column(0)] }, { id: 'pillar' })
    beside.add({ parts: [{ ...crate(2), position: [2, 0.25, 3] }] }, { id: 'side' })
    expect(beside.explode([-1.5, 0.8, 3], 100000, 8, 'test', { shelter: true }).find((h) => h.object === 'side')!.blast!.shelter).toBeGreaterThan(0.99)
  })

  /** A basement 6 x 3 x 6 m under a slab, columns inside, closed or with a stairwell opening in the slab and a door in a wall. */
  const basement = (open: boolean): DestructibleSpec => {
    const t = 0.25
    const parts: PartSpec[] = [
      { id: 'floor', material: 'concrete', shape: { kind: 'box', size: [6.5, t, 6.5] }, position: [0, -t / 2, 0] },
      { id: 'w1', material: 'concrete', shape: { kind: 'box', size: [t, 3, 6.5] }, position: [3.125, 1.5, 0] },
      { id: 'w2', material: 'concrete', shape: { kind: 'box', size: [t, 3, 6.5] }, position: [-3.125, 1.5, 0] },
      { id: 'w3', material: 'concrete', shape: { kind: 'box', size: [6.5, 3, t] }, position: [0, 1.5, 3.125] },
      { ...ELEMENTS.rc_column, id: 'c1', position: [-1.5, 1.5, -1.5] },
      { ...ELEMENTS.rc_column, id: 'c2', position: [1.5, 1.5, 1.5] },
    ]
    if (!open) {
      parts.push({ id: 'w4', material: 'concrete', shape: { kind: 'box', size: [6.5, 3, t] }, position: [0, 1.5, -3.125] })
      parts.push({ id: 'slab', material: 'concrete', shape: { kind: 'box', size: [6.5, t, 6.5] }, position: [0, 3 + t / 2, 0] })
    }
    return { parts }
  }
  const damageOnColumns = (open: boolean, call: { confinement: boolean } | undefined) => {
    const world = createDestruction({ seed: 2 })
    const id = world.add(basement(open))
    const events: DestructionEvent[] = []
    world.on('*', (e) => events.push(e))
    world.explode([0, 1, 0], 150000, 10, 'test', call)
    void id
    // hit points taken, from the events: a column stripped of its concrete gets its cage's hit points back
    const taken = events.reduce((sum, e) => sum + (e.type === 'damage' && (e.part === 'c1' || e.part === 'c2') ? e.amount : 0), 0)
    const mult = events.find((e) => e.type === 'blast')
    return { columns: taken, mult: mult && mult.type === 'blast' ? mult.confinement : 1 }
  }

  it('confinement: the same blast in a closed basement hurts the columns more than in the open', () => {
    const plain = damageOnColumns(false, undefined)
    const closed = damageOnColumns(false, { confinement: true })
    const open = damageOnColumns(true, { confinement: true })
    expect(plain.mult).toBe(1)
    expect(closed.mult).toBeGreaterThan(2)
    expect(open.mult).toBeLessThan(closed.mult)
    expect(closed.columns).toBeGreaterThan(plain.columns * 1.5)
    expect(open.columns).toBeLessThan(closed.columns)
  })
})
