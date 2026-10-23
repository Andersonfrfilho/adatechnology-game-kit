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
  it('registers the ten templates under their English ids', () => {
    expect(residentialTemplateIds.slice().sort()).toEqual(
      ['apartment_basic', 'apartment_modern', 'budget_semi_detached', 'budget_slab_house', 'high_end_contemporary', 'mansion', 'mid_modern_single_storey', 'mid_modern_townhouse', 'single_storey_a', 'townhouse'].sort(),
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
  })

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
