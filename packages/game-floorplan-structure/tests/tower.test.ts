import { describe, expect, it } from 'vitest'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent } from '@adatechnology/game-destruction'

import { CORE_DEFAULTS, MECHANICAL_DEFAULTS, TOWER_DEFAULTS, buildTower, coreSize, towerWater } from '../src'

type Ev<T extends DestructionEvent['type']> = Extract<DestructionEvent, { type: T }>
const storey = TOWER_DEFAULTS.height + TOWER_DEFAULTS.slabThickness
const yb = (f: number) => f * storey
const all = (r: Array<{ events: DestructionEvent[] }>) => r.flatMap((h) => h.events)
const run = (w: ReturnType<typeof createDestruction>, seconds: number): DestructionEvent[] => {
  const out: DestructionEvent[] = []
  for (let t = 0; t < seconds; t += 0.1) out.push(...w.update(0.1))
  return out
}

/** Building systems of a multi-storey building (design T10-estrutura-real.md §9). */
describe('tower', () => {
  const spec = buildTower()
  const part = (id: string) => spec.parts.find((p) => p.id === id)!

  it('stands at rest, sized, with nothing moving', () => {
    const w = createDestruction()
    const id = w.add(spec)
    const st = w.state(id)!
    expect(st.groups).toHaveLength(1)
    expect(Math.max(...st.parts.map((p) => p.stress ?? 0))).toBeLessThanOrEqual(0.65 + 1e-6)
    expect(run(w, 3).filter((e) => e.type === 'stress' || e.type === 'collapse' || e.type === 'fracture')).toHaveLength(0)
  })

  it('columns are continuous: each rests on the one below, not on the slab', () => {
    expect(spec.joints!.find((j) => j.a === 'column_5_1_1')!.b).toBe('column_4_1_1')
    expect(spec.joints!.some((j) => j.a === 'column_5_1_1' && j.b === 'slab_4')).toBe(false)
  })

  it('the core is a reinforced concrete tube from the foundation to the roof with the stairs and shafts inside', () => {
    const [W, L] = coreSize()
    expect(W).toBeCloseTo(2 * 0.35 + 2.6 + 0.2 + 2.4, 6)
    expect(L).toBeCloseTo(2 * 0.35 + 4.8, 6)
    const wall = part('core_7_w')
    expect(wall.shape).toEqual({ kind: 'box', size: [CORE_DEFAULTS.wallThickness, TOWER_DEFAULTS.height, L] })
    expect(wall.reinforcement).toEqual({ material: 'steel', spacing: 0.15, diameter: 0.0125 })
    expect(spec.joints!.find((j) => j.a === 'core_7_w')!.b).toBe('core_6_w')
    expect(spec.joints!.find((j) => j.a === 'core_0_w')!.b).toBe('core_mat')
    expect(spec.joints!.some((j) => j.a === 'slab_7' && j.b === 'core_7_n')).toBe(true)
    for (const id of ['stair_7_a', 'stair_7_b', 'landing_7', 'core_7_stair', 'core_7_shaft_1', 'elevator_0', 'elevator_1']) expect(part(id)).toBeDefined()
    // a flight rises half a storey over the run between the landings: about 34 degrees, inside the limits of a building stair
    const flight = part('stair_3_a')
    expect(Math.abs(flight.rotation![0]) * (180 / Math.PI)).toBeGreaterThan(30)
    expect(Math.abs(flight.rotation![0]) * (180 / Math.PI)).toBeLessThan(38)
  })

  it('in a blast the core is the strongest part: the same charge that takes out a column only breaches a core wall', () => {
    const f = 3
    const charge = 5 * 4.184e6
    // 1 m from the face of the column at (0, -4)
    const wc = createDestruction()
    const ic = wc.add(spec)
    wc.explode([1.3, yb(f) + 1.5, -4], charge, 10)
    run(wc, 6)
    const column = wc.part(ic, 'column_3_1_1')!
    expect(['broken', 'collapsed']).toContain(column.status)
    // 1 m from the face of the core
    const [, L] = coreSize()
    const wk = createDestruction()
    const ik = wk.add(spec)
    wk.explode([TOWER_DEFAULTS.spanX / 4, yb(f) + 1.5, -L / 2 - 1], charge, 10)
    const after = run(wk, 6)
    const core = wk.part(ik, 'core_3_s')!
    expect(core.status).toBe('damaged')
    expect(core.hp / core.maxHp).toBeGreaterThan(0.5)
    expect(after.filter((e) => e.type === 'collapse' && e.parts.some((p) => p.startsWith('core_') || p.startsWith('slab_')))).toHaveLength(0)
  })

  it('the curtain wall carries nothing, hangs from the slab edges and shatters in large shards that rain from the facade', () => {
    const glass = part('glass_5_n_0')
    expect(glass.structure).toBeUndefined()
    expect(glass.material).toBe('glass')
    expect(glass.mass).toBeCloseTo((2500 * 0.012 + 10) * (glass.shape as { size: number[] }).size[0] * storey, -1)
    const hang = spec.joints!.find((j) => j.a === 'glass_5_n_0')!
    expect(hang.b).toBe('slab_5')
    expect(hang.bears).toBe(false)
    // the mechanical floor has no glass
    expect(spec.parts.some((p) => p.id.startsWith(`glass_${TOWER_DEFAULTS.floors - 1}_`))).toBe(false)
    const w = createDestruction()
    const id = w.add(spec)
    const hz = (TOWER_DEFAULTS.spanZ + TOWER_DEFAULTS.columnSize + 0.2) / 2
    const events = all(w.explode([0, yb(5) + 1.5, hz + 3], 4.184e6, 10))
    const broken = events.filter((e): e is Ev<'fracture'> => e.type === 'fracture' && e.part.startsWith('glass_'))
    expect(broken.length).toBeGreaterThan(6)
    for (const e of broken) {
      expect(e.style).toBe('shatter')
      for (const fr of e.fragments) expect(Math.max(...fr.size)).toBeLessThanOrEqual(0.6 + 1e-9)
      expect(e.fragments.length).toBeGreaterThan(4)
    }
    expect(events.some((e) => e.type === 'fracture' && !e.part.startsWith('glass_'))).toBe(false)
    expect(w.state(id)!.parts.filter((p) => /^(column_|slab_|beam_|core_)/.test(p.id) && (p.status === 'broken' || p.status === 'collapsed'))).toHaveLength(0)
  })

  it('the flat roof: screed sloped to the drains and a membrane whose puncture leaks into the floor below', () => {
    const screed = part('roof_screed')
    const area = (TOWER_DEFAULTS.spanX + 0.8) * (TOWER_DEFAULTS.spanZ + 0.8)
    const drains = spec.parts.filter((p) => p.tags?.includes('drain'))
    expect(drains.length).toBe(Math.max(2, Math.ceil(area / 150)))
    // the mean screed thickness is the 2 cm at the drains plus half the 1% fall over the run to the farthest point
    const run1 = Math.hypot((TOWER_DEFAULTS.spanZ + 0.8) / drains.length / 2, (TOWER_DEFAULTS.spanX + 0.8) / 2)
    expect((screed.shape as { size: number[] }).size[1]).toBeCloseTo(0.02 + (0.01 * run1) / 2, 6)
    const membrane = part('roof_membrane')
    expect(membrane.material).toBe('rubber')
    expect(membrane.contains).toEqual({ fluid: 'water', liters: expect.closeTo(0.005 * area * 1000, 3), outflow: [0, -1, 0] })
    const w = createDestruction()
    const id = w.add(spec)
    const top = yb(TOWER_DEFAULTS.floors) + 0.5
    const events = all(w.shoot([2, top + 10, 2], [0, -1, 0], 3000, 9))
    const leak = events.find((e): e is Ev<'leak'> => e.type === 'leak')!
    expect(leak.part).toBe('roof_membrane')
    expect(leak.fluid).toBe('water')
    expect(leak.direction[1]).toBeCloseTo(-1, 9)
    const before = w.part(id, 'roof_membrane')!.liters!
    run(w, 2)
    expect(w.part(id, 'roof_membrane')!.liters!).toBeLessThan(before)
    // without a puncture the water stays (it goes to the drains)
    const dry = createDestruction()
    const d = dry.add(spec)
    run(dry, 2)
    expect(dry.part(d, 'roof_membrane')!.liters).toBe(before)
  })

  it('the mechanical floor: machines, water tank and chillers load the slab under the roof', () => {
    const liters = towerWater(TOWER_DEFAULTS.floors - 1)
    expect(liters).toBe(Math.round(16 * 200 * 0.4 * (TOWER_DEFAULTS.floors - 1) + 6000))
    const tank = part('water_tank')
    expect(tank.contains).toEqual({ fluid: 'water', liters })
    const machines = spec.parts.filter((p) => p.tags?.includes('elevator_machine'))
    expect(machines).toHaveLength(CORE_DEFAULTS.elevators)
    for (const m of machines) expect(m.mass).toBe(MECHANICAL_DEFAULTS.machineMass + MECHANICAL_DEFAULTS.suspendedMass)
    const equipment = spec.parts.filter((p) => p.tags?.includes('mechanical')).reduce((s, p) => s + p.mass!, 0)
    const w = createDestruction()
    const id = w.add(spec)
    const load = (pid: string) => w.part(id, pid)!.load!
    const under = `slab_${TOWER_DEFAULTS.floors - 2}`
    // the slab under the mechanical floor carries its equipment on top of what a floor carries
    expect(load(under) - load('slab_3')).toBeCloseTo(equipment, -2)
    const bare = createDestruction()
    const b = bare.add(buildTower({ mechanical: false }))
    expect(load('core_0_w') + load('column_0_1_1')).toBeGreaterThan(bare.part(b, 'core_0_w')!.load! + bare.part(b, 'column_0_1_1')!.load!)
    // a shot through the tank makes it leak
    const shot = all(w.shoot([-20, yb(TOWER_DEFAULTS.floors - 1) + 1, 0], [1, 0, 0], 3000, 9))
    expect(shot.some((e) => e.type === 'leak' && e.part === 'water_tank')).toBe(true)
  })

  it('every system can be turned off or configured', () => {
    const bare = buildTower({ core: false, facade: false, flatRoof: false, mechanical: false, floors: 4 })
    expect(bare.parts.some((p) => /^(core_|glass_|roof_|water_tank|machine_)/.test(p.id))).toBe(false)
    const custom = buildTower({ floors: 4, core: { elevators: 3, wallThickness: 0.4 }, facade: { material: 'tempered_glass', panel: 2 }, mechanical: { waterLiters: 5000, chillers: 0 } })
    expect(custom.parts.filter((p) => p.tags?.includes('elevator_car'))).toHaveLength(3)
    expect(custom.parts.find((p) => p.id === 'glass_0_n_0')!.material).toBe('tempered_glass')
    expect(custom.parts.find((p) => p.id === 'water_tank')!.contains!.liters).toBe(5000)
    expect(custom.parts.some((p) => p.id.startsWith('chiller_'))).toBe(false)
  })
})
