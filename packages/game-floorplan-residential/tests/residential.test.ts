import { beforeAll, describe, expect, it } from 'vitest'
import { engine } from '@adatechnology/game-floorplan'
import { register, residentialTemplateIds } from '../src'
import en from '../src/locales/en.json'
import ptBR from '../src/locales/pt-BR.json'

beforeAll(() => {
  register(engine, { region: 'br' })
})

const flatten = (o: any, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flatten(v, p + k + '.') : [p + k]))

describe('residential pack', () => {
  it('registers the eleven templates under their English ids', () => {
    expect(residentialTemplateIds.slice().sort()).toEqual(
      ['apartment_basic', 'apartment_modern', 'budget_semi_detached', 'budget_slab_house', 'high_end_contemporary', 'mansion', 'mid_modern_single_storey', 'mid_modern_townhouse', 'residential_tower', 'single_storey_a', 'townhouse'].sort(),
    )
    const ids = engine.listTemplates().map((t) => t.id)
    for (const id of residentialTemplateIds) expect(ids).toContain(id)
  })

  it('pt-BR has exactly the keys of en', () => {
    expect(flatten(ptBR).sort()).toEqual(flatten(en).sort())
  })

  it('pt-BR reproduces the old Portuguese names', () => {
    const r = engine.generate('townhouse', { seed: 3, locale: 'pt-BR' })
    expect(r.name).toBe('Sobrado (2 andares)')
    expect(r.rooms.map((c: any) => c.name)).toEqual(expect.arrayContaining(['Sala', 'Cozinha', 'Lavabo', 'Escada', 'Sacada', 'Banheiro']))
    expect(engine.generate('mansion', { seed: 1, locale: 'pt-BR' }).floors.map((f: any) => f.name)).toEqual(['Térreo', 'Andar superior', 'Cobertura'])
  })

  it('unknown regions are rejected', () => {
    expect(() => register(engine, { region: 'xx' as never })).toThrow()
  })

  it('every template is deterministic for a seed', () => {
    for (const id of residentialTemplateIds) {
      expect(JSON.stringify(engine.generate(id, { seed: 11 }))).toBe(JSON.stringify(engine.generate(id, { seed: 11 })))
    }
  })
})

describe('urban zoning (region br)', () => {
  const ZONE_IDS = ['zr1', 'zr_ap', 'zr2', 'zr3_zm']

  it('registers the Brazilian residential zones', () => {
    const ids = engine.listZones().map((z) => z.id)
    for (const z of ZONE_IDS) expect(ids).toContain(z)
    const zr1 = engine.getZone('zr1')!
    expect(zr1.maxFloors).toBe(2)
    expect(zr1.maxHeight).toBe(9)
    expect(zr1.allowedUses).toEqual(['residential_single'])
    const ap = engine.getZone('zr_ap')!
    expect(ap.maxFloors).toBe(3)
    expect(ap.maxHeight).toBe(12)
    expect(ap.setbacks.front).toBeGreaterThan(zr1.setbacks.front)
    expect(ap.minLot).toBeGreaterThan(zr1.minLot)
    expect(engine.getZone('zr2')!.allowedUses).toContain('residential_multi')
    expect(engine.getZone('zr2')!.maxFloors).toBe(4)
    expect(engine.getZone('zr3_zm')!.maxFloors).toBeGreaterThanOrEqual(8)
  })

  it('has a pt-BR and an en label for each zone', () => {
    for (const z of ZONE_IDS) {
      expect((en as any).zones[z], z).toBeTruthy()
      expect((ptBR as any).zones[z], z).toBeTruthy()
    }
  })

  it('every template generates a valid plan inside at least one zone', () => {
    for (const id of residentialTemplateIds) {
      const ok = engine.listZones().filter((zone) => {
        const r = engine.generate(id, { seed: 5, zone: zone.id })
        return r.zoning.violations.length === 0 && engine.validate(r).length === 0 && r.missing.length === 0
      })
      expect(ok.length, `${id} fits no zone`).toBeGreaterThan(0)
    }
    // the residential tower has 30 storeys by default: a few seconds a zone
  }, 180000)

  it('a plan that violates a zone is caught', () => {
    const apartment = engine.generate('apartment_modern', { seed: 1 })
    expect(engine.checkLot('zr1', apartment.lot, apartment).map((v) => v.rule)).toContain('use')
    expect(engine.checkLot('zr2', apartment.lot, apartment).map((v) => v.rule)).not.toContain('use')
    const mansion = engine.generate('mansion', { seed: 1 })
    expect(engine.checkLot('zr1', mansion.lot, mansion).map((v) => v.rule)).toContain('floors')
    expect(engine.checkLot('zr_ap', mansion.lot, mansion)).toEqual([])
  })

  it('validate() includes the zone violations', () => {
    const r = engine.generate('apartment_modern', { seed: 1, zone: 'zr1' })
    expect(r.zoning.violations.length).toBeGreaterThan(0)
    expect(engine.validate(r).some((e: string) => e.includes('zr1'))).toBe(true)
  })

  it('clamps floors to the zone and reports the adjustment', () => {
    const r = engine.generate('mansion', { seed: 1, zone: 'zr1' })
    expect(r.floors.length).toBe(2)
    expect(r.zoning.adjustments).toContainEqual({ field: 'floors', from: 3, to: 2, reason: 'max_floors' })
    expect(r.zoning.violations).toEqual([])
    const t = engine.generate('mid_modern_townhouse', { seed: 1, floors: 3, zone: 'zr1' })
    expect(t.floors.length).toBe(2)
  })

  it('keeps the floors when the zone allows them', () => {
    const r = engine.generate('mansion', { seed: 1, zone: 'zr_ap' })
    expect(r.floors.length).toBe(3)
    expect(r.zoning.adjustments).toEqual([])
  })

  it('raises setbacks to the zone minimums and reports them', () => {
    engine.defineZone({ id: 'wide_test', allowedUses: ['residential_single'], maxFloors: 2, maxHeight: 9, setbacks: { front: 9, side: 4, back: 6 }, maxCoverage: 0.5, maxFar: 1, minLot: 100, minFrontage: 5, permeableMin: 0.5 })
    const r = engine.generate('townhouse', { seed: 1, zone: 'wide_test' })
    const fields = r.zoning.adjustments.map((a: any) => a.field)
    expect(fields).toEqual(expect.arrayContaining(['frontSetback', 'marginLeft', 'marginRight']))
    expect(r.lot.setback).toBeGreaterThanOrEqual(9)
    expect(r.zoning.violations).toEqual([])
  })

  it('enforces the permeable area by turning paved yards into lawn', () => {
    const r = engine.generate('townhouse', { seed: 1, zone: 'wide_test' })
    expect(r.zoning.adjustments.some((a: any) => a.field.startsWith('ground:') && a.to === 'lawn' && a.reason === 'permeable_min')).toBe(true)
  })

  it('apartments clamp the storey they sit on', () => {
    const r = engine.generate('apartment_modern', { seed: 1, floor: 8, zone: 'zr2' })
    expect(r.zoning.adjustments).toContainEqual({ field: 'floor', from: 8, to: 4, reason: 'max_floors' })
  })

  it('output without a zone has no adjustments and a null-safe report', () => {
    const r = engine.generate('townhouse', { seed: 1 })
    expect(r.zoning?.adjustments ?? []).toEqual([])
  })
})

describe('budget slab house, 1 to 3 floors', () => {
  const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1)

  it('declares the floor range and keeps one floor when nothing is asked (the page plans)', () => {
    expect(engine.listTemplates().find((t) => t.id === 'budget_slab_house')?.floorRange).toEqual([1, 3])
    expect(engine.generate('budget_slab_house', { seed: 3 }).floors).toHaveLength(1)
    expect(engine.generate('budget_slab_house', { seed: 3 }).config.sideStair).toBeNull()
  })

  for (const floors of [2, 3]) {
    it(`${floors} floors: ground floor as before, then two bedrooms and a bathroom per upper floor, valid for ${SEEDS.length} seeds x 3 states`, () => {
      const problems: string[] = []
      for (const seed of SEEDS)
        for (const state of ['normal', 'fortified', 'abandoned']) {
          const plan = engine.generate('budget_slab_house', { seed, state, floors })
          const tag = `#${seed}/${state}`
          if (plan.floors.length !== floors) problems.push(`${tag}: ${plan.floors.length} floors`)
          for (const message of engine.validate(plan)) problems.push(`${tag}: ${message}`)
          for (let floor = 1; floor < floors; floor++) {
            const rooms = plan.rooms.filter((room: { floor: number }) => room.floor === floor)
            if (rooms.filter((room: { type: string }) => room.type === 'bedroom').length !== 2 || rooms.filter((room: { type: string }) => room.type === 'bathroom').length !== 1) problems.push(`${tag}: floor ${floor} is not 2 bedrooms + bathroom`)
            for (const room of rooms) if (!plan.items.some((item: { room: string }) => item.room === room.id)) problems.push(`${tag}: ${room.id} is empty`)
          }
        }
      expect(problems.slice(0, 5)).toEqual([])
    })
  }

  it('the upper floors repeat the ground footprint', () => {
    const plan = engine.generate('budget_slab_house', { seed: 5, floors: 3 })
    const hull = (floor: number) => {
      const rects = plan.rooms.filter((room: { floor: number }) => room.floor === floor).flatMap((room: { parts: number[][] }) => room.parts)
      return [Math.min(...rects.map((r: number[]) => r[0])), Math.min(...rects.map((r: number[]) => r[1])), Math.max(...rects.map((r: number[]) => r[2])), Math.max(...rects.map((r: number[]) => r[3]))]
    }
    expect(hull(1)).toEqual(hull(0))
    expect(hull(2)).toEqual(hull(0))
  })

  it('the stair goes straight up the side margin and every upper floor has the outside door where it arrives', () => {
    for (const floors of [2, 3]) {
      const plan = engine.generate('budget_slab_house', { seed: 9, floors })
      const stair = plan.config.sideStair
      expect(stair.side).toBe('left')
      expect(stair.flights).toBe(floors - 1)
      expect(stair.rect[0]).toBeGreaterThanOrEqual(-plan.lot.sideYard.left)
      expect(stair.rect[2]).toBeLessThanOrEqual(0)
      expect(stair.rect[3]).toBeLessThan(plan.d)
      stair.doors.forEach((id: string, index: number) => {
        const door = plan.doors.find((x: { id: string }) => x.id === id)
        expect(door).toMatchObject({ floor: index + 1, exterior: true, side: 'left' })
        expect(door.v).toBeCloseTo(stair.rect[1] + 3.9 * (index + 1), 5)
      })
    }
  })

  it('rebar starter bars come out of the top slab in about 60% of the houses (always on the one-floor house, as on the page)', () => {
    const rebar = (floors: number) => SEEDS.concat(SEEDS.map((s) => s + 100)).map((seed) => engine.generate('budget_slab_house', { seed, floors }).facade.slab.exposedRebar)
    expect(rebar(1).every(Boolean)).toBe(true)
    for (const floors of [2, 3]) {
      const share = rebar(floors).filter(Boolean).length / 120
      expect(share).toBeGreaterThan(0.45)
      expect(share).toBeLessThan(0.75)
    }
  })

  it('randomFloors draws 1 to 3 evenly from the seed, and the zone still clamps it', () => {
    const counts = [0, 0, 0, 0]
    for (let seed = 1; seed <= 300; seed++) counts[engine.generate('budget_slab_house', { seed, randomFloors: true }).floors.length]++
    for (const floors of [1, 2, 3]) expect(counts[floors]).toBeGreaterThan(60)
    expect(engine.generate('budget_slab_house', { seed: 1, floors: 3, zone: 'zr1' }).floors.length).toBe(2)
    expect(engine.generate('budget_slab_house', { seed: 2, randomFloors: true }).floors).toEqual(engine.generate('budget_slab_house', { seed: 2, randomFloors: true }).floors)
  })
})
