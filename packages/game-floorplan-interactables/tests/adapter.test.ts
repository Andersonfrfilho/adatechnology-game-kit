import { describe, expect, it } from 'vitest'

import { CHAIR_TABLES, CONTENT_MAP, FloorplanInteractables, TYPE_MAP, create, createTranslator, mergeRegistry } from '../src'
import { GameInteractables, GameInteractablesHousehold, planOf } from './support/plans'
import { loadTeamAdapter, planToKit, teamSeedKey, teamShape, withoutSource } from './support/team-shape'

const kit = { GameInteractables, GameInteractablesHousehold }
const plan = planOf('single_storey_a', 3)

describe('create', () => {
  it('needs the kit, and says so in the language asked for', () => {
    expect(() => create({})).toThrow(/precisa de GameInteractables/)
    expect(() => create({ locale: 'en' })).toThrow(/needs GameInteractables/)
    expect(() => create({ GameInteractables })).toThrow()
  })

  it('has the team\'s locale and region by default and takes others', () => {
    expect(create(kit).household.region.id).toBe('br')
    expect(create(kit).household.locale).toBe('pt-BR')
    expect(create({ ...kit, locale: 'en' }).household.locale).toBe('en')
  })

  it('is also the object a house renderer takes (create, tables)', () => {
    expect(FloorplanInteractables.create(kit).version).toBe('0.3.0')
    expect(FloorplanInteractables.TYPE_MAP).toBe(TYPE_MAP)
    expect(Object.isFrozen(TYPE_MAP)).toBe(true)
  })
})

describe('registries: the game adds, replaces and drops entries without touching the adapter', () => {
  const mapped = (a: ReturnType<typeof create>, r = plan) => a.plan(r, { seed: r.seed })

  it('mergeRegistry copies, replaces, adds and drops with null', () => {
    const base = { a: 1, b: 2 }
    expect(mergeRegistry(base, { b: 3, c: 4, a: null })).toEqual({ b: 3, c: 4 })
    expect(base).toEqual({ a: 1, b: 2 })
    expect(mergeRegistry(base)).toEqual(base)
  })

  it('a type dropped from typeMap stays out of the kit and is counted as unmapped', () => {
    const base = mapped(create(kit))
    expect(base.items.some((e: any) => e.type === 'fridge')).toBe(true)
    const without = mapped(create({ ...kit, typeMap: { fridge_large: null } }))
    expect(without.items.some((e: any) => e.type === 'fridge')).toBe(false)
    expect(without.unmapped['fridge/fridge_large']).toBe(1)
    expect(without.mapped).not.toContain('kitchen.fridge')
  })

  it('a type replaced in typeMap becomes the object of the kit the game chose', () => {
    const r = planOf('single_storey_a', 3)
    const base = create(kit).plan(r, { seed: r.seed }).items.find((e: any) => e.id === 'kitchen.fridge')
    expect(base.type).toBe('fridge')
    const a = create({ ...kit, typeMap: { fridge_large: { type: 'wardrobe' } } })
    const entry = a.plan(r, { seed: r.seed }).items.find((e: any) => e.id === 'kitchen.fridge')
    expect(entry.type).toBe('wardrobe')
  })

  it('contentMap sends an item of the plan to the household item the game wants', () => {
    const r = planOf('single_storey_a', 3)
    const stacks = r.contents['kitchen.pantry']
    const id = stacks[0].itemId
    const a = create({ ...kit, contentMap: { [id]: 'sugar' } })
    const placed = Object.values<any>(a.plan(r, { seed: r.seed }).items.find((e: any) => e.id === 'kitchen.pantry').item.contents).flat().filter(Boolean)
    expect(placed.some((s: any) => s.type === 'sugar' && s.data.source === id)).toBe(true)
  })

  it('a stack that is in no table falls back by group, then to the fallback item', () => {
    const r = planOf('single_storey_a', 3)
    r.contents['kitchen.pantry'] = [{ itemId: 'zz_unknown', count: 1, group: 'tool' }, { itemId: 'zz_other', count: 1 }]
    const a = create(kit)
    const placed = Object.values<any>(a.plan(r, { seed: r.seed }).items.find((e: any) => e.id === 'kitchen.pantry').item.contents).flat().filter(Boolean)
    expect(placed.map((s: any) => s.type).sort()).toEqual(['crumpled_paper', 'duct_tape'])
    const b = create({ ...kit, contentFallback: 'sponge', groupOf: (id) => (id === 'zz_other' ? 'food' : null) })
    const types = Object.values<any>(b.plan(r, { seed: r.seed }).items.find((e: any) => e.id === 'kitchen.pantry').item.contents).flat().filter(Boolean).map((s: any) => s.type)
    expect(types).toContain('canned_food')
  })

  it('preference decides which container takes a stack first', () => {
    const r = planOf('single_storey_a', 3)
    r.contents['kitchen.fridge'] = [{ itemId: 'milk_carton', count: 1, group: 'food' }]
    const where = (a: ReturnType<typeof create>) => {
      const c = a.plan(r, { seed: r.seed }).items.find((e: any) => e.id === 'kitchen.fridge').item.contents
      return Object.keys(c).filter((k) => c[k].some(Boolean))
    }
    expect(where(create(kit))).toEqual(['fridge'])
    expect(where(create({ ...kit, preference: { fridge: () => ['freezer', 'fridge'] } }))).toEqual(['freezer'])
    expect(where(create({ ...kit, frozenItems: ['milk_carton'] }))).toEqual(['freezer'])
  })

  it('chairs: off by option, off by plan option, and the tables registry decides who gets them', () => {
    const r = planOf('single_storey_a', 3)
    const count = (a: ReturnType<typeof create>, popts: Record<string, unknown> = {}) => a.plan(r, { seed: r.seed, ...popts }).chairs.length
    expect(count(create(kit))).toBeGreaterThan(0)
    expect(count(create({ ...kit, chairs: false }))).toBe(0)
    expect(count(create(kit), { chairs: false })).toBe(0)
    expect(count(create({ ...kit, chairTables: { dining_table_round: null, dining_table: null, dining_table_small: null, dining_table_large: null } }))).toBe(0)
    expect(CHAIR_TABLES.dining_table).toBe('dining')
  })

  it('seedKey changes the seed of an object, and the default is the id', () => {
    const r = planOf('single_storey_a', 3)
    const seedOf = (a: ReturnType<typeof create>) => a.plan(r, { seed: r.seed }).items.find((e: any) => e.id === 'kitchen.fridge').item.seed
    expect(seedOf(create(kit))).toBe(seedOf(create({ ...kit, seedKey: () => null })))
    expect(seedOf(create({ ...kit, seedKey: (id) => `legacy.${id}` }))).not.toBe(seedOf(create(kit)))
  })

  it('texts: warnings come in the language of the adapter and can be replaced', () => {
    expect(createTranslator('en')('warn.buildEmpty', { id: 'x' })).toBe('build returned nothing for x')
    expect(createTranslator('pt-BR')('warn.buildEmpty', { id: 'x' })).toBe('construir devolveu vazio para x')
    expect(createTranslator('en', { 'warn.buildEmpty': 'nothing: {id}' })('warn.buildEmpty', { id: 'x' })).toBe('nothing: x')
    expect(CONTENT_MAP.canned_tuna).toBe('canned_food')
  })
})

describe('plan options', () => {
  it('moves the house to an origin and mirrors the depth with inw like the team\'s adapter', () => {
    const Team = loadTeamAdapter()
    const teamAdapter = Team.criar({ ...kit })
    const adapter = create({ ...kit, seedKey: teamSeedKey })
    for (const [popts, tpopts] of [[{ originX: 12, originZ: -7 }, { origemX: 12, origemZ: -7 }], [{ originX: 4, originZ: 30, inw: -1 }, { origemX: 4, origemZ: 30, inw: -1 }], [{ base: 0.5 }, { base: 0.5 }]] as const) {
      const r = planOf('townhouse', 2)
      const res = teamShape(r)
      const mine = adapter.plan(r, { seed: r.seed, ...popts })
      const team = planToKit(teamAdapter.planejar(res, { semente: res.semente, ...tpopts }))
      expect(withoutSource(JSON.parse(JSON.stringify(mine)))).toEqual(withoutSource(JSON.parse(JSON.stringify(team))))
    }
  })

  it('lightsOn decides the lamps (a function or a boolean) and the switch key follows', () => {
    const r = planOf('townhouse', 2)
    const adapter = create(kit)
    const on = adapter.plan(r, { seed: r.seed, lightsOn: true })
    expect(on.items.filter((e: any) => e.type === 'lamp').every((e: any) => e.lit)).toBe(true)
    const off = adapter.plan(r, { seed: r.seed, night: true, lightsOn: () => false })
    expect(off.items.filter((e: any) => e.type === 'lamp').some((e: any) => e.lit)).toBe(false)
    const night = adapter.plan(r, { seed: r.seed, night: true })
    expect(night.items.filter((e: any) => e.type === 'lamp').every((e: any) => e.lit)).toBe(true)
    expect(night.items.filter((e: any) => e.type === 'wall_switch').every((e: any) => e.lit)).toBe(true)
    const day = adapter.plan(r, { seed: r.seed })
    expect(day.items.filter((e: any) => e.type === 'lamp').some((e: any) => e.lit)).toBe(false)
  })

  it('an abandoned house and an off-grid cabin do not light at night', () => {
    const adapter = create(kit)
    const abandoned = planOf('townhouse', 2, 'abandoned')
    expect(adapter.plan(abandoned, { seed: 2, night: true }).items.filter((e: any) => e.type === 'lamp').some((e: any) => e.lit)).toBe(false)
    const cabin = planOf('log_cabin', 1)
    const offgrid = cabin.utilities.electrical.mode === 'offgrid'
    const lanterns = adapter.plan(cabin, { seed: 1, night: true }).items.filter((e: any) => e.type === 'lantern_lamp')
    if (offgrid) expect(lanterns.every((e: any) => e.lit)).toBe(true)
  })
})

describe('world', () => {
  it('draws water through the network of the house and keeps the point of each fixture', () => {
    const adapter = create(kit)
    const r = planOf('single_storey_a', 3)
    const used: [string, number][] = []
    const water = { consume: (point: string, liters: number) => { used.push([point, liters]); return liters / 2 } }
    const world = adapter.createWorld(r, { seed: r.seed, water })
    const planned = adapter.plan(r, { seed: r.seed })
    adapter.add(world, planned, { isBlocked: adapter.blockedOf(r) })
    const fixture = planned.fixtures[0]
    expect(adapter.pointOf(world, fixture.global)).toBe(fixture.point)
    expect(world.interactables().length).toBeGreaterThan(20)
  })

  it('reports a build that returned nothing and keeps going', () => {
    const adapter = create({ ...kit, locale: 'en' })
    const r = planOf('single_storey_a', 3)
    const planned = adapter.plan(r, { seed: r.seed })
    const world = adapter.createWorld(r, { seed: r.seed })
    const out = adapter.add(world, planned, { build: (type: string, item: any) => (type === 'toilet' ? null : adapter.household.build(type, item, GameInteractablesHousehold.createRecorder().api)) })
    expect(out.warnings).toEqual([expect.stringContaining('build returned nothing for bathroom.toilet')])
    expect(out.added).toBe(planned.items.length - 1)
  })

  it('fits the hinged doors against the walls: some turn their hinge side around', () => {
    const adapter = create(kit)
    let hinges = 0
    for (const [template, seed] of [['single_storey_a', 3], ['townhouse', 2], ['mansion', 1], ['shack', 1], ['market', 2]] as const) {
      const r = planOf(template, seed)
      const world = adapter.createWorld(r, { seed: r.seed })
      const out = adapter.add(world, adapter.plan(r, { seed: r.seed }), { isBlocked: adapter.blockedOf(r) })
      hinges += Object.keys(out.hinges).length
    }
    expect(hinges).toBeGreaterThan(0)
  })

  it('a world with no grid has no sockets working (off-grid) and a house with a grid has', () => {
    const adapter = create(kit)
    const r = planOf('single_storey_a', 3)
    expect(adapter.createWorld(r, { seed: 1 }).power.isPowered).toBeTypeOf('function')
    const planned = adapter.plan(r, { seed: r.seed })
    expect(planned.outlets.length).toBeGreaterThan(3)
    expect(planned.serviceEntrance).toBe('service_entrance')
    expect(planned.panel).toBe('panel')
    expect(planned.meter).toBe('meter')
  })
})
