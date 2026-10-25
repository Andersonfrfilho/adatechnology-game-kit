import { describe, expect, it } from 'vitest'
import {
  MATERIALS, bearingWallThickness, bendGeometry, blastImpulse, buildFrame, crackingMoment, createDestruction, elasticEnergy, impulseEnergy, momentOfEnergy,
  sizeRebar, slendernessFactor, spanOf, steelMoment,
} from '../src'
import type { DestructibleSpec, DestructionEvent, JointSpec, PartSpec, Vec3 } from '../src'

/**
 * Real structure (design/T10-estrutura-real.md): concrete cracks in tension and the steel carries the pull (a beam without steel snaps), and bearing
 * masonry is limited by the height it carries (the ground floor crushes first). The numbers in the comments are the hand calculation the test checks.
 */

const brick = MATERIALS.find((m) => m.id === 'brick')!
const G = 9.81
const run = (world: ReturnType<typeof createDestruction>, seconds: number, dt = 0.1) => {
  const out: DestructionEvent[] = []
  for (let t = 0; t < seconds - 1e-9; t += dt) out.push(...world.update(dt))
  return out
}
const ofType = <T extends DestructionEvent['type']>(events: readonly DestructionEvent[], type: T) =>
  events.filter((e): e is Extract<DestructionEvent, { type: T }> => e.type === type)

describe('formulas', () => {
  it('cracking moment of a rectangular section: alpha fct b h^2 / 6 (NBR 6118 17.3.1)', () => {
    // C25: fctm = 0.3 * 25^(2/3) = 2.56 MPa; 25 x 40 cm: 1.5 * 2.56 MPa * 0.25 * 0.16 / 6 = 25.6 kN m
    expect(crackingMoment(2.56, 0.25, 0.4)).toBeCloseTo(25600, 0)
    expect(0.3 * 25 ** (2 / 3)).toBeCloseTo(2.56, 2)
  })

  it('moment of the tension steel with the stress block of NBR 6118, and double reinforcement past x = 0.45 d', () => {
    // 1% of 25 x 36 cm of CA-50: T = 9e-4 * 500 MPa = 450 kN, x = T / (0.68 * 25 MPa * 0.25) = 0.106 m, M = T (d - 0.4 x) = 142.9 kN m
    expect(steelMoment(9e-4, 500, 0.36, 0.25, 25)).toBeCloseTo(450e3 * (0.36 - 0.4 * (450e3 / (0.68 * 25e6 * 0.25))), 0)
    // grows with the steel, without a jump at the ductility limit
    const xl = 0.45 * 0.36
    const atLimit = (0.68 * 25e6 * 0.25 * xl) / 500e6
    expect(steelMoment(atLimit * 1.0001, 500, 0.36, 0.25, 25)).toBeGreaterThan(steelMoment(atLimit, 500, 0.36, 0.25, 25))
    expect(steelMoment(atLimit * 1.0001, 500, 0.36, 0.25, 25) / steelMoment(atLimit, 500, 0.36, 0.25, 25)).toBeLessThan(1.001)
    expect(steelMoment(0, 500, 0.36, 0.25, 25)).toBe(0)
  })

  it('energy of a span and its inverse; the kinetic energy an impulse gives it (Biggs: KL 0.64, KM 0.5)', () => {
    const EI = 28e9 * (0.25 * 0.4 ** 3) / 12
    const U = elasticEnergy(25600, 4, EI)
    expect(momentOfEnergy(U, 4, EI)).toBeCloseTo(25600, 3)
    expect(impulseEnergy(100, 1000)).toBeCloseTo((0.64 * 100) ** 2 / (2 * 0.5 * 1000), 9)
  })

  it('blast impulse: Sadovsky incident impulse times a reflection that rises towards the charge', () => {
    // 1 kg TNT at 2 m (Z = 2): incident 200 * 1 / 2 = 100 Pa s, reflected (2 + 4 / 2) times = 400 Pa s
    expect(blastImpulse(1, 2)).toBeCloseTo(400, 6)
    // nearer than Z = 0.5 the impulse is held at Z = 0.5
    expect(blastImpulse(1, 0.1)).toBeCloseTo(blastImpulse(1, 0.5), 9)
    expect(blastImpulse(1, 4)).toBeLessThan(blastImpulse(1, 2) / 2)
  })

  it('slenderness of a masonry wall: (1 - 2 * 0.05) * (1 - (h / t / 40)^3) (NBR 16868-1)', () => {
    expect(slendernessFactor(2.8, 0.2)).toBeCloseTo(0.9 * (1 - (14 / 40) ** 3), 9)
    expect(slendernessFactor(2.8, 0.05)).toBe(0)
  })

  it('span from the supports: two walls, four corner columns (the long way), a cantilever (twice its length)', () => {
    const slab: PartSpec = { id: 's', material: 'concrete', shape: { kind: 'box', size: [4.4, 0.12, 6] }, position: [0, 0, 0], structure: { role: 'slab' } }
    const g = bendGeometry(slab)
    const box = (x0: number, x1: number, z0: number, z1: number): [Vec3, Vec3] => [[x0, -1, z0], [x1, 1, z1]]
    // walls 20 cm thick whose faces are 3.6 m apart
    expect(spanOf(g, [box(-2.2, -1.8, -3, 3), box(1.8, 2.2, -3, 3)])).toBeCloseTo(3.6, 6)
    const plate = bendGeometry({ ...slab, shape: { kind: 'box', size: [5, 0.2, 4] } })
    const corners = [box(-2.5, -2.2, -2, -1.7), box(2.2, 2.5, -2, -1.7), box(-2.5, -2.2, 1.7, 2), box(2.2, 2.5, 1.7, 2)]
    expect(spanOf(plate, corners)).toBeCloseTo(4.4, 6)
    const beam = bendGeometry({ ...slab, structure: { role: 'beam' }, shape: { kind: 'box', size: [3, 0.4, 0.2] } })
    expect(beam.member).toBe(true)
    expect(spanOf(beam, [box(-1.5, -0.5, -1, 1)])).toBeCloseTo(4, 6)
  })
})

/** A 4 m concrete beam of 25 x 40 cm on two reinforced columns. `ratio` is its tension steel (0: plain concrete). */
const portal = (ratio: number, extra: PartSpec[] = [], joints: JointSpec[] = [], hp?: number): DestructibleSpec => ({
  parts: ([
    { id: 'f0', material: 'concrete', shape: { kind: 'box', size: [0.8, 0.3, 0.8] }, position: [-2, -0.15, 0], structure: { role: 'foundation' } },
    { id: 'f1', material: 'concrete', shape: { kind: 'box', size: [0.8, 0.3, 0.8] }, position: [2, -0.15, 0], structure: { role: 'foundation' } },
    { id: 'c0', material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [-2, 1.5, 0], structure: { role: 'column', rebar: { ratio: 0.01 } } },
    { id: 'c1', material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [2, 1.5, 0], structure: { role: 'column', rebar: { ratio: 0.01 } } },
    { id: 'beam', material: 'concrete', shape: { kind: 'box', size: [4.3, 0.4, 0.25] }, position: [0, 3.2, 0], structure: { role: 'beam', rebar: { ratio } } },
    ...extra,
  ] as PartSpec[]).map((p) => (hp === undefined ? p : { ...p, hp })),
  joints: [
    { a: 'c0', b: 'f0', kind: 'rebar', bears: 'a_on_b' }, { a: 'c1', b: 'f1', kind: 'rebar', bears: 'a_on_b' },
    { a: 'beam', b: 'c0', kind: 'rebar', bears: 'a_on_b' }, { a: 'beam', b: 'c1', kind: 'rebar', bears: 'a_on_b' },
    ...joints,
  ],
})

const world = (spec: DestructibleSpec) => {
  const w = createDestruction({ seed: 3 })
  const id = w.add(spec)
  const events: DestructionEvent[] = []
  w.on('*', (e) => events.push(e))
  return { w, id, events, beam: () => w.part(id, 'beam')! }
}

/** 1 MJ is about 0.24 kg of TNT (4.184 MJ/kg), the charge of a hand grenade; 1 m under the beam. */
const GRENADE: { energy: number; at: Vec3 } = { energy: 1e6, at: [0, 2.2, 0] }

describe('reinforced concrete beam under a blast', () => {
  it('cracks on the tension face (the top: the blast pushes it up) and holds: the steel carries the pull', () => {
    const s = world(portal(0.01))
    s.w.explode(GRENADE.at, GRENADE.energy, 15)
    const beam = s.beam()
    expect(beam.cracked).toBe(true)
    expect(beam.status).toBe('damaged')
    const crack = ofType(s.events, 'crack').filter((e) => e.part === 'beam').at(-1)!
    expect(crack.worldPoint[1]).toBeCloseTo(3.4, 6)
    expect(crack.crack.normal[1]).toBeCloseTo(1, 6)
    expect(ofType(s.events, 'fracture')).toEqual([])
    expect(ofType([...s.events, ...run(s.w, 10)], 'collapse')).toEqual([])
    expect(s.beam().stress!).toBeLessThan(1)
  })

  it('the same beam without steel snaps in two: crack, then a snap fracture into large pieces', () => {
    const s = world(portal(0))
    s.w.explode(GRENADE.at, GRENADE.energy, 15)
    expect(s.beam().status).toBe('broken')
    const fracture = ofType(s.events, 'fracture').find((e) => e.part === 'beam')!
    expect(fracture.style).toBe('snap')
    const crackAt = s.events.findIndex((e) => e.type === 'crack' && e.part === 'beam' && e.crack.normal[1] > 0.9)
    expect(crackAt).toBeGreaterThanOrEqual(0)
    expect(crackAt).toBeLessThan(s.events.indexOf(fracture))
  })

  it('a charge far enough away leaves both standing and uncracked', () => {
    for (const ratio of [0, 0.01]) {
      const s = world(portal(ratio))
      s.w.explode([0, -2, 0], GRENADE.energy, 15)
      expect(s.beam().cracked).toBeFalsy()
      expect(s.beam().status).not.toBe('broken')
    }
  })

  it('blast after blast the steel yields and the beam gives way at 10 degrees of rotation: it hinges and falls in one piece', () => {
    // the concrete's hit points are set out of reach: this is about the steel. 30 MJ (7 kg of TNT) 1.5 m under it, each blast past the moment
    // of the steel adds (U(M) - U(Mu)) / (2 Mu) of rotation
    const s = world(portal(0.01, [], [], 1e12))
    let blasts = 0
    while (s.beam().status !== 'collapsed' && blasts < 200) {
      s.w.explode([0, 1.7, 0], 3e7, 15)
      blasts++
    }
    expect(blasts).toBeGreaterThan(3)
    expect(s.beam().cracked).toBe(true)
    expect(s.beam().status).toBe('collapsed')
    expect(ofType(s.events, 'collapse').some((e) => e.parts.includes('beam'))).toBe(true)
    expect(ofType(s.events, 'detach').some((e) => e.joint === 'beam~c0')).toBe(true)
  })

  it('flexure can be switched off: the beam is checked in compression only, as before', () => {
    const w = createDestruction({ seed: 3, structure: { flexure: { enabled: false } } })
    const id = w.add(portal(0))
    w.explode(GRENADE.at, GRENADE.energy, 15)
    expect(w.part(id, 'beam')!.cracked).toBeUndefined()
    expect(w.part(id, 'beam')!.flexure).toBeUndefined()
  })
})

describe('bending at rest', () => {
  /** A 10 t load resting on the middle of the beam (a heavy machine on a slab strip). */
  const loaded = (ratio: number) => portal(ratio, [
    { id: 'load', material: 'steel', shape: { kind: 'box', size: [1, 0.5, 0.25] }, position: [0, 3.65, 0], mass: 10000, structure: { role: 'slab' } },
  ], [{ a: 'load', b: 'beam', kind: 'resting', bears: 'a_on_b' }])

  it('plain concrete snaps under a load the steel of a reinforced beam carries', () => {
    // the load spread over the 4.3 m beam, 3.6 m between the faces of the columns: w = 11 t * g / 4.3 m = 25 kN/m, M = w L^2 / 8 = 41 kN m,
    // over Mcr 25.6 kN m; 1% of steel holds 147 kN m
    const plain = world(loaded(0))
    expect(plain.beam().flexure!).toBeGreaterThan(1)
    const ev = run(plain.w, 20)
    expect(plain.beam().status).toBe('broken')
    expect(ofType(ev, 'fracture').find((e) => e.part === 'beam')!.style).toBe('snap')
    const rc = world(loaded(0.01))
    expect(rc.beam().flexure!).toBeCloseTo(40.6 / 146.9, 2)
    expect(ofType(run(rc.w, 20), 'fracture')).toEqual([])
  })

  it('a wall standing right over its support does not bend the beam', () => {
    const over = portal(0, [{ id: 'w', material: 'brick', shape: { kind: 'box', size: [0.3, 2, 0.25] }, position: [-2, 4.4, 0], mass: 2000, structure: { role: 'wall' } }], [
      { a: 'w', b: 'beam', kind: 'mortar', bears: 'a_on_b' },
    ])
    const mid = structuredClone(over)
    mid.parts.find((p) => p.id === 'w')!.position = [0, 4.4, 0]
    const a = world(over), b = world(mid)
    expect(a.beam().load).toBeCloseTo(b.beam().load!, 6)
    expect(a.beam().flexure!).toBeLessThan(b.beam().flexure! / 2)
  })

  it('sizeRebar adds the steel a reinforced beam needs and leaves plain concrete plain', () => {
    const sized = sizeRebar(loaded(0.0015), { safety: 0.45 })
    const ratio = sized.parts.find((p) => p.id === 'beam')!.structure!.rebar!.ratio
    expect(ratio).toBeGreaterThan(0.0015)
    const w = createDestruction()
    const id = w.add(sized)
    expect(w.part(id, 'beam')!.flexure!).toBeCloseTo(0.45, 3)
    expect(sizeRebar(loaded(0)).parts.find((p) => p.id === 'beam')!.structure!.rebar!.ratio).toBe(0)
  })
})

/**
 * A tower of `storeys` storeys of two bearing brick walls (6 m long, `t` thick, 2.8 m high, 4.2 m apart) under 12 cm reinforced slabs that carry
 * 2.5 kPa of floor finish and use (NBR 6120, homes) on top of their weight.
 */
const tower = (storeys: number, thickness: (storey: number) => number = () => 0.19, height = 2.8): DestructibleSpec => {
  const parts: PartSpec[] = [{ id: 'ground', material: 'concrete', shape: { kind: 'box', size: [8, 0.5, 8] }, position: [0, -0.25, 0], structure: { role: 'foundation' }, hp: 1e12 }]
  const joints: JointSpec[] = []
  let y = 0
  let below = ['ground', 'ground']
  for (let k = 0; k < storeys; k++) {
    const t = thickness(k)
    for (const [side, x] of [['a', -2.1], ['b', 2.1]] as const) {
      parts.push({ id: `wall_${side}_${k}`, material: 'brick', shape: { kind: 'box', size: [t, height, 6] }, position: [x, y + height / 2, 0], structure: { role: 'wall' } })
      joints.push({ a: `wall_${side}_${k}`, b: below[side === 'a' ? 0 : 1]!, kind: 'mortar', bears: 'a_on_b' })
    }
    y += height
    const area = (4.2 + 0.5) * 6
    parts.push({
      id: `slab_${k}`, material: 'concrete', shape: { kind: 'box', size: [4.7, 0.12, 6] }, position: [0, y + 0.06, 0], mass: area * (0.12 * 2300 + 255),
      structure: { role: 'slab', rebar: { ratio: 0.004 } },
    })
    joints.push({ a: `slab_${k}`, b: `wall_a_${k}`, kind: 'mortar', bears: 'a_on_b' }, { a: `slab_${k}`, b: `wall_b_${k}`, kind: 'mortar', bears: 'a_on_b' })
    y += 0.12
    below = [`slab_${k}`, `slab_${k}`]
  }
  return { parts, joints }
}

describe('bearing masonry is limited by the height it carries', () => {
  /** Storeys a 19 cm wall carries before the ground floor crushes, by hand: fk t L slenderness over the load of one storey. */
  const threshold = (): number => {
    const slab = tower(1).parts.find((p) => p.id === 'slab_0')!
    const wallMass = 1900 * 0.19 * 2.8 * 6
    const perStorey = wallMass + slab.mass! / 2
    const capacity = (2.35e6 * 0.19 * 6 * slendernessFactor(2.8, 0.19)) / G
    return Math.floor(capacity / perStorey)
  }

  it('the ground floor of a tower of 19 cm brick walls crushes one storey past the hand threshold, and the rest comes down on it', () => {
    const n = threshold()
    // 2.35 MPa * 0.19 m * 6 m * 0.855 = 2.29 MN (233 t) per wall; each storey puts 6.1 t of wall and 7.5 t of floor on it: 17 storeys hold, 18 crush
    expect(n).toBeGreaterThanOrEqual(15)
    expect(n).toBeLessThanOrEqual(20)
    const holds = world(tower(n))
    expect(Math.max(...holds.w.state(holds.id)!.parts.map((p) => p.stress ?? 0))).toBeLessThan(1)
    expect(ofType(run(holds.w, 20), 'collapse')).toEqual([])

    const crushes = world(tower(n + 1))
    const walls = crushes.w.state(crushes.id)!.parts.filter((p) => p.id.startsWith('wall_'))
    const over = walls.filter((p) => p.stress! > 1).map((p) => p.id)
    expect(over.sort()).toEqual(['wall_a_0', 'wall_b_0'])
    const ev = run(crushes.w, 30)
    const first = ofType(ev, 'fracture')[0]!
    expect(first.part).toMatch(/^wall_[ab]_0$/)
    expect(first.style).toBe('crumble')
    expect(ofType(ev, 'collapse').flatMap((e) => e.parts)).toEqual(expect.arrayContaining([`slab_${n}`, 'wall_a_1']))
  })

  it('a 16-storey bearing brick building: 20 cm at the ground floor crushes; the walls a designer gives it (about 1.5 m at the base) hold', () => {
    // Monadnock Building (Chicago, 1891, 16 storeys of bearing brick): 1.8 m at the base. With NBR 6120 office floors (5 kPa of heavy floor plus
    // 2.5 kPa of use over 3.5 m of floor per wall: 26 kN/m), 3.75 m storeys, fk 2.35 MPa and the factors of NBR 8681 (1.4) and NBR 16868-1 (2.0):
    const walls = bearingWallThickness({ storeys: 16, storeyHeight: 3.75, floorLoad: 26e3, material: brick })
    expect(walls).toHaveLength(16)
    expect(walls[0]!).toBeGreaterThan(1.2)
    expect(walls[0]!).toBeLessThan(2.2)
    for (let k = 1; k < 16; k++) expect(walls[k]!).toBeLessThanOrEqual(walls[k - 1]!)
    expect(walls[15]!).toBeCloseTo(0.14, 6)
    // a house: four storeys or fewer need no more than the 14 cm minimum
    expect(bearingWallThickness({ storeys: 4, storeyHeight: 2.8, floorLoad: 11.5e3, material: brick }).every((t) => t <= 0.14 + 1e-9)).toBe(true)

    const heavy = (spec: DestructibleSpec) => {
      // the floors of the office building: 7.5 kPa over 7 m of floor between the two walls, on slabs with the steel for it (1.2%)
      for (const p of spec.parts) if (p.id.startsWith('slab_')) {
        p.mass = (2 * 26e3 * 6) / G
        p.structure = { role: 'slab', rebar: { ratio: 0.012 } }
      }
      return spec
    }
    const thin = world(heavy(tower(16, () => 0.2, 3.75)))
    expect(thin.w.part(thin.id, 'wall_a_0')!.stress!).toBeGreaterThan(1)
    const designed = world(heavy(tower(16, (k) => walls[k]!, 3.75)))
    const ground = designed.w.part(designed.id, 'wall_a_0')!.stress!
    // at rest the ground floor is at about 1 / (1.4 * 2.0) of its real strength
    expect(ground).toBeLessThan(0.5)
    expect(ground).toBeGreaterThan(0.25)
    expect(ofType(run(designed.w, 10), 'collapse')).toEqual([])
  })
})

describe('a reinforced concrete frame with partition walls', () => {
  /** Ten storeys of a frame whose walls are partitions (they close, the frame carries). */
  const frame = () => {
    const spec = buildFrame({ columnsX: 2, columnsZ: 2, spanX: 4, spanZ: 4, floors: 10, walls: true })
    for (const p of spec.parts) if (p.id.startsWith('wall_')) p.structure = { role: 'partition' }
    return spec
  }

  it('stands ten storeys where bearing brick of the same height would need far thicker walls', () => {
    const s = world(frame())
    const parts = s.w.state(s.id)!.parts
    expect(Math.max(...parts.map((p) => p.stress ?? 0))).toBeLessThan(1)
    expect(ofType(run(s.w, 10), 'collapse')).toEqual([])
  })

  it('a partition broken on the ground floor falls alone: the slab above stays', () => {
    const s = world(frame())
    const wall = s.w.state(s.id)!.parts.find((p) => p.id.startsWith('wall_x_0_'))!
    const spec = frame().parts.find((p) => p.id === wall.id)!
    s.w.hitPart(s.id, wall.id, { type: 'blunt', point: spec.position, energy: 3e6, radius: 0.05 })
    const ev = [...s.events, ...run(s.w, 20)]
    expect(['broken', 'collapsed']).toContain(s.w.part(s.id, wall.id)!.status)
    expect(ofType(ev, 'collapse').flatMap((e) => e.parts).filter((id) => !id.startsWith('wall_') && id !== 'door')).toEqual([])
    expect(s.w.part(s.id, 'slab_0')!.status).not.toBe('broken')
    expect(s.w.part(s.id, 'slab_0')!.status).not.toBe('collapsed')
  })
})
