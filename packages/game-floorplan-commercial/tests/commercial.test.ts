import { beforeAll, describe, expect, it } from 'vitest'
import { engine } from '@adatechnology/game-floorplan'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { register, commercialTemplateIds } from '../src'
import en from '../src/locales/en.json'
import ptBR from '../src/locales/pt-BR.json'

/** Buildings on the street line with a steel door and a cargo gate; the public, industrial and rural ones have their own shells. */
const SHOP_TEMPLATE_IDS = ['market', 'pharmacy', 'supermarket', 'drugstore', 'gun_shop']

beforeAll(() => {
  registerResidential(engine, { region: 'br' })
  register(engine, { region: 'br' })
})

describe('commercial pack', () => {
  it('registers market and pharmacy (the shop library is shared) and the interior buildings', () => {
    expect(commercialTemplateIds.slice(0, 2)).toEqual(['market', 'pharmacy'])
    expect(commercialTemplateIds.length).toBe(new Set(commercialTemplateIds).size)
    const ids = engine.listTemplates().map((t) => t.id)
    for (const id of commercialTemplateIds) expect(ids).toContain(id)
  })

  it('declares the commercial use (the interior buildings declare their own, see interiors.test.ts)', () => {
    for (const id of SHOP_TEMPLATE_IDS) expect(engine.listTemplates().find((t) => t.id === id)!.use).toBe('commercial')
  })

  it('pt-BR reproduces the old Portuguese names', () => {
    const m = engine.generate('market', { seed: 1, locale: 'pt-BR' })
    expect(m.name).toBe('Mercadinho')
    expect(m.rooms.map((c: any) => c.name)).toEqual(['Caixas', 'Loja', 'Estoque', 'Banheiro', 'Escritório'])
  })

  it('en and pt-BR have the same top-level namespaces', () => {
    expect(Object.keys(ptBR).sort()).toEqual(Object.keys(en).sort())
  })

  it('has a steel front door, a cargo gate and no garden (the shops on the street line)', () => {
    for (const id of SHOP_TEMPLATE_IDS) {
      const r = engine.generate(id, { seed: 2 })
      expect(r.lot.zones.some((z: any) => z.type === 'garden')).toBe(false)
      expect(r.lot.gates.some((g: any) => g.type === 'cargo')).toBe(true)
      expect(r.doors.some((p: any) => p.model === 'steel' && p.exterior)).toBe(true)
      expect(engine.validate(r)).toEqual([])
      expect(r.missing).toEqual([])
    }
  })
})

describe('urban zoning (region br, commercial)', () => {
  it('registers the commercial and industrial zones', () => {
    const zc = engine.getZone('zc')!
    expect(zc.allowedUses).toContain('commercial')
    expect(zc.maxFloors).toBeGreaterThanOrEqual(12)
    expect(engine.getZone('zi')).toBeTruthy()
    for (const z of ['zc', 'zi']) {
      expect((en as any).zones[z], z).toBeTruthy()
      expect((ptBR as any).zones[z], z).toBeTruthy()
    }
  })

  it('every template generates a valid plan inside at least one zone', () => {
    for (const id of commercialTemplateIds) {
      const ok = engine.listZones().filter((zone) => {
        const r = engine.generate(id, { seed: 5, zone: zone.id })
        return r.zoning.violations.length === 0 && engine.validate(r).length === 0
      })
      expect(ok.length, `${id} fits no zone`).toBeGreaterThan(0)
    }
    // the office tower has 40 storeys by default: a few seconds a zone
  }, 180000)

  it('a shop in a houses-only zone is caught', () => {
    const r = engine.generate('market', { seed: 1 })
    expect(engine.checkLot('zr1', r.lot, r).map((v) => v.rule)).toContain('use')
    expect(engine.checkLot('zc', r.lot, r).map((v) => v.rule)).not.toContain('use')
    expect(engine.validate(engine.generate('market', { seed: 1, zone: 'zr1' })).some((e: string) => e.includes('zr1'))).toBe(true)
  })

  it('pushes the front setback to the zone minimum', () => {
    const r = engine.generate('pharmacy', { seed: 3, zone: 'zr3_zm' })
    expect(r.zoning.violations.filter((v: any) => v.rule.startsWith('setback'))).toEqual([])
  })
})
