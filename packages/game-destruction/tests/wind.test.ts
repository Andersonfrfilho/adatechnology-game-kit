import { describe, expect, it } from 'vitest'

import {
  WIND_DEFAULTS, WIND_TERRAIN, analyzeWind, buildFrame, createDestruction, damperAmplification, damperTuning, gustAt, heightFactor, makeGust, meanHeightFactor, momentNodes, resolveWind,
  shapeAt, shearNodes, sizeStructure, solveWallFrame, stepSway, tensionCapacity, turbulenceIntensity, windClass, windPressure,
} from '../src'
import type { DestructionEvent, DestructibleSpec, WindCase, WindPartInput } from '../src'

const ev = <T extends DestructionEvent['type']>(events: DestructionEvent[], type: T) => events.filter((e): e is Extract<DestructionEvent, { type: T }> => e.type === type)
const run = (w: ReturnType<typeof createDestruction>, seconds: number, dt = 0.1): DestructionEvent[] => {
  const out: DestructionEvent[] = []
  for (let t = 0; t < seconds - 1e-9; t += dt) out.push(...w.update(dt))
  return out
}
const terrain = (id: string) => WIND_TERRAIN.find((t) => t.id === id)!
const kase = (o: Partial<WindCase> = {}): WindCase => ({
  speed: 40, direction: [1, 0], terrain: terrain('II'), cls: 'auto', topography: 1, statistical: 1, drag: 1.3, damping: 0.016, airDensity: 1.226, minHeight: 5, bandHeight: 3, stiffnessFactor: 0.8,
  beamFactor: 0.4, flange: 0.1, loadFactor: 1.4, chord: false, meanRatio: 0.69, gustFactor: { A: 1, B: 0.98, C: 0.95 }, ...o,
})

/** Wind on a building (design T10-estrutura-real.md §10). */
describe('wind pressure and profile', () => {
  it('pressure is 0.613 V^2 (NBR 6123 4.2): 980.8 Pa at 40 m/s', () => {
    // 0.5 * 1.226 * 40^2 = 980.8
    expect(windPressure(40)).toBeCloseTo(980.8, 6)
    expect(windPressure(10)).toBeCloseTo(61.3, 6)
    expect(windPressure(40, 1.2)).toBeCloseTo(960, 6)
  })

  it('the class follows the largest dimension: A to 20 m, B to 50 m, C above', () => {
    expect([windClass(20), windClass(20.1), windClass(50), windClass(50.1)]).toEqual(['A', 'B', 'B', 'C'])
  })

  it('S2 = b Fr (z/10)^p from the table of the NBR 6123, so the pressure grows with the height', () => {
    // hand values: category II class B at 10 m is 1.00 * 0.98 * 1 = 0.98 -> Vk 39.2 -> q 941.96 Pa
    expect(heightFactor(10, terrain('II'), 'B')).toBeCloseTo(0.98, 10)
    expect(windPressure(40 * heightFactor(10, terrain('II'), 'B'))).toBeCloseTo(941.96, 2)
    // II, B, 50 m: 0.98 * 5^0.09 = 1.13275
    expect(heightFactor(50, terrain('II'), 'B')).toBeCloseTo(1.13275, 4)
    // III, C, 100 m: 0.93 * 0.95 * 10^0.115 = 1.15135 -> q 1300.15 Pa
    expect(heightFactor(100, terrain('III'), 'C')).toBeCloseTo(1.15135, 4)
    expect(windPressure(40 * heightFactor(100, terrain('III'), 'C'))).toBeCloseTo(1300.15, 1)
    // IV, A, 20 m: 0.86 * 2^0.12 = 0.93459
    expect(heightFactor(20, terrain('IV'), 'A')).toBeCloseTo(0.93459, 4)
    for (const cat of ['I', 'II', 'III', 'IV', 'V']) {
      expect(heightFactor(100, terrain(cat), 'C')).toBeGreaterThan(heightFactor(20, terrain(cat), 'C'))
    }
  })

  it('below the minimum height the profile stays at 5 m, above the gradient height it stops growing', () => {
    // II, A, at 5 m: 0.5^... (5/10)^0.085 = 0.94278
    expect(heightFactor(3, terrain('II'), 'A')).toBeCloseTo(0.94278, 4)
    expect(heightFactor(1, terrain('II'), 'A')).toBe(heightFactor(5, terrain('II'), 'A'))
    // III, C, 350 m (gradient height) and 600 m: 0.93 * 0.95 * 35^0.115 = 1.32976
    expect(heightFactor(600, terrain('III'), 'C')).toBeCloseTo(1.32976, 4)
    expect(heightFactor(600, terrain('III'), 'C')).toBe(heightFactor(350, terrain('III'), 'C'))
  })

  it('the mean wind is meanRatio of the same profile without the gust factor', () => {
    // II, C, 100 m: 0.69 * 1.00 * 10^0.10 = 0.86866 (the gust profile has Fr 0.95)
    expect(meanHeightFactor(100, terrain('II'), 'C')).toBeCloseTo(0.86866, 4)
    expect(meanHeightFactor(100, terrain('II'), 'C')).toBeLessThan(heightFactor(100, terrain('II'), 'C'))
  })

  it('turbulence intensity is 1 / ln(z / z0), at most 0.5', () => {
    // ln(78) = 4.35671 -> 0.22953
    expect(turbulenceIntensity(78, 1)).toBeCloseTo(0.22953, 5)
    expect(turbulenceIntensity(3, 2.5)).toBe(0.5)
  })

  it('the defaults are the documented ones and the terrain table can be replaced', () => {
    expect(WIND_DEFAULTS).toMatchObject({ speed: 40, terrain: 'III', drag: 1.3, driftLimit: 1 / 500, loadFactor: 1.4, damping: 0.016, meanRatio: 0.69, bandHeight: 3 })
    const w = resolveWind({ speed: 30, terrains: [{ id: 'III', zg: 100, b: { A: 1, B: 1, C: 1 }, p: { A: 0.1, B: 0.1, C: 0.1 }, z0: 0.3 }, { id: 'X', zg: 10, b: { A: 1, B: 1, C: 1 }, p: { A: 0, B: 0, C: 0 }, z0: 1 }] })
    expect(w.speed).toBe(30)
    expect(w.terrains.get('III')!.zg).toBe(100)
    expect(w.terrains.has('X')).toBe(true)
    expect(w.terrains.get('IV')!.zg).toBe(420)
  })
})

describe('the cantilever and the frame', () => {
  it('shear and moment add up from the top: 1, 2, 3 N over three 2 m bands', () => {
    const V = shearNodes([1, 2, 3])
    expect(V).toEqual([6, 5, 3, 0])
    // M(0) = sum F z = 1*1 + 2*3 + 3*5 = 22
    expect(momentNodes([2, 2, 2], V)).toEqual([22, 11, 3, 0])
  })

  it('a wall alone deflects w H^4 / (8 EI) under a uniform load', () => {
    // w = 10 kN/m, H = 130 m, EI = 1e12 N m2 -> 1e4 * 130^4 / 8e12 = 0.35701 m
    const n = 40, h = 130 / n
    const hb = new Array(n).fill(h)
    const sol = solveWallFrame(hb, new Array(n).fill(1e12), new Array(n).fill(0), shearNodes(new Array(n).fill(1e4 * h)))
    expect(sol.w[n]).toBeCloseTo(0.3570125, 3)
    expect(sol.w[0]).toBe(0)
  })

  it('a frame alone shears w H^2 / (2 GA) under a uniform load', () => {
    // w = 10 kN/m, H = 130 m, GA = 1e9 N -> 1e4 * 130^2 / 2e9 = 0.0845 m
    const n = 40, h = 130 / n
    const sol = solveWallFrame(new Array(n).fill(h), new Array(n).fill(1e-3), new Array(n).fill(1e9), shearNodes(new Array(n).fill(1e4 * h)))
    expect(sol.w[n]).toBeCloseTo(0.0845, 4)
  })

  it('wall and frame together follow the closed solution of the wall-frame equation', () => {
    // -(EI psi')' + GA psi = w (H - z), psi(0) = 0, psi'(H) = 0: psi = w (H - z) / GA + A cosh(kz) + B sinh(kz), k = sqrt(GA / EI)
    const w = 1e4, H = 130, EI = 1e12, GA = 1e9
    const k = Math.sqrt(GA / EI)
    const A = (-w * H) / GA
    const B = (w / (GA * k) - A * Math.sinh(k * H)) / Math.cosh(k * H)
    const psi = (z: number) => (w * (H - z)) / GA + A * Math.cosh(k * z) + B * Math.sinh(k * z)
    let top = 0
    const m = 20000
    for (let i = 0; i < m; i++) top += psi(((i + 0.5) * H) / m) * (H / m)
    const n = 40, h = H / n
    const sol = solveWallFrame(new Array(n).fill(h), new Array(n).fill(EI), new Array(n).fill(GA), shearNodes(new Array(n).fill(w * h)))
    expect(sol.w[n]).toBeCloseTo(top, 3)
    expect(sol.w[n]).toBeLessThan(0.3570125)
    expect(Math.abs(sol.w[n] / top - 1)).toBeLessThan(0.01)
  })
})

describe('tuned mass damper', () => {
  it('Den Hartog and Warburton tuning for a mass ratio of 1%', () => {
    // 1 / 1.01 = 0.990099; sqrt(3 * 0.01 / (8 * 1.01^3)) = 0.060330
    const dh = damperTuning(0.01)
    expect(dh.frequency).toBeCloseTo(0.990099, 6)
    expect(dh.damping).toBeCloseTo(0.06033, 5)
    // sqrt(1 - 0.005) / 1.01 = 0.987621; sqrt(0.01 * 0.9975 / (4 * 1.01 * 0.995)) = 0.049814
    const wb = damperTuning(0.01, 'warburton')
    expect(wb.frequency).toBeCloseTo(0.987621, 6)
    expect(wb.damping).toBeCloseTo(0.049814, 5)
  })

  it('without the damper the resonance is 1 / (2 zeta); the tuned one peaks at sqrt(1 + 2 / mu)', () => {
    expect(damperAmplification(1, 0, 1, 0, 0.01)).toBeCloseTo(50, 6)
    // Den Hartog: peak magnification of an undamped structure with the optimum damper, sqrt(1 + 2 / 0.01) = 14.177
    const tune = damperTuning(0.01)
    let peak = 0
    for (let r = 0.7; r < 1.3; r += 0.0005) peak = Math.max(peak, damperAmplification(r, 0.01, tune.frequency, tune.damping, 0))
    expect(peak).toBeGreaterThan(14.0)
    expect(peak).toBeLessThan(14.4)
    // with 1.6% of structural damping the damper cuts the resonance from 31.25 to under half
    let damped = 0
    for (let r = 0.7; r < 1.3; r += 0.0005) damped = Math.max(damped, damperAmplification(r, 0.01, tune.frequency, tune.damping, 0.016))
    expect(damped).toBeLessThan(31.25 / 2)
  })

  it('the time integration matches the frequency response of the two-degree system', () => {
    const M = 1e6, f1 = 0.5, zeta = 0.02, mu = 0.02
    const w1 = 2 * Math.PI * f1
    const tune = damperTuning(mu)
    const md = mu * M
    const wd = 2 * Math.PI * f1 * tune.frequency
    const sys = { M, K: M * w1 * w1, C: 2 * zeta * w1 * M, damper: { m: md, k: md * wd * wd, c: 2 * tune.damping * md * wd } }
    const F0 = 1e5
    for (const r of [0.9, 1, 1.1]) {
      const s = { x: 0, v: 0, y: 0, w: 0 }
      const wf = r * w1
      let amp = 0
      const dt = 0.02
      for (let t = 0; t < 600; t += dt) {
        stepSway(s, sys, t, dt, (tt) => F0 * Math.sin(wf * tt), 0.05)
        if (t > 560) amp = Math.max(amp, Math.abs(s.x))
      }
      const expected = (F0 / sys.K) * damperAmplification(r, mu, tune.frequency, tune.damping, zeta)
      expect(amp / expected).toBeGreaterThan(0.98)
      expect(amp / expected).toBeLessThan(1.02)
    }
  })
})

describe('gust', () => {
  it('has unit variance by construction and is the same for the same seed', () => {
    const o = { components: 400, maxHz: 2, scale: 1200, seed: 7 }
    const g = makeGust(26, o)
    // each sine has variance amp^2 / 2
    expect(g.amp.reduce((s, a) => s + (a * a) / 2, 0)).toBeCloseTo(1, 10)
    expect(g.freq).toHaveLength(400)
    expect(g.freq[1] - g.freq[0]).toBeCloseTo(2 / 400, 10)
    expect(gustAt(makeGust(26, o), 12.3)).toBe(gustAt(g, 12.3))
    expect(gustAt(makeGust(26, { ...o, seed: 8 }), 12.3)).not.toBe(gustAt(g, 12.3))
  })

  it('has more energy at low frequency (Davenport) than at high', () => {
    const g = makeGust(26, { components: 400, maxHz: 2, scale: 1200, seed: 1 })
    const low = g.amp.slice(0, 40).reduce((s, a) => s + a * a, 0)
    const high = g.amp.slice(-40).reduce((s, a) => s + a * a, 0)
    expect(low).toBeGreaterThan(5 * high)
  })
})

describe('tension of walls and columns', () => {
  it('a caged column holds its vertical bars at yield', () => {
    // 0.6 m column, 20 mm bars every 0.15 m: 4 bars a side, 12 on the perimeter -> 12 * pi * 0.01^2 * 500 MPa = 1.885 MN
    expect(tensionCapacity([0.6, 3, 0.6], { reinforcement: { spacing: 0.15, diameter: 0.02 }, yieldMPa: 500 })).toBeCloseTo(1.885e6, -3)
  })

  it('a wall holds every bar its spacing puts in, not only the 24 that are drawn', () => {
    // 0.35 x 3 x 9 m wall, 12.5 mm bars every 0.15 m: (9 - 0.06) / 0.15 + 1 = 60 vertical bars -> 60 * pi * 0.00625^2 * 500 MPa = 3.68 MN
    const bars = (spacing: number) => tensionCapacity([0.35, 3, 9], { reinforcement: { spacing, diameter: 0.0125 }, yieldMPa: 500 })
    expect(bars(0.15)).toBeCloseTo(60 * Math.PI * 0.00625 ** 2 * 500e6, -3)
    // below 24 bars nothing changed: every 0.5 m there are 18
    expect(bars(0.5)).toBeCloseTo(18 * Math.PI * 0.00625 ** 2 * 500e6, -3)
    // a long member lying on its side (a beam) has no vertical bars
    expect(tensionCapacity([9, 0.35, 0.35], { reinforcement: { spacing: 0.15, diameter: 0.0125 }, yieldMPa: 500 })).toBe(0)
  })

  it('a ratio of the section, then the concrete, then nothing', () => {
    // 1% of 0.35 x 5 m at 500 MPa = 8.75 MN
    expect(tensionCapacity([0.35, 3, 5], { ratio: 0.01, yieldMPa: 500 })).toBeCloseTo(8.75e6, -3)
    // plain concrete: 2.56 MPa * 0.35 * 5 = 4.48 MN
    expect(tensionCapacity([0.35, 3, 5], { yieldMPa: 500, tensileMPa: 2.56 })).toBeCloseTo(4.48e6, -3)
    expect(tensionCapacity([0.35, 3, 5], { yieldMPa: 500 })).toBe(0)
  })
})

describe('analysis of a building', () => {
  /** A concrete slab of a wall 5 m along the wind, 20 m across, 60 m tall, on a foundation 12 x 24 m. */
  const wall = (): WindPartInput[] => [
    { min: [-2.5, 0, -10], max: [2.5, 60, 10], kind: 'wall', elasticPa: 30e9, mass: 5 * 60 * 20 * 2400 },
    { min: [-6, -1, -12], max: [6, 0, 12], kind: 'foundation', mass: 0 },
  ]
  const q = (v: number) => 0.5 * 1.226 * v * v

  it('forces, base moment and top deflection follow the height profile', () => {
    const a = analyzeWind(wall(), kase(), 0)!
    expect(a.cls).toBe('C')
    expect(a.bands).toHaveLength(20)
    // category II class C: S2 = 1.00 * 0.95 * (z / 10)^0.10, band forces 1.3 * 20 m * 3 m * q(40 S2) at the middle of each band
    const S2 = (z: number) => 0.95 * (Math.max(5, z) / 10) ** 0.1
    let V = 0, M = 0, D = 0
    const EI = 0.8 * 30e9 * ((5 ** 3 * 20) / 12)
    for (let j = 0; j < 20; j++) {
      const z = 3 * j + 1.5
      const F = q(40 * S2(z)) * 1.3 * 20 * 3
      expect(a.forces[j]).toBeCloseTo(F, 3)
      V += F
      M += F * z
      D += (F * z * z * (3 * 60 - z)) / (6 * EI)
    }
    // hand values: shear 1.6632 MN, moment 53.906 MN m, deflection 9.946 mm
    expect(V).toBeCloseTo(1.66318e6, -2)
    expect(a.shear).toBeCloseTo(V, 3)
    expect(a.moment).toBeCloseTo(M, 1)
    expect(a.deflection / D).toBeGreaterThan(0.995)
    expect(a.deflection / D).toBeLessThan(1.005)
    expect(a.drift).toBeCloseTo(a.deflection / 60, 12)
    expect(a.forces[19] / a.forces[0]).toBeGreaterThan(1)
    expect(a.pressure).toBeCloseTo(q(40 * S2(58.5)), 3)
  })

  it('overturns when the moment passes what the weight resists over the leeward edge', () => {
    const a = analyzeWind(wall(), kase(), 0)!
    // W = 14.4e6 kg * 9.81 = 1.41264e8 N, arm 6 m: 1.4 * 53.9055e6 / (1.41264e8 * 6) = 0.08904
    expect(a.weight).toBeCloseTo(1.41264e8, -3)
    expect(a.overturn).toBeCloseTo(0.08904, 4)
    const light = wall()
    light[0].mass = 1e5
    expect(analyzeWind(light, kase(), 0)!.overturn).toBeGreaterThan(1)
  })

  it('a stiffer or shorter building sways less and the wind turned across it shows less area', () => {
    const base = analyzeWind(wall(), kase(), 0)!
    const stiff = wall()
    stiff[0].elasticPa = 60e9
    expect(analyzeWind(stiff, kase(), 0)!.deflection).toBeCloseTo(base.deflection / 2, 6)
    // the wall turned a quarter: 5 m across the wind instead of 20 -> a quarter of the force
    const across = analyzeWind(wall(), kase({ direction: [0, 1] }), 0)!
    expect(across.shear / base.shear).toBeCloseTo(5 / 20, 6)
    // doubling the speed quadruples every force
    expect(analyzeWind(wall(), kase({ speed: 80 }), 0)!.moment / base.moment).toBeCloseTo(4, 10)
  })

  it('the walls take their moment as axial force on the two flanges: tension upwind, compression downwind', () => {
    // two walls 0.5 m thick and 10 m across, 10 m apart along the wind, 10 storeys of 3 m: the couple of the flange forces carries the moment
    const parts: WindPartInput[] = []
    for (let f = 0; f < 10; f++) {
      parts.push({ min: [-5.25, 3 * f, -5], max: [-4.75, 3 * f + 3, 5], kind: 'wall', elasticPa: 30e9, mass: 2e5 })
      parts.push({ min: [4.75, 3 * f, -5], max: [5.25, 3 * f + 3, 5], kind: 'wall', elasticPa: 30e9, mass: 2e5 })
    }
    const a = analyzeWind(parts, kase(), 0)!
    expect(a.axial[0]).toBeLessThan(0)
    expect(a.axial[1]).toBeGreaterThan(0)
    expect(a.axial[0]).toBeCloseTo(-a.axial[1], 6)
    // the lowest storey: the couple of the two forces over the 10 m between them is the moment at its middle (1.5 m up), nearly the base moment
    // (each wall also bends a little on its own: 0.5^3 * 10 / 12 against 5 * 5^2, a thousandth)
    const mid = a.moment - 1.5 * (a.shear - 0.5 * 1.5 * (a.shear / 30))
    expect((a.axial[1] * 10) / a.moment).toBeGreaterThan(0.9)
    expect((a.axial[1] * 10) / mid).toBeGreaterThan(0.98)
    expect((a.axial[1] * 10) / mid).toBeLessThan(1.02)
    // higher up the moment is smaller, and so is the force
    expect(a.axial[19]).toBeLessThan(a.axial[1] * 0.1)
  })

  it('a frame resists by the shear of its columns: Muto stiffness of a ground storey', () => {
    // four 0.5 m columns 4 m tall on a 6 m grid, an x beam (0.3 x 0.6, 5.5 m) on each pair, E = 30 GPa, fixed base, no flange
    // k = kb / kc = 0.37702, a = (0.5 + k) / (2 + k) = 0.36896, K = 4 a 12 (0.8 E) Ic / h^3 = 34.59 MN/m, GA = K h = 138.36 MN
    const col = (x: number, z: number, beams: number[]): WindPartInput => ({ min: [x - 0.25, 0, z - 0.25], max: [x + 0.25, 4, z + 0.25], kind: 'column', elasticPa: 30e9, mass: 2e4, beams })
    const beam = (z: number): WindPartInput => ({ min: [-2.75, 3.4, z - 0.15], max: [2.75, 4, z + 0.15], kind: 'beam', elasticPa: 30e9, mass: 2e4 })
    const parts = [col(-3, -3, [4]), col(3, -3, [4]), col(-3, 3, [5]), col(3, 3, [5]), beam(-3), beam(3)]
    const a = analyzeWind(parts, kase({ flange: 0, bandHeight: 4 }), 0)!
    expect(a.ga[0]).toBeGreaterThan(138.36e6 * 0.999)
    expect(a.ga[0]).toBeLessThan(138.36e6 * 1.001)
    expect(a.ei[0]).toBe(0)
    // a frame without beams has pinned columns above the ground storey: the fixed base alone gives a = 0.25
    const bare = analyzeWind(parts.slice(0, 4).map((p) => ({ ...p, beams: [] })), kase({ flange: 0, bandHeight: 4 }), 0)!
    expect(bare.ga[0]).toBeCloseTo((0.25 * 12 * 0.8 * 30e9 * (0.5 ** 4 / 12) * 4) / 16, -3)
  })

  it('what stands over the lateral system moves with its top, and there is none without walls or columns', () => {
    const parts = wall()
    parts[0].max = [2.5, 30, 10]
    parts.push({ min: [-2.5, 30, -10], max: [2.5, 36, 10], kind: 'other', mass: 1e5 })
    const a = analyzeWind(parts, kase(), 0)!
    expect(a.height).toBe(36)
    const b = analyzeWind(wall().map((p, i) => (i === 0 ? { ...p, max: [2.5, 30, 10] as [number, number, number] } : p)), kase(), 0)!
    // the six metres above the wall add a rigid rotation of the top: the deflection is more than the wall's but not absurd
    expect(a.deflection).toBeGreaterThan(b.deflection)
    expect(a.deflection).toBeLessThan(b.deflection * 3)
    expect(analyzeWind([{ min: [0, 0, 0], max: [1, 3, 1], kind: 'other', mass: 10 }], kase(), 0)).toBeNull()
  })

  it('the first mode comes from the stiffness and the mass: f = (1/2 pi) sqrt(3 EI / (m H^3)) for a mass at the top', () => {
    // a wall of EI 5e12 carrying almost all its mass at the top (a 2000 t block over a light 5 m x 20 m x 40 m wall)
    const parts: WindPartInput[] = [
      { min: [-2.5, 0, -10], max: [2.5, 40, 10], kind: 'wall', elasticPa: 30e9, mass: 10 },
      { min: [-2.5, 39, -10], max: [2.5, 40, 10], kind: 'other', mass: 2e6 },
      { min: [-6, -1, -12], max: [6, 0, 12], kind: 'foundation', mass: 0 },
    ]
    const a = analyzeWind(parts, kase({ bandHeight: 1 }), 0)!
    const EI = 0.8 * 30e9 * ((5 ** 3 * 20) / 12)
    const expected = Math.sqrt((3 * EI) / (2e6 * 40 ** 3)) / (2 * Math.PI)
    expect(a.frequency / expected).toBeGreaterThan(0.97)
    expect(a.frequency / expected).toBeLessThan(1.03)
    expect(a.shape.phi[a.shape.phi.length - 1]).toBeCloseTo(1, 10)
    expect(shapeAt(a, 0)).toBe(0)
    expect(shapeAt(a, 40)).toBeCloseTo(1, 10)
    expect(shapeAt(a, 20)).toBeGreaterThan(0.2)
    expect(shapeAt(a, 20)).toBeLessThan(0.5)
  })
})

describe('wind in the world', () => {
  const house = (): DestructibleSpec => buildFrame({ floors: 2, walls: true, spanX: 8, spanZ: 6, continuousColumns: true })
  const slender = (damper = false): DestructibleSpec => {
    const spec = buildFrame({ floors: 14, spanX: 12, spanZ: 8, columnSize: 0.6, beamHeight: 0.6, continuousColumns: true, roofThickness: 0.2, slabThickness: 0.2 })
    if (damper) {
      // 1% of the modal mass (the modal mass of this frame is ~30% of the 2200 t above the foundations), on a column of the roof
      spec.parts.push({ id: 'damper', material: 'steel', shape: { kind: 'box', size: [1.2, 1.2, 1.2] }, position: [0, 14 * 3.2 + 0.6, 0], mass: 6000, structure: { role: 'partition' }, damper: {} })
      spec.joints!.push({ id: 'damper~roof', a: 'damper', b: 'roof', kind: 'bolt', bears: 'a_on_b' })
    }
    return sizeStructure(spec, { wind: { speed: 40 } })
  }

  it('is off unless the world has wind: no state, no event, no change in the stresses', () => {
    const w = createDestruction()
    const id = w.add(slender())
    expect(w.state(id)!.wind).toBeUndefined()
    expect(ev(run(w, 20), 'sway')).toHaveLength(0)
    const on = createDestruction({ wind: { speed: 40 } })
    const oid = on.add(slender())
    expect(on.state(oid)!.wind).toBeDefined()
    expect(on.state(oid)!.parts.some((p) => p.wind !== undefined)).toBe(true)
    expect(w.state(id)!.parts.every((p) => p.wind === undefined)).toBe(true)
  })

  it('a low house is practically unaffected: fractions of a millimetre of drift and no event', () => {
    const w = createDestruction({ wind: { speed: 40 } })
    const id = w.add(house())
    const st = w.state(id)!.wind!
    // 7.6 m of height: well under a millimetre, a millionth of the height, a thousandth of the limit
    expect(st.deflection).toBeLessThan(0.0005)
    expect(st.drift).toBeLessThan(st.limit / 100)
    expect(st.status).toBe('ok')
    expect(st.overturn).toBeLessThan(0.1)
    const events = run(w, 60)
    expect(ev(events, 'sway')).toHaveLength(0)
    expect(events.filter((e) => e.type === 'stress' || e.type === 'collapse')).toHaveLength(0)
    expect(w.state(id)!.wind!.peak).toBeLessThan(0.001)
  })

  it('a slender frame reports its drift against H/500 and sways in the gust', () => {
    const w = createDestruction({ wind: { speed: 40 } })
    const id = w.add(slender())
    const st = w.state(id)!.wind!
    expect(st.limit).toBe(1 / 500)
    expect(st.drift).toBeGreaterThan(1e-4)
    expect(st.drift).toBeLessThan(st.limit)
    expect(st.status).toBe('ok')
    expect(st.frequency).toBeGreaterThan(0.3)
    expect(st.frequency).toBeLessThan(1.5)
    const events = ev(run(w, 120), 'sway')
    expect(events.length).toBeGreaterThan(1)
    const now = w.state(id)!.wind!
    expect(now.peak).toBeGreaterThan(0.005)
    expect(Math.abs(now.sway)).toBeLessThanOrEqual(now.peak + 1e-12)
    expect(events[events.length - 1].peak).toBeGreaterThan(events[0].peak)
    // direction of the event is the wind's, in world space
    expect(events[0].direction).toEqual([1, 0, 0])
  })

  it('a wind that pushes the drift past the limit says so once, with a sway event', () => {
    const w = createDestruction({ wind: { speed: 40, driftLimit: 1 / 5000 } })
    const id = w.add(slender())
    expect(w.state(id)!.wind!.status).toBe('drift')
    const events = ev(run(w, 5), 'sway')
    expect(events[0].status).toBe('drift')
    expect(events[0].drift).toBeGreaterThan(1 / 5000)
  })

  it('setWind changes the wind in play: a double speed makes four times the moment, and the direction turns the area', () => {
    const w = createDestruction({ wind: { speed: 30 } })
    const id = w.add(buildFrame({ floors: 3, spanX: 12, spanZ: 6, columnsZ: 2, continuousColumns: true }))
    const m30 = w.state(id)!.wind!.moment
    w.setWind({ speed: 60 })
    w.update(0.1)
    expect(w.state(id)!.wind!.speed).toBe(60)
    expect(w.state(id)!.wind!.moment / m30).toBeCloseTo(4, 6)
    const along = w.state(id)!.wind!.shear
    w.setWind({ direction: [0, 0, 1] })
    w.update(0.1)
    // turned to blow along z the area is the 12.5 m side instead of the 6.5 m one
    const ratio = along / w.state(id)!.wind!.shear
    expect(ratio).toBeGreaterThan(0.5)
    expect(ratio).toBeLessThan(0.53)
    expect(ev(w.update(0.1), 'sway').every((e) => Math.abs(e.direction[2]) === 1)).toBe(true)
  })

  it('an object can leave the wind, or set its own terrain', () => {
    const w = createDestruction({ wind: { speed: 40, terrain: 'II' } })
    const free = w.add({ ...slender(), wind: false })
    const open = w.add(slender())
    const city = w.add({ ...slender(), wind: { terrain: 'V' } })
    expect(w.state(free)!.wind).toBeUndefined()
    // the same wind is weaker at 40 m over a city than over open land
    expect(w.state(city)!.wind!.pressure).toBeLessThan(w.state(open)!.wind!.pressure)
  })

  it('the wind loads the walls and columns: windward side relieved, leeward side loaded', () => {
    const w = createDestruction({ wind: { speed: 40 } })
    const id = w.add(slender())
    const cols = w.state(id)!.parts.filter((p) => p.id.startsWith('column_0_'))
    const upwind = cols.filter((p) => p.id.endsWith('_0_0') || p.id.endsWith('_0_1'))
    const downwind = cols.filter((p) => p.id.endsWith('_2_0') || p.id.endsWith('_2_1'))
    for (const p of upwind) expect(p.wind!).toBeLessThan(0)
    for (const p of downwind) expect(p.wind!).toBeGreaterThan(0)
  })

  it('the wind tips a building on soft ground more than it leans without it', () => {
    const site = (): DestructibleSpec => ({
      ...sizeStructure(buildFrame({ floors: 10, spanX: 8, spanZ: 8, raft: true, continuousColumns: true, columnSize: 0.5, beamHeight: 0.5, roofThickness: 0.2 })), soil: 'clay_medium',
    })
    const still = createDestruction()
    const si = still.add(site())
    run(still, 10)
    const blown = createDestruction({ wind: { speed: 45 } })
    const bi = blown.add(site())
    run(blown, 10)
    const a = still.state(si)!.soil!, b = blown.state(bi)!.soil!
    expect(b.tilt).toBeGreaterThan(a.tilt * 3)
    // it leans downwind (+x)
    expect(b.direction[0]).toBeGreaterThan(0.9)
    expect(b.status).toBe('stable')
  })

  it('a damper adds mass to the load and cuts the swing by what the frequency response says', () => {
    const plain = createDestruction({ wind: { speed: 40 } })
    const tuned = createDestruction({ wind: { speed: 40 } })
    const pi = plain.add(slender())
    const ti = tuned.add(slender(true))
    const st = tuned.state(ti)!.wind!
    // 6 t over a modal mass of ~660 t is 0.9%: inside the 0.5 to 2% of the real ones
    expect(st.damper!.ratio).toBeGreaterThan(0.005)
    expect(st.damper!.ratio).toBeLessThan(0.02)
    expect(plain.state(pi)!.wind!.damper).toBeUndefined()
    expect(tuned.state(ti)!.parts.find((p) => p.id === 'roof')!.load!).toBeGreaterThan(plain.state(pi)!.parts.find((p) => p.id === 'roof')!.load!)
    const rms = (w: typeof plain, id: string) => {
      let sum = 0, n = 0
      for (let t = 0; t < 1500; t += 0.1) {
        w.update(0.1)
        if (t > 400) {
          const s = w.state(id)!.wind!.sway
          sum += s * s
          n++
        }
      }
      return Math.sqrt(sum / n)
    }
    const a = rms(plain, pi), b = rms(tuned, ti)
    // expected: the gust lines through the transfer function of the structure alone and with the tuned damper
    const f1 = st.frequency, mu = st.damper!.ratio
    const tune = damperTuning(mu)
    const terr = WIND_TERRAIN.find((t) => t.id === 'III')!
    const g = makeGust(40 * meanHeightFactor(10, terr, 'B', { meanRatio: 0.69 }), WIND_DEFAULTS.gust)
    let withDamper = 0, without = 0
    g.freq.forEach((f, k) => {
      withDamper += g.amp[k] ** 2 * damperAmplification(f / f1, mu, tune.frequency, tune.damping, 0.016) ** 2
      without += g.amp[k] ** 2 * damperAmplification(f / f1, 0, 1, 0, 0.016) ** 2
    })
    const expected = Math.sqrt(withDamper / without)
    expect(expected).toBeLessThan(0.85)
    expect(b / a).toBeGreaterThan(expected * 0.88)
    expect(b / a).toBeLessThan(expected * 1.12)
  }, 60000)

  it('saves and loads the sway and the damper', () => {
    const w = createDestruction({ wind: { speed: 40 } })
    const id = w.add(slender(true))
    run(w, 40)
    const copy = createDestruction({ wind: { speed: 40 } })
    copy.load(JSON.parse(JSON.stringify(w.serialize())))
    expect(copy.state(id)!.wind!.sway).toBeCloseTo(w.state(id)!.wind!.sway, 12)
    run(w, 10)
    run(copy, 10)
    expect(copy.state(id)!.wind!.sway).toBeCloseTo(w.state(id)!.wind!.sway, 9)
    expect(copy.state(id)!.wind!.damper!.travel).toBeCloseTo(w.state(id)!.wind!.damper!.travel, 9)
  })
})
