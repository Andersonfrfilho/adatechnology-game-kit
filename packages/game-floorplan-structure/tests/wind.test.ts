import { describe, expect, it } from 'vitest'
import {
  MATERIALS, WIND_DEFAULTS, WIND_TERRAIN, createDestruction, damperAmplification, damperTuning, heightFactor, makeGust, meanHeightFactor, partMass, windPressure,
} from '@adatechnology/game-destruction'
import type { DestructionEvent } from '@adatechnology/game-destruction'

import { DAMPER_DEFAULTS, TOWER_DEFAULTS, addTunedMassDamper, buildStructure, buildTower, damperMass, toDestructibleSpec, windExposureOf } from '../src'
import type { TowerGeometry } from '../src'
import { rectangularHouse } from './synthetic-plan'

const run = (w: ReturnType<typeof createDestruction>, seconds: number): DestructionEvent[] => {
  const out: DestructionEvent[] = []
  for (let t = 0; t < seconds - 1e-9; t += 0.1) out.push(...w.update(0.1))
  return out
}
const types = (events: DestructionEvent[], ...names: DestructionEvent['type'][]) => events.filter((e) => names.includes(e.type))

/** Wind on tall buildings (design T10-estrutura-real.md §10): the core resists, the top sways, the damper cuts the swing. */
describe('towers in the wind', () => {
  // the design wind: 40 m/s over a city (category IV); a 40-storey tower of 1 m columns and a core of six elevators with 60 cm walls; slabs of 25 cm
  const wind = { speed: 40, terrain: 'IV' as const }
  const tall = { floors: 40, columnSize: 1.0, slabThickness: 0.25, core: { elevators: 6, wallThickness: 0.6 }, wind }
  const withCore = buildTower(tall)
  const without = buildTower({ ...tall, core: false })

  it('stands under the design wind with its drift inside H/500, at the stress it was sized for', () => {
    const w = createDestruction({ wind })
    const id = w.add(withCore)
    const st = w.state(id)!
    const s = st.wind!
    expect(s.status).toBe('ok')
    expect(s.drift).toBeLessThan(1 / 500)
    // hand values for the pressure at the top of a category IV class C building: S2 = 0.84 * 0.95 * (z / 10)^0.135 -> q = 0.613 (40 S2)^2
    const top = windPressure(40 * heightFactor(128, WIND_TERRAIN.find((t) => t.id === 'IV')!, 'C'))
    expect(s.pressure).toBeGreaterThan(top * 0.97)
    expect(s.pressure).toBeLessThan(top * 1.03)
    // 1.2 kPa at the top against 0.86 kPa at 10 m: it grows with the height
    expect(s.pressure).toBeGreaterThan(1.1e3)
    expect(s.shear).toBeGreaterThan(3.5e6)
    expect(s.shear).toBeLessThan(5e6)
    // the resultant of a load that grows with the height acts above the middle: between half and two thirds of the 130 m
    expect(s.moment / s.shear).toBeGreaterThan(0.5 * 130)
    expect(s.moment / s.shear).toBeLessThan(0.65 * 130)
    expect(s.overturn).toBeLessThan(0.5)
    expect(Math.max(...st.parts.map((p) => p.stress ?? 0))).toBeLessThan(0.7)
    // the first mode of a 130 m tower is a few seconds
    expect(1 / s.frequency).toBeGreaterThan(3)
    expect(1 / s.frequency).toBeLessThan(8)
    const events = run(w, 30)
    expect(types(events, 'stress', 'collapse', 'fracture', 'detach')).toHaveLength(0)
    expect(w.state(id)!.groups).toHaveLength(1)
  })

  it('the wind pulls the upwind walls of the core and presses the downwind ones; where it pulls past the dead load the bars are sized for it', () => {
    const w = createDestruction({ wind })
    const id = w.add(withCore)
    const parts = w.state(id)!.parts
    const west = parts.find((p) => p.id === 'core_0_w')!, east = parts.find((p) => p.id === 'core_0_e')!
    expect(west.wind!).toBeLessThan(0)
    expect(east.wind!).toBeGreaterThan(0)
    expect(Math.abs(west.wind!)).toBeGreaterThan(1e6)
    // the small core of the default tower carries the same tower with less dead load: the wind pulls past it (a wall with a bar every 0.5 m: the bars of
    // a tight cage hold the pull outright, since every bar counts)
    const slim = { floors: 40, columnSize: 1.0, core: { rebar: { spacing: 0.5 } } }
    const bars = (spec: ReturnType<typeof buildTower>) => spec.parts.find((p) => p.id === 'core_1_w')!.reinforcement!.diameter
    const weight = buildTower({ ...slim, wind: false })
    const designed = buildTower({ ...slim, wind })
    expect(bars(weight)).toBe(0.0125)
    expect(bars(designed)).toBeGreaterThan(0.0125)
    expect(bars(designed)).toBeLessThanOrEqual(0.04)
    const worst = (spec: ReturnType<typeof buildTower>) => {
      const world = createDestruction({ wind })
      return world.state(world.add(spec))!.parts.find((p) => p.id === 'core_1_w')!.stress!
    }
    // with the bars of the weight-only design the pull takes the wall past the stress it was sized for; with the thicker ones it is back at it
    expect(worst(weight)).toBeGreaterThan(0.7)
    expect(worst(designed)).toBeLessThanOrEqual(0.65 + 1e-6)
  })

  it('a tower sized for its weight alone is overloaded by the wind it was not made for', () => {
    const plain = buildTower({ floors: 12 })
    const calm = createDestruction()
    const blown = createDestruction({ wind })
    const ci = calm.add(plain), bi = blown.add(plain)
    expect(Math.max(...calm.state(ci)!.parts.map((p) => p.stress ?? 0))).toBeLessThanOrEqual(0.65 + 1e-6)
    expect(Math.max(...blown.state(bi)!.parts.map((p) => p.stress ?? 0))).toBeGreaterThan(1)
    const made = buildTower({ floors: 12, wind })
    const ready = createDestruction({ wind })
    expect(Math.max(...ready.state(ready.add(made))!.parts.map((p) => p.stress ?? 0))).toBeLessThanOrEqual(0.65 + 1e-6)
    expect(types(run(ready, 20), 'stress', 'collapse')).toHaveLength(0)
  })

  it('without the core the same tower sways past H/500: the core is what holds it', () => {
    const a = createDestruction({ wind }), b = createDestruction({ wind })
    const ia = a.add(withCore), ib = b.add(without)
    const core = a.state(ia)!.wind!, bare = b.state(ib)!.wind!
    expect(core.drift).toBeLessThan(1 / 500)
    expect(bare.status).toBe('drift')
    expect(bare.drift).toBeGreaterThan(1 / 500)
    // the frame alone (the core is also 1/4 of the weight, so the same wind bends it more than three times as far)
    expect(bare.deflection).toBeGreaterThan(core.deflection * 2.5)
    expect(bare.frequency).toBeLessThan(core.frequency * 0.75)
    // it is reported once, as a `sway` event with the drift over the limit
    const events = types(run(b, 5), 'sway') as Array<Extract<DestructionEvent, { type: 'sway' }>>
    expect(events[0].status).toBe('drift')
    expect(events[0].drift).toBeGreaterThan(1 / 500)
    expect(types(run(a, 5), 'sway').every((e) => (e as Extract<DestructionEvent, { type: 'sway' }>).status === 'ok')).toBe(true)
  })

  it('a tower that loses its core is over the limit on the spot and the sway event says so', () => {
    const isCore = (id: string) => /^(core_|stair_|landing_|elevator_)/.test(id)
    const gutted = { ...withCore, parts: withCore.parts.filter((p) => !isCore(p.id)), joints: withCore.joints!.filter((j) => !isCore(j.a) && !isCore(j.b)) }
    const w = createDestruction({ wind })
    const id = w.add(gutted)
    expect(w.state(id)!.wind!.drift).toBeGreaterThan(1 / 500)
    expect(w.state(id)!.wind!.status).toBe('drift')
  })

  it('a damper cuts the swing by what the response of the two masses says, and its weight goes down the tower', () => {
    const damped = buildTower({ ...tall, damper: {} })
    const plain = createDestruction({ wind }), tuned = createDestruction({ wind })
    const pi = plain.add(withCore), ti = tuned.add(damped)
    const st = tuned.state(ti)!.wind!
    const part = damped.parts.find((p) => p.id === 'damper')!
    expect(part.mass).toBeCloseTo(damperMass(withCore, { ratio: 0.01 }), 0)
    // a damper of 1% of the estimated modal mass is 0.5 to 2% of the real one
    expect(st.damper!.ratio).toBeGreaterThan(0.005)
    expect(st.damper!.ratio).toBeLessThan(0.02)
    // the mass loads the slab it stands on: the load on the slab grows by the damper's mass
    const load = (w: typeof plain, id: string) => w.state(id)!.parts.find((p) => p.id === 'slab_38')!.load!
    expect(load(tuned, ti) - load(plain, pi)).toBeGreaterThan(part.mass! * 0.99)
    expect(load(tuned, ti) - load(plain, pi)).toBeLessThan(part.mass! * 1.01)
    const rms = (w: typeof plain, id: string) => {
      let sum = 0, n = 0
      for (let t = 0; t < 1800; t += 0.1) {
        w.update(0.1)
        if (t > 600) {
          const s = w.state(id)!.wind!.sway
          sum += s * s
          n++
        }
      }
      return Math.sqrt(sum / n)
    }
    const a = rms(plain, pi), b = rms(tuned, ti)
    // the gust lines through the transfer function of the tower alone and with its damper tuned by Den Hartog
    const f1 = st.frequency, mu = st.damper!.ratio
    const tune = damperTuning(mu)
    const g = makeGust(40 * meanHeightFactor(10, WIND_TERRAIN.find((t) => t.id === 'IV')!, 'C', { meanRatio: 0.69 }), WIND_DEFAULTS.gust)
    let withDamper = 0, without = 0
    g.freq.forEach((f, k) => {
      withDamper += g.amp[k] ** 2 * damperAmplification(f / f1, mu, tune.frequency, tune.damping, 0.016) ** 2
      without += g.amp[k] ** 2 * damperAmplification(f / f1, 0, 1, 0, 0.016) ** 2
    })
    const expected = Math.sqrt(withDamper / without)
    // for a 1.6% structure a 0.85% damper takes about a quarter off the swing, as the real ones do (Taipei 101: 30 to 40%)
    expect(expected).toBeGreaterThan(0.6)
    expect(expected).toBeLessThan(0.85)
    expect(b / a).toBeGreaterThan(expected * 0.9)
    expect(b / a).toBeLessThan(expected * 1.1)
    // a damper left out of tune does worse than the tuned one
    const off = buildTower({ ...tall, damper: { frequency: f1 * 2 } })
    const wo = createDestruction({ wind })
    const oi = wo.add(off)
    expect(rms(wo, oi)).toBeGreaterThan(b)
  }, 120000)

  it('a low house is practically unaffected by the same wind', () => {
    const house = toDestructibleSpec(buildStructure(rectangularHouse({ width: 8, depth: 6, floors: 2 }), { wallDetail: 'coarse' }), { wallDetail: 'coarse' })
    const calm = createDestruction()
    const blown = createDestruction({ wind })
    const ci = calm.add(house), bi = blown.add(house)
    const s = blown.state(bi)!.wind!
    // a tenth of a millimetre of drift against the 14 mm the limit allows, and far from tipping
    expect(s.deflection).toBeLessThan(2e-4)
    expect(s.drift).toBeLessThan(s.limit / 100)
    expect(s.overturn).toBeLessThan(0.1)
    expect(s.status).toBe('ok')
    // the walls stand: no part comes near its capacity because of the wind
    const before = new Map(calm.state(ci)!.parts.map((p) => [p.id, p.stress ?? 0]))
    for (const p of blown.state(bi)!.parts) expect((p.stress ?? 0) - before.get(p.id)!).toBeLessThan(0.25)
    expect(Math.max(...blown.state(bi)!.parts.map((p) => p.stress ?? 0))).toBeLessThan(1)
    const events = run(blown, 60)
    expect(types(events, 'sway', 'stress', 'collapse')).toHaveLength(0)
    expect(blown.state(bi)!.wind!.peak).toBeLessThan(1e-3)
  })
})

describe('tower wind options', () => {
  it('a tower has no wind and no damper unless asked: the default tower is the one of before', () => {
    const spec = buildTower()
    expect(spec.wind).toBeUndefined()
    expect(spec.parts.some((p) => p.damper || p.id === 'damper')).toBe(false)
    expect(spec.parts).toHaveLength(1109)
    const w = createDestruction()
    expect(w.state(w.add(spec))!.wind).toBeUndefined()
  })

  it('the wind options set where the tower stands and size it; the speed stays in the world', () => {
    const spec = buildTower({ floors: 6, wind: { speed: 35, terrain: 'II', drag: 1.4, class: 'B' } })
    expect(spec.wind).toEqual({ terrain: 'II', drag: 1.4, class: 'B' })
    expect(windExposureOf({ speed: 40, direction: [0, 0, 1], bandHeight: 4, topography: 1.1 })).toEqual({ topography: 1.1 })
    expect(buildTower({ floors: 6, wind: {} }).wind).toBeUndefined()
    const w = createDestruction({ wind: { speed: 35 } })
    const st = w.state(w.add(spec))!.wind!
    expect(st.speed).toBe(35)
  })

  it('addTunedMassDamper puts a block on the mechanical floor with its mass in the load and the tuning left to the world', () => {
    const g: TowerGeometry = { floors: 12, height: 3, slab: 0.2, spanX: 16, spanZ: 24, columnSize: 0.6, columnsX: 3, columnsZ: 4, roof: true }
    const base = buildTower()
    const spec = addTunedMassDamper(base, g, {})
    const part = spec.parts.find((p) => p.id === 'damper')!
    // 1% of 25% of the mass above the foundations
    let total = 0
    const byId = new Map(MATERIALS.map((m) => [m.id, m]))
    for (const p of base.parts) if (p.structure?.role !== 'foundation') total += partMass(p, byId.get(p.material)!)
    expect(part.mass).toBeCloseTo(total * DAMPER_DEFAULTS.modalShare * DAMPER_DEFAULTS.ratio, 0)
    expect(part.damper).toEqual({})
    expect(part.structure!.role).toBe('partition')
    expect(part.tags).toContain('tuned_mass_damper')
    const y = 11 * (TOWER_DEFAULTS.height + TOWER_DEFAULTS.slabThickness)
    const size = (part.shape as { size: number[] }).size
    expect(part.position[1]).toBeCloseTo(y + size[1] / 2, 6)
    expect(size[1]).toBeLessThanOrEqual(DAMPER_DEFAULTS.maxHeight + 1e-9)
    // steel: the mass is the volume of the block
    expect(size[0] * size[1] * size[2] * 7850).toBeCloseTo(part.mass!, -1)
    expect(spec.joints!.find((j) => j.a === 'damper')!.b).toBe('slab_10')
    // given numbers pass through, the rest stays with the world
    const set = addTunedMassDamper(base, g, { mass: 5e4, frequency: 0.35, damping: 0.05, at: [1, 2] }).parts.find((p) => p.id === 'damper')!
    expect(set.mass).toBe(5e4)
    expect(set.damper).toEqual({ frequency: 0.35, damping: 0.05 })
    expect([set.position[0], set.position[2]]).toEqual([1, 2])
    expect(addTunedMassDamper(base, { ...g, floors: 1 }, {})).toBe(base)
    expect(() => addTunedMassDamper(base, g, { material: 'nothing' })).toThrow()
  })

  it('buildTower({ damper }) adds it and sizes the floor for it', () => {
    const spec = buildTower({ floors: 12, damper: {} })
    const part = spec.parts.find((p) => p.id === 'damper')!
    expect(part).toBeDefined()
    const w = createDestruction()
    const st = w.state(w.add(spec))!
    expect(Math.max(...st.parts.map((p) => p.stress ?? 0))).toBeLessThanOrEqual(0.7)
    expect(st.groups).toHaveLength(1)
    expect(buildTower({ floors: 12, damper: false }).parts.some((p) => p.id === 'damper')).toBe(false)
  })
})
