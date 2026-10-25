import { describe, expect, it } from 'vitest'

import { DEFAULT_CITY_PLANS, DEFAULT_DISTRICT_KINDS, DEFAULT_TOWER_PRESETS, createUrban } from '../src'
import type { CityPlanInput, DistrictKindDef } from '../src'

const kit = createUrban()
const cities = kit.cities

describe('city plans: kinds and templates', () => {
  it('ships 22 kinds and the 6 templates, each with texts in both locales', () => {
    expect(cities.kinds.list()).toHaveLength(22)
    expect(cities.plans.ids()).toEqual(['metropolis', 'regional_city', 'port_city', 'rail_town', 'country_town', 'mountain_village'])
    for (const k of DEFAULT_DISTRICT_KINDS) {
      expect(k.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(k.text['pt-BR'].name.length).toBeGreaterThan(0)
      expect(k.text.en.description.length).toBeGreaterThan(0)
    }
    expect(cities.kinds.has('downtown')).toBe(true)
    expect(cities.kinds.has('nope')).toBe(false)
    expect(() => cities.kinds.get('nope')).toThrow(/Unknown district kind/)
    expect(cities.kinds.get('downtown')).toMatchObject({ zone: 'zt', pattern: 'financial_district', floors: [20, 60], block: 90, color: '#3b4f7a' })
  })

  it('every template resolves: kinds exist, districts sit inside the map, zones and patterns are known', () => {
    for (const plan of DEFAULT_CITY_PLANS) {
      for (const locale of ['pt-BR', 'en'] as const) {
        const layout = cities.layout(plan.id, { locale })
        expect(layout.districts).toHaveLength(plan.districts.length)
        expect(layout.name.length).toBeGreaterThan(0)
        expect(layout.size).toEqual(plan.size)
        expect(layout.districtAt(0, 0) ?? layout.districtAt(plan.districts[0]!.rect[0], plan.districts[0]!.rect[1])).toBeDefined()
        for (const d of layout.districts) {
          expect(d.rect[2]).toBeGreaterThan(d.rect[0])
          expect(d.name.length).toBeGreaterThan(0)
          if (d.pattern && d.pattern !== 'financial_district') expect(kit.neighbourhoods.ids()).toContain(d.pattern)
        }
      }
    }
    expect(cities.layout('metropolis', { locale: 'en' }).name).toBe('Metropolis')
    expect(cities.layout('metropolis').name).toBe('Metrópole')
  })
})

describe('layout', () => {
  const metropolis = cities.layout('metropolis')

  it('districtAt: the last district that contains the point wins', () => {
    const inner = metropolis.districts[metropolis.districts.length - 1]!
    const cx = (inner.rect[0] + inner.rect[2]) / 2
    const cz = (inner.rect[1] + inner.rect[3]) / 2
    expect(metropolis.districtAt(cx, cz)?.id).toBe(inner.id)
    expect(metropolis.districtAt(2900, -1700)?.id).toBe('outskirts')
    expect(metropolis.districtAt(-2990, -2990)?.id).toBe('hills')
    expect(metropolis.districtAt(9000, 0)).toBeUndefined()
    const painted = cities.layout({
      id: 'x', scale: 'town', size: [100, 100], text: { 'pt-BR': { name: 'x', description: 'x' }, en: { name: 'x', description: 'x' } }, lines: [], landmarks: [],
      districts: [{ id: 'a', kind: 'rural', rect: [-50, -50, 50, 50] }, { id: 'b', kind: 'park', rect: [-10, -10, 10, 10] }, { id: 'c', kind: 'wild', rect: [0, 0, 5, 5] }],
    })
    expect(painted.districtAt(-20, -20)?.id).toBe('a')
    expect(painted.districtAt(-5, -5)?.id).toBe('b')
    expect(painted.districtAt(2, 2)?.id).toBe('c')
  })

  it('floors are clamped to [0, maxFloors]; 60 by default, the layout option and the kit option lower it', () => {
    const downtown = (l: ReturnType<typeof cities.layout>) => l.districts.find((d) => d.kind === 'downtown')!
    expect(downtown(metropolis).floors).toEqual([20, 60])
    expect(downtown(cities.layout('metropolis', { maxFloors: 40 })).floors).toEqual([20, 40])
    expect(downtown(cities.layout('metropolis', { maxFloors: 10 })).floors).toEqual([10, 10])
    expect(downtown(createUrban({ cities: { maxFloors: 30 } }).cities.layout('metropolis')).floors).toEqual([20, 30])
    const raised = createUrban({ cities: { maxFloors: 100 }, patch: { districtKinds: { downtown: { floors: [40, 90] } } } }).cities.layout('metropolis')
    expect(downtown(raised).floors).toEqual([40, 90])
    expect(downtown(createUrban({ patch: { districtKinds: { downtown: { floors: [40, 90] } } } }).cities.layout('metropolis')).floors).toEqual([40, 60])
  })

  it('a district overrides name, floors and uses of its kind', () => {
    const l = cities.layout({
      id: 'x', scale: 'town', size: [100, 100], text: { 'pt-BR': { name: 'x', description: 'x' }, en: { name: 'x', description: 'x' } }, lines: [], landmarks: [{ kind: 'church', at: [0, 0], name: { en: 'Church', 'pt-BR': 'Igreja' } }],
      districts: [{ id: 'a', kind: 'mixed', rect: [-50, -50, 50, 50], name: 'Old town', floors: [3, 90], uses: { commercial: 1 } }],
    }, { maxFloors: 20, locale: 'en' })
    expect(l.districts[0]).toMatchObject({ name: 'Old town', floors: [3, 20], uses: { commercial: 1 }, block: 60 })
    expect(l.landmarks[0]?.name).toBe('Church')
    expect(cities.layout('country_town', { locale: 'en' }).districts.find((d) => d.kind === 'mixed')?.name ?? 'Mixed use').toBeTruthy()
  })

  it('stats: areas add up to the painted map and an inner district takes its area from the one under it', () => {
    const stats = cities.stats(metropolis)
    expect(stats.reduce((s, k) => s + k.share, 0)).toBeCloseTo(1, 6)
    expect(stats.reduce((s, k) => s + k.area, 0)).toBeCloseTo(6000 * 6000, 0)
    expect(stats.reduce((s, k) => s + k.districts, 0)).toBe(metropolis.districts.length)
    const flat = cities.stats(cities.layout({
      id: 'x', scale: 'town', size: [100, 100], text: { 'pt-BR': { name: 'x', description: 'x' }, en: { name: 'x', description: 'x' } }, lines: [], landmarks: [],
      districts: [{ id: 'a', kind: 'rural', rect: [-50, -50, 50, 50] }, { id: 'b', kind: 'park', rect: [-25, -25, 25, 25] }],
    }))
    expect(flat).toEqual([{ kind: 'rural', area: 7500, share: 0.75, districts: 1 }, { kind: 'park', area: 2500, share: 0.25, districts: 1 }])
  })
})

describe('registries: patch, packs, remove, extends', () => {
  const text = { 'pt-BR': { name: 'Teste', description: 'd' }, en: { name: 'Test', description: 'd' } }

  it('patch changes a kind and a plan by id; a patch on a missing id is ignored', () => {
    const k = createUrban({ patch: { districtKinds: { downtown: { color: '#000000', uses: { commercial: 1 } }, nope: { color: '#fff' } }, cityPlans: { metropolis: { size: [1, 2] } } } })
    expect(k.cities.kinds.get('downtown').color).toBe('#000000')
    expect(k.cities.kinds.get('downtown').uses).toEqual({ commercial: 1, residential: 0.3 })
    expect(k.cities.kinds.has('nope')).toBe(false)
    expect(k.cities.layout('metropolis').size).toEqual([1, 2])
    expect(cities.layout('metropolis').size).toEqual([6000, 6000])
  })

  it('packs add or replace kinds and plans, remove takes them out', () => {
    const kind: DistrictKindDef = { id: 'spaceport', color: '#123456', zone: null, pattern: 'industrial_port', floors: [1, 3], uses: { industrial: 1 }, block: 100, text }
    const plan: CityPlanInput = { id: 'mine', scale: 'village', size: [500, 500], text, districts: [{ id: 'all', kind: 'spaceport', rect: [-250, -250, 250, 250] }], lines: [], landmarks: [] }
    const k = createUrban({ packs: { districtKinds: [kind], cityPlans: [plan] }, remove: { cityPlans: ['metropolis'], districtKinds: ['wild'] } })
    expect(k.cities.plans.ids()).toContain('mine')
    expect(k.cities.plans.has('metropolis')).toBe(false)
    expect(k.cities.kinds.has('wild')).toBe(false)
    expect(k.cities.layout('mine').districts[0]?.color).toBe('#123456')
    expect(() => k.cities.layout('mountain_village')).toThrow(/Unknown district kind "wild"/)
  })

  it('extends starts from the parent: same id replaces in place, new ones append, size and text come from the parent', () => {
    const child: CityPlanInput = {
      id: 'metropolis_plus',
      extends: 'metropolis',
      districts: [{ id: 'outskirts', kind: 'farmland', rect: [-3000, -3000, 3000, 3000] }, { id: 'extra', kind: 'park', rect: [0, 0, 100, 100] }],
      lines: [{ id: 'ring', kind: 'highway', width: 50, points: [[0, 0], [10, 10]] }],
      landmarks: [{ kind: 'stadium', at: [5, 5] }],
    }
    const k = createUrban({ packs: { cityPlans: [child] } })
    const base = k.cities.layout('metropolis')
    const l = k.cities.layout('metropolis_plus')
    expect(l.size).toEqual(base.size)
    expect(l.scale).toBe('metropolis')
    expect(l.districts).toHaveLength(base.districts.length + 1)
    expect(l.districts[0]).toMatchObject({ id: 'outskirts', kind: 'farmland' })
    expect(l.districts.at(-1)?.id).toBe('extra')
    expect(l.lines).toHaveLength(base.lines.length)
    expect(l.lines.find((x) => x.id === 'ring')).toMatchObject({ kind: 'highway', width: 50 })
    expect(l.landmarks).toHaveLength(base.landmarks.length + 1)
    expect(k.cities.plans.get('metropolis_plus').districts).toHaveLength(2)
    expect(k.cities.plans.resolve('metropolis_plus').districts).toHaveLength(l.districts.length)
  })

  it('extends a chain, and refuses a loop, a missing parent and a plan without a size', () => {
    const k = createUrban({ packs: { cityPlans: [{ id: 'a', extends: 'regional_city' }, { id: 'b', extends: 'a' }, { id: 'l1', extends: 'l2' }, { id: 'l2', extends: 'l1' }, { id: 'orphan', extends: 'ghost' }, { id: 'bare' }] } })
    expect(k.cities.layout('b').districts).toHaveLength(k.cities.layout('regional_city').districts.length)
    expect(() => k.cities.layout('l1')).toThrow(/extends itself/)
    expect(() => k.cities.layout('orphan')).toThrow(/Unknown city plan "ghost"/)
    expect(() => k.cities.layout('bare')).toThrow(/no scale/)
  })
})

describe('blocks', () => {
  const layout = cities.layout('regional_city')

  it('a grid of the district rect by the kind block size, less the street', () => {
    const d = layout.districts.find((x) => x.kind === 'commercial_center')!
    const blocks = layout.blocks(d.id)
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks[0]?.size).toEqual([60, 60])
    expect(layout.blocks(d.id, { street: 20 })[0]?.size).toEqual([50, 50])
    expect(blocks[0]?.building).toEqual({ floors: d.floors, uses: d.uses, zone: d.zone, pattern: d.pattern })
    for (const b of blocks) {
      expect(b.district).toBe(d.id)
      expect(b.x - 30).toBeGreaterThanOrEqual(d.rect[0] - 1e-6)
      expect(b.x + 30).toBeLessThanOrEqual(d.rect[2] + 1e-6)
    }
  })

  it('no block falls inside an inner district; every block centre resolves to its own district', () => {
    for (const plan of cities.plans.ids()) {
      const l = cities.layout(plan)
      for (const d of l.districts.filter((x) => x.block > 0)) {
        for (const b of l.blocks(d.id)) expect(l.districtAt(b.x, b.z)?.id).toBe(d.id)
      }
    }
    const l = cities.layout({
      id: 'x', scale: 'town', size: [400, 400], text: { 'pt-BR': { name: 'x', description: 'x' }, en: { name: 'x', description: 'x' } }, lines: [], landmarks: [],
      districts: [{ id: 'a', kind: 'residential_low', rect: [-200, -200, 200, 200] }, { id: 'b', kind: 'park', rect: [-100, -100, 100, 100] }],
    })
    const all = l.blocks('a')
    expect(all.length).toBeGreaterThan(0)
    expect(all.every((b) => Math.abs(b.x) > 100 || Math.abs(b.z) > 100)).toBe(true)
    expect(l.blocks('b')).toEqual([])
  })

  it('a kind with block 0 has no blocks and an unknown district throws', () => {
    expect(cities.layout('mountain_village').blocks('wild')).toEqual([])
    expect(() => layout.blocks('nope')).toThrow(/no district/)
  })
})

describe('fillBlock', () => {
  const storey = (id: string) => DEFAULT_TOWER_PRESETS.find((p) => p.id === id)!.storeyHeight
  const downtownLayout = cities.layout('metropolis')
  const downtown = downtownLayout.districts.find((d) => d.kind === 'downtown')!

  it('buildings are within floors x storey height, with the same seed the same city', () => {
    const block = downtownLayout.blocks(downtown.id)[0]!
    const h = (1 * storey('office') * 0.7 + storey('residential') * 0.3) // uses 0.7 / 0.3
    expect(cities.storeyHeight(downtown.uses, {})).toBeCloseTo(h, 9)
    const run = (seed: number) => {
      const b = kit.builder({ seed })
      return { placed: cities.fillBlock(b, block, { k: 3, gap: 1e-9 }), scene: b.scene() }
    }
    const { placed, scene } = run(7)
    expect(placed).toHaveLength(9)
    for (const p of placed) {
      expect(p.height).toBeGreaterThanOrEqual(20 * h - 1e-6)
      expect(p.height).toBeLessThanOrEqual(60 * h + 1e-6)
      expect(Math.abs(p.x - block.x)).toBeLessThan(block.size[0] / 2)
    }
    expect(scene.parts.length).toBeGreaterThan(0)
    expect(run(7).scene).toEqual(scene)
    expect(run(8).placed).not.toEqual(placed)
  })

  it('the shop share is the commercial share; storey heights follow the use and the kit presets', () => {
    expect(cities.storeyHeight({ residential: 1 }, {})).toBe(3.1)
    expect(cities.storeyHeight({ commercial: 1 }, {})).toBe(4)
    expect(cities.storeyHeight({ industrial: 1 }, {})).toBe(3.1)
    expect(cities.storeyHeight({ industrial: 1 }, { storeyHeight: 6 })).toBe(6)
    const k = createUrban({ towers: { presets: [{ id: 'office', weight: 1, storeyHeight: 5, mechanicalEvery: 20, glass: true }, { id: 'residential', weight: 1, storeyHeight: 2.5, mechanicalEvery: 25, glass: false }] } })
    expect(k.cities.storeyHeight({ commercial: 1 }, {})).toBe(5)
    const shops = (shop: number | undefined, kk = kit) => {
      const l = kk.cities.layout('mountain_village')
      const d = l.districts.find((x) => x.kind === 'historic')!
      const b = kk.builder({ seed: 3 })
      kk.cities.fillBlock(b, l.blocks(d.id)[0]!, { k: 3, gap: 1e-9, shop })
      return b.scene().parts.length
    }
    expect(shops(undefined)).toBeGreaterThan(shops(0))
  })

  it('draws nothing for kinds without storeys or without a pattern', () => {
    const l = cities.layout('mountain_village')
    const b = kit.builder({ seed: 1 })
    const fake = (floors: [number, number], pattern: string | null) => ({ x: 0, z: 0, size: [50, 50] as const, district: 'x', building: { floors, uses: { residential: 1 }, zone: null, pattern } })
    expect(cities.fillBlock(b, fake([0, 0], 'suburb'))).toEqual([])
    expect(cities.fillBlock(b, fake([1, 2], null))).toEqual([])
    expect(b.scene().parts).toHaveLength(0)
    expect(l.districts.length).toBeGreaterThan(0)
  })
})

describe('opt-in', () => {
  it('createUrban with cities draws nothing and does not change a scene', () => {
    const scene = (k: ReturnType<typeof createUrban>) => {
      const b = k.builder({ seed: 7 })
      k.neighbourhoods.get('suburb').compose(b, { x: 0, z: 0 })
      return b.scene()
    }
    expect(scene(createUrban({ cities: { maxFloors: 10 }, remove: { cityPlans: ['metropolis'] } }))).toEqual(scene(createUrban()))
  })
})
