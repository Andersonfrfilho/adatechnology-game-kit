import { describe, expect, it } from 'vitest'
import {
  SOILS, buildFrame, createDestruction, footingSoil, pileCapacity, pileLength, sizeStructure, solveFoundation, subgradeModulus,
} from '../src'
import type { DestructibleSpec, DestructionEvent, SoilProfile } from '../src'

const soils = new Map(SOILS.map((s) => [s.id, s]))
/** 18 m of soft clay over dense sand: a site where a tall building needs piles. */
const SOFT_OVER_SAND: SoilProfile = { layers: [{ soil: 'clay_soft', thickness: 18 }, { soil: 'sand_dense' }] }

/** A 20-storey frame, 8 x 16 m, narrow along x, sized as a designer would. */
const tower = (extra: Parameters<typeof buildFrame>[0] = {}) =>
  sizeStructure(buildFrame({ spanX: 8, spanZ: 16, columnsX: 3, columnsZ: 5, floors: 20, columnSize: 0.6, beamHeight: 0.7, footing: 2.5, ...extra }))

const run = (w: ReturnType<typeof createDestruction>, seconds: number, dt = 0.1): DestructionEvent[] => {
  const out: DestructionEvent[] = []
  for (let t = 0; t < seconds; t += dt) out.push(...w.update(dt))
  return out
}

describe('soil: the numbers', () => {
  it('ships the NBR 6122 basic pressures', () => {
    expect(soils.get('rock')!.allowableKPa).toBe(3000)
    expect(soils.get('sand_dense')!.allowableKPa).toBe(400)
    expect(soils.get('sand_medium')!.allowableKPa).toBe(200)
    expect(soils.get('clay_stiff')!.allowableKPa).toBe(200)
    expect(soils.get('clay_medium')!.allowableKPa).toBe(100)
    // soft clay: 5.14 cu / 3 with cu about 18 kPa
    expect(soils.get('clay_soft')!.allowableKPa).toBe(30)
  })

  it('a footing bears on the weakest soil within two widths under it', () => {
    const crust: SoilProfile = { layers: [{ soil: 'clay_stiff', thickness: 2 }, { soil: 'clay_soft' }] }
    expect(footingSoil(crust, 0.5, 0.6, soils).allowableKPa).toBe(200)
    expect(footingSoil(crust, 0.5, 3, soils).allowableKPa).toBe(30)
  })

  it('subgrade modulus E / (B (1 - nu^2) Iw)', () => {
    expect(subgradeModulus(4.2, 0.4, 2.5)).toBeCloseTo(4.2e6 / (2.5 * 0.84 * 0.82), 0)
  })

  it('a rigid square footing settles q B (1 - nu^2) Iw / E', () => {
    // 2 x 2 m footing on medium sand (E 32 MPa, nu 0.3) at 150 kPa: 150e3 * 2 * 0.91 * 0.82 / 32e6 = 7.0 mm
    const mass = (150e3 * 4) / 9.81
    const spec: DestructibleSpec = {
      parts: [{ id: 'pad', material: 'concrete', shape: { kind: 'box', size: [2, 0.5, 2] }, position: [0, -0.25, 0], mass, structure: { role: 'foundation' } }],
      soil: 'sand_medium',
    }
    const w = createDestruction()
    const id = w.add(spec)
    const st = w.state(id)!.soil!
    expect(st.settlement).toBeCloseTo((150e3 * 2 * 0.91 * 0.82) / 32e6, 4)
    expect(st.status).toBe('stable')
    expect(st.bearing).toBeCloseTo(150 / (3 * 200), 3)
    expect(w.state(id)!.position[1]).toBeCloseTo(-st.settlement, 6)
  })

  it('pile resistance by Décourt-Quaresma: end bearing and skin friction', () => {
    const r = pileCapacity(SOFT_OVER_SAND, { length: 21, diameter: 0.6 }, 0, soils)
    const per = Math.PI * 0.6, area = (Math.PI * 0.36) / 4
    // bored: skin 0.8 * 10 * (3/3 + 1) kPa over 18 m of clay, 0.5 * 10 * (25/3 + 1) over 3 m of sand; tip 0.5 * 400 * 25 kPa
    expect(r.skin).toBeCloseTo(16e3 * per * 18 + 0.5 * 10e3 * (25 / 3 + 1) * per * 3, 0)
    expect(r.tip).toBeCloseTo(5000e3 * area, 0)
    expect(r.ultimate / 1e3).toBeCloseTo(2220.5, 0)
    const driven = pileCapacity(SOFT_OVER_SAND, { length: 21, diameter: 0.6, method: 'driven' }, 0, soils)
    expect(driven.ultimate).toBeGreaterThan(r.ultimate)
  })

  it('pileLength takes the pile down to firm ground', () => {
    // 1.2 MN with safety 2: 2.4 MN ultimate; 18 m of soft clay give 0.54 MN, so the tip has to get into the sand
    const L = pileLength(SOFT_OVER_SAND, { load: 1.2e6, diameter: 0.6 })
    expect(L).toBe(23.5)
    expect(pileCapacity(SOFT_OVER_SAND, { length: L, diameter: 0.6 }, 0, soils).ultimate / 2).toBeGreaterThanOrEqual(1.2e6)
    expect(pileCapacity(SOFT_OVER_SAND, { length: L - 0.5, diameter: 0.6 }, 0, soils).ultimate / 2).toBeLessThan(1.2e6)
  })

  it('P-delta: a tall body on springs that are too soft has no stable equilibrium (leaning instability)', () => {
    const springs = [-1, 1].flatMap((x) => [-1, 1].map((z) => ({ x, z, hx: 0.5, hz: 0.5, k: 1e7, cap: 1e12 })))
    // rotational stiffness 4e7 N m per unit slope against W h
    expect(solveFoundation(springs, 1e6, 0, 0, 30, [0.005, 0]).stable).toBe(true)
    expect(solveFoundation(springs, 1e6, 0, 0, 45, [0.005, 0]).stable).toBe(false)
  })
})

describe('soil: buildings', () => {
  it('without soil nothing changes: no soil state, the pose is the host one', () => {
    const w = createDestruction()
    const id = w.add(tower(), { position: [1, 2, 3] })
    expect(w.state(id)!.soil).toBeUndefined()
    expect(w.state(id)!.position).toEqual([1, 2, 3])
    expect(run(w, 2).filter((e) => e.type === 'settle')).toHaveLength(0)
  })

  it('a tall building on pads on soft clay settles, leans its narrow way and tips over', () => {
    const w = createDestruction()
    const id = w.add(tower({ soil: SOFT_OVER_SAND }))
    const s0 = w.state(id)!.soil!
    expect(s0.bearing).toBeGreaterThan(1)
    expect(s0.status).toBe('yielding')
    const events = run(w, 30)
    const settles = events.filter((e): e is Extract<DestructionEvent, { type: 'settle' }> => e.type === 'settle')
    expect(settles.length).toBeGreaterThan(3)
    // it keeps going down and leaning before it goes
    for (let i = 1; i < settles.length; i++) {
      expect(settles[i].settlement).toBeGreaterThanOrEqual(settles[i - 1].settlement)
      expect(settles[i].tilt).toBeGreaterThanOrEqual(settles[i - 1].tilt)
    }
    const last = settles[settles.length - 1]
    expect(last.status).toBe('toppled')
    // it leans across the 8 m side, the weak way
    expect(Math.abs(last.direction[0])).toBeCloseTo(1, 6)
    // tips once its centre of mass is past the edge: about atan(5.25 / 34) = 9 degrees for this tower
    expect(last.tilt).toBeGreaterThan(6)
    expect(last.tilt).toBeLessThan(15)
    const collapse = events.find((e) => e.type === 'collapse')
    expect(collapse).toBeDefined()
    expect(events.indexOf(collapse!)).toBeGreaterThan(events.indexOf(last))
    expect(w.state(id)!.parts.filter((p) => p.status === 'collapsed').length).toBeGreaterThan(700)
    // the pose of the object carries the tilt
    const st = w.state(id)!
    expect(st.position[1]).toBeLessThan(-0.1)
    expect(Math.abs(st.rotation[2])).toBeGreaterThan(0.05)
  })

  it('the same building on piles down to the sand holds', () => {
    const load = 1.25 * 180e3 * 9.81 / 2
    const length = pileLength(SOFT_OVER_SAND, { load, diameter: 0.6, top: 0.3 })
    expect(length).toBeGreaterThan(18)
    const w = createDestruction()
    const id = w.add(tower({ soil: SOFT_OVER_SAND, piles: { diameter: 0.6, length, count: 2 } }))
    const st = w.state(id)!.soil!
    expect(st.status).toBe('stable')
    expect(st.bearing).toBeLessThan(0.5)
    // a few centimetres down and a lean far below the 1/500 a designer allows
    expect(st.settlement).toBeGreaterThan(0.005)
    expect(st.settlement).toBeLessThan(0.05)
    expect(st.tilt).toBeLessThan(Math.atan(1 / 500) * (180 / Math.PI))
    const events = run(w, 10)
    expect(events.filter((e) => e.type === 'settle' || e.type === 'collapse')).toHaveLength(0)
  })

  it('a two-storey house on a raft on firm ground is unaffected', () => {
    const spec = sizeStructure(buildFrame({ spanX: 8, spanZ: 10, floors: 2, walls: true, raft: true }))
    const bare = createDestruction()
    const a = bare.add(spec)
    const w = createDestruction()
    const id = w.add({ ...spec, soil: 'clay_stiff' })
    const st = w.state(id)!.soil!
    expect(st.status).toBe('stable')
    expect(st.bearing).toBeLessThan(0.1)
    // well inside the 25 mm a raft is allowed to settle
    expect(st.settlement).toBeLessThan(0.015)
    expect(st.tilt).toBeLessThan(0.01)
    expect(w.state(id)!.parts.map((p) => p.stress)).toEqual(bare.state(a)!.parts.map((p) => p.stress))
    expect(run(w, 5).filter((e) => e.type === 'settle' || e.type === 'collapse')).toHaveLength(0)
  })

  it('a strip under each wall of a house on the terrain', () => {
    const wall = (id: string, x: number) => ({ id, material: 'brick', shape: { kind: 'box' as const, size: [0.15, 2.8, 6] as [number, number, number] }, position: [x, 1.4, 0] as [number, number, number], structure: { role: 'wall' as const } })
    const spec: DestructibleSpec = {
      parts: [
        { id: 'terrain', material: 'concrete', shape: { kind: 'box', size: [10, 0.5, 10] }, position: [0, -0.25, 0], hp: 1e12, structure: { role: 'foundation' }, tags: ['terrain'] },
        wall('w1', -2), wall('w2', 2),
      ],
      joints: [{ a: 'w1', b: 'terrain', kind: 'mortar', bears: 'a_on_b' }, { a: 'w2', b: 'terrain', kind: 'mortar', bears: 'a_on_b' }],
      soil: { layers: [{ soil: 'clay_medium' }] },
    }
    const w = createDestruction()
    const id = w.add(spec)
    const st = w.state(id)!.soil!
    // two walls of 4.5 t on 0.6 x 6 m strips: 12 kPa on a soil that gives way at 300
    expect(st.bearing).toBeCloseTo((2 * 0.15 * 2.8 * 6 * 1800 * 9.81) / (3 * 100e3 * 2 * 0.6 * 6), 1)
    expect(st.status).toBe('stable')
  })

  it('keeps the soil through serialize, load and setTransform', () => {
    const w = createDestruction()
    const id = w.add(tower({ soil: SOFT_OVER_SAND }), { position: [10, 0, 0] })
    run(w, 3)
    const before = structuredClone(w.state(id)!)
    expect(before.soil!.tilt).toBeGreaterThan(1)
    const w2 = createDestruction()
    w2.load(w.serialize())
    const after = w2.state(id)!
    expect(after.soil!.tilt).toBeCloseTo(before.soil!.tilt, 9)
    expect(after.position[0]).toBeCloseTo(before.position[0], 9)
    expect(after.rotation[2]).toBeCloseTo(before.rotation[2], 9)
    // the host moves the object: the soil offset stays on top of the new pose
    w2.setTransform(id, [20, 0, 0], [0, 0, 0, 1])
    expect(w2.state(id)!.position[0] - 20).toBeCloseTo(before.position[0] - 10, 9)
    // both worlds go on the same way
    expect(run(w2, 2).map((e) => e.type)).toEqual(run(w, 2).map((e) => e.type))
  })

  it('soil classes and numbers are configurable', () => {
    const w = createDestruction({ soil: { soils: [{ id: 'fill', kind: 'sand', allowableKPa: 1000, spt: 30, elasticMPa: 80, poisson: 0.3 }], safety: 2 } })
    const id = w.add(tower({ soil: 'fill' }))
    expect(w.state(id)!.soil!.status).toBe('stable')
    expect(() => createDestruction().add(tower({ soil: 'unknown' }))).toThrow(/unknown soil/)
  })
})
