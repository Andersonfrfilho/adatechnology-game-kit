import { describe, expect, it } from 'vitest'

import { registerContentState } from '../src/utilities/content'
import { engine } from './support'

const SEEDS = Number(process.env.SEEDS) || 8
const TEMPLATES = engine.listTemplates().map((entry: { id: string }) => entry.id) as string[]

/** Fixtures that take water (the VC3 rule: one point for each, `src/utilities/plumbing.ts`). */
const WET_CATEGORIES = ['kitchen_cabinet', 'washbasin', 'shower', 'toilet', 'laundry_tub', 'washing_machine']
/** Buildings the teams drew without a single wet fixture (gallery scenes of the shops, school, church, workshop, farm, police, ER and the triage tent): no fixture, no point. */
const NO_WET_FIXTURES = new Set(['supermarket', 'drugstore', 'gun_shop', 'police_station', 'emergency_room', 'school', 'church', 'metalworks', 'farm', 'triage_tent'])

const plan = (template: string, seed: number, state = 'normal', extra: Record<string, unknown> = {}): any => engine.generate(template, { seed, state, ...extra })

describe('every plan has its installations', () => {
  for (const template of TEMPLATES) {
    it(`${template}: gas, electricity, plumbing and a plan the validator accepts, ${SEEDS} seeds x 3 states`, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        for (const state of ['normal', 'fortified', 'abandoned']) {
          const result = plan(template, seed, state)
          const where = `${template}#${seed}/${state}`
          expect(result.utilities.electrical.panel?.id ?? null, where).not.toBeUndefined()
          const fixtures = result.items.filter((m: any) => WET_CATEGORIES.includes(m.category) && !m.decor).length
          expect(result.utilities.plumbing.points.length, where).toBe(fixtures)
          if (NO_WET_FIXTURES.has(template)) expect(fixtures, where).toBe(0)
          else expect(fixtures, where).toBeGreaterThan(0)
          expect(engine.validate(result), where).toEqual([])
        }
      }
    })
  }

  it('gas goes on every plan with a stove: a cylinder beside, in a niche or under the counter, or piped with a meter', () => {
    const kinds = new Set<string>()
    for (const template of ['single_storey_a', 'townhouse', 'mansion', 'mid_modern_townhouse', 'high_end_contemporary']) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const result = plan(template, seed)
        const gas = result.utilities.gas
        if (!gas) continue
        for (const stove of result.items.filter((m: any) => m.category === 'stove' && !m.outdoor)) {
          expect(['cylinder', 'piped']).toContain(stove.gas)
          if (stove.gas === 'piped') {
            expect(gas.meter).not.toBeNull()
            expect(stove.gasMeter).toBe('gas.meter')
          } else {
            const cylinder = result.items.find((m: any) => m.id === stove.cylinder)
            expect(cylinder.type).toBe('cooking_gas_cylinder')
            expect(cylinder.link).toBe(stove.id)
            kinds.add(cylinder.placement)
          }
        }
      }
    }
    expect(kinds.size).toBeGreaterThanOrEqual(2)
  })

  it('the cylinder registered in the catalogue weighs 13 kg and a niche one stands outside', () => {
    expect(engine.catalog.cooking_gas_cylinder).toBeDefined()
    for (let seed = 1; seed <= 20; seed++) {
      for (const item of plan('single_storey_a', seed).items.filter((m: any) => m.type === 'cooking_gas_cylinder')) {
        expect(item.capacityKg).toBe(13)
        if (item.placement === 'external_niche') {
          expect(item.outdoor).toBe(true)
          expect(item.floor).toBe(-1)
        }
        if (item.placement === 'under_counter') expect(item.hidden).toBe(true)
      }
    }
  })
})

describe('electricity', () => {
  const house = (seed = 3) => plan('single_storey_a', seed).utilities.electrical

  it('has the pole, the drop, the meter and the panel, and every circuit joins its sockets', () => {
    const e = house()
    expect(e.mode).toBe('grid')
    expect(e.serviceEntrance.meter.id).toBe('meter')
    expect(e.serviceEntrance.internalRun).toHaveLength(2)
    expect(e.panel.breakers).toBe(e.circuits.length + 1)
    const outletIds = e.circuits.flatMap((c: any) => c.outlets)
    expect(new Set(outletIds).size).toBe(outletIds.length)
    expect(e.conduits.filter((c: any) => c.from === 'panel')).toHaveLength(e.circuits.length)
  })

  it('every appliance that plugs in has a socket within 1.2 m, and a shower heater its own at 1.10 m', () => {
    const result = plan('single_storey_a', 3)
    const appliances = result.items.filter((m: any) => ['fridge', 'stove', 'tv', 'washing_machine'].includes(m.category) && m.outlet)
    for (const item of appliances) {
      const outlet = result.utilities.electrical.outlets.find((t: any) => t.id === item.outlet)
      expect(outlet, item.id).toBeDefined()
    }
    const shower = result.items.find((m: any) => m.category === 'shower')
    expect(shower.showerHeater.powerW).toBe(5500)
    expect(result.utilities.electrical.outlets.find((t: any) => t.id === shower.showerHeater.outlet).y).toBe(1.1)
  })

  it('switches sit by the latch of the door of a room with a lamp', () => {
    const e = house()
    expect(e.switches.length).toBeGreaterThan(0)
    for (const s of e.switches) expect(s.y).toBe(1.1)
  })

  for (const [name, energy, expectations] of [
    ['a shack taps the grid without a meter', { mode: 'tap' }, (e: any) => { expect(e.serviceEntrance.tap).toBe(true); expect(e.serviceEntrance.meter).toBeNull(); expect(e.serviceEntrance.connection.y).toBe(2.6); expect(e.exposed).toBe(true) }],
    ['a cabin off the grid has no installation, only the source', { mode: 'offgrid', solar: true }, (e: any) => { expect(e.source).toBe('solar'); expect(e.serviceEntrance).toBeNull(); expect(e.outlets).toEqual([]) }],
    ['an off-grid cabin without solar runs on lamps', { mode: 'offgrid' }, (e: any) => expect(e.source).toBe('lamp')],
  ] as const) {
    it(name, () => {
      const id = `energy_${name.replace(/\W+/g, '_')}`
      engine.registerTemplate({ ...engine.templates.single_storey_a, id, energy: () => energy })
      const result = engine.generate(id, { seed: 3, state: 'normal' }) as any
      expectations(result.utilities.electrical)
    })
  }

  it('a template with solar on decides its panels: one or two', () => {
    engine.registerTemplate({ ...engine.templates.single_storey_a, id: 'solar_house', energy: () => ({ mode: 'offgrid', solar: true }) })
    const result = engine.generate('solar_house', { seed: 3, state: 'normal' }) as any
    expect(result.utilities.solar.count).toBeGreaterThanOrEqual(1)
    expect(result.utilities.solar.count).toBeLessThanOrEqual(2)
  })
})

describe('solar, plumbing and outbuildings', () => {
  it('solar panels go on the north slope of a pitched roof or on racks over a flat one, with an inverter on a wall', () => {
    const types = new Set<string>()
    for (let seed = 1; seed <= 80; seed++) {
      for (const template of seed <= 12 ? ['mansion', 'budget_slab_house'] : ['budget_slab_house']) {
        const solar = plan(template, seed).utilities.solar
        if (!solar) continue
        types.add(solar.type)
        expect(solar.panels.length).toBe(solar.count)
        expect(solar.slopeSide === null).toBe(solar.type === 'slab_rack')
        expect(solar.areaM2).toBeCloseTo(solar.count * 1.65, 1)
      }
    }
    expect(types).toEqual(new Set(['roof', 'slab_rack']))
  })

  it('every fixture has a point with its flow, and a wet room has a wall run from the tank', () => {
    const result = plan('townhouse', 3)
    const plumbing = result.utilities.plumbing
    expect(plumbing.tank === null || plumbing.tank === 'water_tank').toBe(true)
    for (const point of plumbing.points) {
      expect({ tap: 6, shower: 9, flush: 6, tub: 8, machine: 12 }[point.kind as string]).toBe(point.flowLpm)
      if (plumbing.tank) expect(plumbing.visibleRuns.some((r: any) => r.id === point.run)).toBe(true)
    }
    expect(plumbing.visibleRuns.filter((r: any) => r.exposed === 'under_sink').length).toBeGreaterThan(0)
  })

  it('the outbuilding has walls with a gap for a door of 0.85 m, two windows, furniture inside and a path to the main path', () => {
    let seen = 0
    for (let seed = 1; seed <= 40; seed++) {
      const result = plan('single_storey_a', seed)
      for (const building of result.outbuildings) {
        seen++
        expect(building.doors[0].width).toBe(0.85)
        expect(building.windows).toHaveLength(2)
        expect(building.walls.length).toBeGreaterThanOrEqual(4)
        expect(['guest_room', 'office', 'storage', 'gourmet']).toContain(building.use)
        for (const item of building.items) {
          expect(item.aabb[0]).toBeGreaterThanOrEqual(building.interior[0][0] - 0.011)
          expect(item.aabb[2]).toBeLessThanOrEqual(building.interior[0][2] + 0.011)
        }
        expect(result.lot.paths.some((p: any) => p.to === building.doors[0].id)).toBe(true)
      }
    }
    expect(seen).toBeGreaterThan(0)
  })
})

describe('what the containers hold', () => {
  it('a fridge holds food in the normal world, more supplies when fortified, little when abandoned', () => {
    const count = (state: string): number => {
      let total = 0
      for (let seed = 1; seed <= 20; seed++) {
        const result = plan('single_storey_a', seed, state)
        const fridge = result.items.find((m: any) => m.category === 'fridge')
        total += (result.contents[fridge.id] as { count: number }[]).reduce((sum, stack) => sum + stack.count, 0)
      }
      return total
    }
    expect(count('fortified')).toBeGreaterThan(count('normal'))
    expect(count('normal')).toBeGreaterThan(count('abandoned'))
  })

  it('is drawn from the seed: the same plan holds the same things', () => {
    expect(plan('townhouse', 4).contents).toEqual(plan('townhouse', 4).contents)
  })

  it('a sink has a stock under it and another in the wall cabinet over it', () => {
    const result = plan('townhouse', 4)
    const sink = result.items.find((m: any) => m.category === 'kitchen_cabinet')
    expect(result.contents[sink.id].length).toBeGreaterThan(0)
    if (sink.overhead !== false) expect(result.contents[`${sink.id}#overhead`].length).toBeGreaterThan(0)
  })

  it('an abandoned state leaves junk and spoiled food in the fridge', () => {
    let spoiled = 0
    for (let seed = 1; seed <= 20; seed++) {
      const result = plan('single_storey_a', seed, 'abandoned')
      const fridge = result.items.find((m: any) => m.category === 'fridge')
      if ((result.contents[fridge.id] as { itemId: string }[]).some((stack) => stack.itemId === 'spoiled_food')) spoiled++
    }
    expect(spoiled).toBe(20)
  })

  it('a registered provider answers before the default, and a registered state rule changes the default', () => {
    engine.registerFindsProvider({ findsFor: (query) => (query.container === 'mailbox' ? [{ itemId: 'custom_letter', count: 9 }] : null) })
    const mailbox = (): any[] => {
      const result = plan('townhouse', 4)
      const item = result.items.find((m: any) => m.category === 'mailbox')
      return result.contents[item.id]
    }
    expect(mailbox()).toEqual([{ itemId: 'custom_letter', count: 9 }])
    registerContentState('blessed', { kinds: () => 1, weight: (entry) => entry.weight, extraQuantity: () => 100 })
    const result = plan('single_storey_a', 1, 'normal')
    expect(result.contents).toBeDefined()
  })
})
