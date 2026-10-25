import { describe, expect, it } from 'vitest'
import { engine } from '@adatechnology/game-floorplan'
import { register, RESIDENTIAL_TOWER_DEFAULTS, buildResidentialTower, residentialTowerLayout, residentialTowerTemplate } from '../src'
import en from '../src/locales/en.json'
import ptBR from '../src/locales/pt-BR.json'

register(engine, { region: 'br' })

/** The residential tower (design T10-estrutura-real.md §11): the plan of an apartment skyscraper, from the same layout as its structure. */
describe('residential tower', () => {
  const plan = engine.generate('residential_tower', { seed: 4, floors: 20, locale: 'en' }) as any
  const layout = residentialTowerLayout({ storeys: 20 })

  it('is registered as a multi-family residential template whose storeys are an option, and the zone zt holds it', () => {
    const t = engine.listTemplates().find((x) => x.id === 'residential_tower')!
    expect(t.use).toBe('residential_multi')
    expect((t as { floorRange?: number[] }).floorRange).toEqual([20, 60])
    const zt = engine.getZone('zt')!
    expect([zt.maxFloors, zt.maxHeight]).toEqual([80, 320])
    expect(zt.allowedUses).toContain('residential_multi')
    const inZt = engine.generate('residential_tower', { seed: 4, floors: 60, zone: 'zt' }) as any
    expect(inZt.floors).toHaveLength(60)
    expect(inZt.zoning.violations).toEqual([])
    const inZr3 = engine.generate('residential_tower', { seed: 4, floors: 60, zone: 'zr3_zm' }) as any
    expect(inZr3.floors.length).toBeLessThanOrEqual(12 + 8)
  })

  it('the plan is the plate of the layout with the pitch of the structure, 2.8 m storeys on 9 m bays and a punched facade', () => {
    expect(RESIDENTIAL_TOWER_DEFAULTS).toMatchObject({ storeys: 30, range: [20, 60], height: 2.8, bay: [9, 9], facade: 'punched', mechanicalEvery: 25, damperAbove: 150 })
    expect([plan.w, plan.d]).toEqual(layout.plate)
    expect(plan.floors).toHaveLength(20)
    expect(plan.floors.every((f: { ceiling: number }) => f.ceiling === layout.pitch)).toBe(true)
    expect(layout.facade).toBe('punched')
    expect(plan.config.tower).toMatchObject({ storeys: 20, pitch: layout.pitch, facade: 'punched' })
    expect(plan.missing).toEqual([])
  })

  it('a typical storey has six apartments (three on each long side) with living, bedroom, kitchen, hall and bathroom, and a laundry and a storage room at the ends', () => {
    const rooms = plan.rooms.filter((r: { floor: number }) => r.floor === 7)
    const homes = new Set(rooms.filter((r: { id: string }) => r.id.startsWith('apt_')).map((r: { id: string }) => r.id.split('_').slice(0, 4).join('_')))
    expect(homes.size).toBe(6)
    expect(rooms.some((r: { label: string }) => r.label === 'laundry_room') && rooms.some((r: { label: string }) => r.label === 'storage_room')).toBe(true)
    for (const home of homes) {
      for (const part of ['living', 'bedroom', 'kitchen', 'hall', 'bath']) expect(rooms.some((r: { id: string }) => r.id === `${home}_${part}`), `${home} ${part}`).toBe(true)
    }
    expect(rooms.filter((r: { type: string }) => r.type === 'bedroom')).toHaveLength(6)
    expect(plan.windows.filter((w: { floor: number }) => w.floor === 7).length).toBeGreaterThan(14)
    expect(rooms.filter((r: { type: string }) => r.type === 'elevator')).toHaveLength(layout.core!.elevators)
  })

  it('the ground floor has the entrance lobby with a 3 m door, the concierge and the bicycle room; the stairs link every storey', () => {
    const door = plan.doors.find((d: { b: string }) => d.b === 'outside')
    expect(door).toMatchObject({ a: 'lobby_0_entrance', side: 'front', width: 3, exterior: true })
    expect(plan.rooms.filter((r: { floor: number }) => r.floor === 0).map((r: { label: string }) => r.label)).toEqual(expect.arrayContaining(['concierge', 'lobby_entrance', 'bike_room']))
    for (let f = 0; f < 20; f++) expect(plan.rooms.find((r: { floor: number; type: string }) => r.floor === f && r.type === 'stairs').link).toEqual(f < 19 ? [f, f + 1] : [f - 1, f])
    expect(plan.rooms.filter((r: { floor: number; label: string }) => r.floor === 19 && r.label === 'plant_room')).toHaveLength(4)
  })

  it('one can walk from the street to every home: the doors, the open pairs and the stairs', () => {
    const edges = new Map<string, Set<string>>()
    const link = (a: string, b: string) => { (edges.get(a) ?? edges.set(a, new Set()).get(a)!).add(b); (edges.get(b) ?? edges.set(b, new Set()).get(b)!).add(a) }
    for (const d of plan.doors) link(d.a, d.b)
    for (const [a, b] of plan.openPairs ?? []) link(a, b)
    for (const r of plan.rooms) if (r.type === 'stairs' && r.link) for (const other of plan.rooms) if (other.type === 'stairs' && other.floor === r.link[1]) link(r.id, other.id)
    const seen = new Set<string>(['outside'])
    const queue = ['outside']
    while (queue.length) for (const n of edges.get(queue.shift()!) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n) }
    expect(plan.rooms.filter((r: { id: string; type: string }) => !seen.has(r.id) && r.type !== 'elevator').map((r: { id: string }) => r.id)).toEqual([])
  })

  it('the apartments on the back of the building have a balcony off the living room, where the air conditioner hangs its condenser', () => {
    const rooms = plan.rooms.filter((r: { floor: number }) => r.floor === 7)
    expect(rooms.filter((r: { type: string }) => r.type === 'balcony')).toHaveLength(3)
    expect(plan.doors.filter((d: { b: string; floor: number }) => d.floor === 7 && d.b.endsWith('_balcony'))).toHaveLength(3)
    expect(plan.items.some((i: { type: string }) => i.type === 'ac_condenser')).toBe(true)
  })

  it('the homes are furnished', () => {
    const items = plan.items.filter((i: { floor: number }) => i.floor === 7)
    for (const category of ['sofa', 'bed', 'toilet']) expect(items.some((i: { category: string }) => i.category === category), category).toBe(true)
  })

  it('every number is an option: a game builds its own tower from other numbers', () => {
    const custom = residentialTowerTemplate({ ...RESIDENTIAL_TOWER_DEFAULTS, storeys: 24, range: [22, 40], height: 3, bay: [10, 10] }, { apartment: 12 })
    expect(custom.floorsFn!({})).toHaveLength(24)
    expect(custom.floorsFn!({ floors: 99 })).toHaveLength(40)
    const w = custom.defaultsFn!({}).w
    expect(w).toBeGreaterThan(plan.w)
    expect(buildResidentialTower({ storeys: 20 }).parts.some((p) => p.id === 'infill_5_n_0_sill')).toBe(true)
    expect(buildResidentialTower({ storeys: 20 }).parts.some((p) => p.id.startsWith('glass_5_') && p.tags?.includes('curtain_wall'))).toBe(false)
  })

  it('has the names in both languages with the same keys', () => {
    for (const locale of [en, ptBR]) {
      expect(locale.templates.residential_tower).toBeTruthy()
      expect(locale.zones.zt).toBeTruthy()
      for (const key of ['concierge', 'bike_room', 'lobby_entrance', 'laundry_room', 'storage_room']) expect((locale.labels as Record<string, string>)[key]).toBeTruthy()
    }
    const pt = engine.generate('residential_tower', { seed: 4, floors: 20, locale: 'pt-BR' }) as any
    expect(pt.name).toBe('Torre residencial')
    expect(pt.floors[1].name).toBe('Andar tipo')
    expect(pt.rooms.find((r: { id: string }) => r.id === 'concierge_0').name).toBe('Portaria')
  })
})
