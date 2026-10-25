import { describe, expect, it } from 'vitest'
import { engine } from '@adatechnology/game-floorplan'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { register, OFFICE_TOWER_DEFAULTS, buildOfficeTower, officeTowerLayout, officeTowerTemplate } from '../src'
import en from '../src/locales/en.json'
import ptBR from '../src/locales/pt-BR.json'

registerResidential(engine, { region: 'br' })
register(engine, { region: 'br' })

/** The office tower (design T10-estrutura-real.md §11): the plan of a skyscraper, from the same layout as its structure. */
describe('office tower', () => {
  const plan = engine.generate('office_tower', { seed: 7, floors: 20, locale: 'en' }) as any
  const layout = officeTowerLayout({ storeys: 20 })

  it('is registered as a commercial template whose storeys are an option, clamped by the zone', () => {
    const t = engine.listTemplates().find((x) => x.id === 'office_tower')!
    expect(t.use).toBe('commercial')
    expect((t as { floorRange?: number[] }).floorRange).toEqual([20, 60])
    const zt = engine.listZones().find((z) => z.id === 'zt')!
    expect(zt.maxFloors).toBe(60)
    expect(zt.maxHeight).toBe(240)
    const zc = engine.generate('office_tower', { seed: 7, floors: 60, zone: 'zc', locale: 'en' }) as any
    expect(zc.floors.length).toBeLessThanOrEqual(24)
  })

  it('60 storeys is the default maximum and the preset range raises it', () => {
    expect(OFFICE_TOWER_DEFAULTS.range).toEqual([20, 60])
    expect(officeTowerLayout({ storeys: 80 }).storeys).toBe(60)
    expect(officeTowerLayout({ storeys: 80, range: [20, 80] }).storeys).toBe(80)
  })

  it('the game configures the tower at generation: floors wins over tower.storeys, every field of tower is reachable, the max is raised by tower.range', () => {
    const gen = (o: object) => (engine.generate('office_tower', { seed: 7, locale: 'en', ...o }) as any).config.tower
    expect(gen({ floors: 24, tower: { storeys: 30 } }).storeys).toBe(24)
    expect(gen({ tower: { storeys: 30 } }).storeys).toBe(30)
    expect(officeTowerLayout({ storeys: 90 }).storeys).toBe(60)
    expect(gen({ floors: 62, tower: { range: [20, 62] } }).storeys).toBe(62)
    const t = gen({ floors: 30, tower: { height: 3.2, bay: [10, 10], slenderness: false, facade: 'punched', mechanicalEvery: 10, damperAbove: false, piles: { diameter: 1 }, wind: { speed: 30, terrain: 'III' } } })
    expect(t).toMatchObject({ storeys: 30, height: 3.2, bay: [10, 10], facade: 'punched', damper: false, mechanical: [10, 20, 29] })
    const layout = officeTowerLayout({ storeys: 30, piles: { diameter: 1 }, wind: { speed: 30, terrain: 'III' } })
    expect(layout.tower.wind).toEqual({ speed: 30, terrain: 'III' })
    expect(buildOfficeTower({ storeys: 20, piles: { diameter: 1 } }).parts.find((p) => p.id === 'raft')!.structure!.pile!.diameter).toBe(1)
  })

  it('the plan is the plate of the layout, one storey per storey of the structure with the same pitch', () => {
    expect([plan.w, plan.d]).toEqual(layout.plate)
    expect(plan.floors).toHaveLength(20)
    expect(plan.floors.every((f: { ceiling: number }) => f.ceiling === layout.pitch)).toBe(true)
    expect(plan.config.tower).toMatchObject({ storeys: 20, pitch: layout.pitch, total: layout.total, mechanical: layout.mechanical })
    expect(plan.missing).toEqual([])
  })

  it('every storey has the stairs, one elevator per shaft of the core and a lobby; the stairs link the storeys', () => {
    for (let f = 0; f < 20; f++) {
      const rooms = plan.rooms.filter((r: { floor: number }) => r.floor === f)
      expect(rooms.filter((r: { type: string }) => r.type === 'elevator')).toHaveLength(layout.core!.elevators)
      expect(rooms.some((r: { id: string }) => r.id === `lobby_${f}`)).toBe(true)
      const stairs = rooms.find((r: { type: string }) => r.type === 'stairs')
      expect(stairs.link).toEqual(f < 19 ? [f, f + 1] : [f - 1, f])
    }
  })

  it('the ground floor has the entrance lobby with a 3 m door on the front, reception and the security desk; the top one has plant rooms and no windows', () => {
    const door = plan.doors.find((d: { a: string; b: string }) => d.b === 'outside')
    expect(door).toMatchObject({ a: 'lobby_0_entrance', side: 'front', width: 3, exterior: true })
    expect(plan.rooms.filter((r: { floor: number }) => r.floor === 0).map((r: { label: string }) => r.label)).toEqual(expect.arrayContaining(['reception', 'lobby_entrance', 'security_desk', 'stockroom']))
    const top = plan.rooms.filter((r: { floor: number }) => r.floor === 19)
    expect(top.filter((r: { label: string }) => r.label === 'plant_room')).toHaveLength(4)
    expect(plan.windows.filter((w: { floor: number }) => w.floor === 19)).toHaveLength(0)
    const typical = plan.rooms.filter((r: { floor: number }) => r.floor === 5)
    expect(typical.filter((r: { type: string }) => r.type === 'office').length).toBeGreaterThanOrEqual(9)
    expect(typical.some((r: { id: string }) => r.id === 'restroom_5')).toBe(true)
    expect(plan.windows.filter((w: { floor: number }) => w.floor === 5).length).toBeGreaterThan(30)
  })

  it('the suites are furnished as open-plan offices', () => {
    const desks = plan.items.filter((i: { room: string; type: string }) => i.room.startsWith('suite_5_') && /desk/.test(i.type))
    expect(desks.length).toBeGreaterThan(12)
  })

  it('one can walk from the street to every room of the tower: the doors, the open pairs and the stairs', () => {
    const edges = new Map<string, Set<string>>()
    const link = (a: string, b: string) => { (edges.get(a) ?? edges.set(a, new Set()).get(a)!).add(b); (edges.get(b) ?? edges.set(b, new Set()).get(b)!).add(a) }
    for (const d of plan.doors) link(d.a, d.b)
    for (const [a, b] of plan.openPairs ?? []) link(a, b)
    for (const r of plan.rooms) if (r.type === 'stairs' && r.link) for (const other of plan.rooms) if (other.type === 'stairs' && other.floor === r.link[1]) link(r.id, other.id)
    const seen = new Set<string>(['outside'])
    const queue = ['outside']
    while (queue.length) for (const n of edges.get(queue.shift()!) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n) }
    const stuck = plan.rooms.filter((r: { id: string; type: string }) => !seen.has(r.id) && r.type !== 'elevator').map((r: { id: string }) => r.id)
    expect(stuck).toEqual([])
  })

  it('every number is an option: the storeys, the height, the bays and the facade of the layout; the template of a game has its own preset', () => {
    const custom = officeTowerTemplate({ ...OFFICE_TOWER_DEFAULTS, storeys: 30, range: [24, 60], height: 3.2, bay: [9, 9] }, { suite: 6, restrooms: false })
    expect(custom.floorRange).toEqual([24, 60])
    expect(custom.floorsFn!({})).toHaveLength(30)
    expect(custom.floorsFn!({ floors: 26 })).toHaveLength(26)
    expect(custom.floorsFn!({ floors: 90 })).toHaveLength(60)
    const small = officeTowerLayout({ storeys: 30, height: 3.2, bay: [9, 9], slenderness: false }, { ...OFFICE_TOWER_DEFAULTS, range: [24, 60] })
    expect(small.plate[0]).toBeLessThan(layout.plate[0])
    const floors = custom.floorsFn!({ floors: 24 })
    const { w, d } = custom.defaultsFn!({ floors: 24 })
    expect(floors[3].rooms(w, d, {}).filter((r) => r.id === 'restroom_3')).toHaveLength(0)
    expect(engine.generate('office_tower', { seed: 1, floors: 20, tower: { height: 3.0 } }).floors[1].ceiling).toBeCloseTo(3.4, 6)
  })

  it('the structure of the same layout is the tower of game-floorplan-structure with the numbers of the typology (it stands: see its tests)', () => {
    const spec = buildOfficeTower({ storeys: 20 })
    expect(spec.parts.some((p) => p.id === 'core_19_n')).toBe(true)
    expect(spec.parts.some((p) => p.id === 'glass_5_n_0')).toBe(true)
    expect(spec.parts.find((p) => p.id === 'raft')!.structure!.pile!.count).toBeGreaterThan(20)
    // the plate of the plan is the slab of the structure
    const slab = spec.parts.find((p) => p.id === 'slab_5')!
    expect((slab.shape as { size: number[] }).size[0]).toBeCloseTo(layout.plate[0], 6)
  })

  it('has the names in both languages', () => {
    for (const locale of [en, ptBR]) {
      expect(locale.templates.office_tower).toBeTruthy()
      for (const key of ['office_suite', 'washrooms', 'reception', 'security_desk', 'lobby_entrance']) expect((locale.labels as Record<string, string>)[key]).toBeTruthy()
    }
    const pt = engine.generate('office_tower', { seed: 7, floors: 20, locale: 'pt-BR' }) as any
    expect(pt.name).toBe('Torre de escritórios')
    expect(pt.floors[1].name).toBe('Andar tipo')
    expect(pt.rooms.find((r: { id: string }) => r.id === 'restroom_3').name).toBe('Sanitários')
  })
})
