import { describe, expect, it } from 'vitest'
import { generate, validateSpec } from '@adatechnology/game-vegetation'
import { byTag, description, getSpecies, listIds, loadLocale, name, pickForContext, regions, species, toSpec } from '../src'

const REQUIRED = [
  'mango_tree', 'yellow_ipe', 'pink_ipe', 'jabuticaba_tree', 'flamboyant', 'guava_tree', 'avocado_tree', 'lemon_tree', 'pitanga_bush_tree', 'sidewalk_ficus', 'oak_like',
  'weeping_willow', 'araucaria', 'pine', 'eucalyptus', 'dead_tree', 'coconut_palm', 'royal_palm', 'fan_palm', 'areca_palm', 'banana_plant', 'banana_with_bunch',
  'boxwood_hedge', 'ixora_hedge', 'hibiscus_shrub', 'bougainvillea', 'azalea', 'croton', 'lady_palm', 'generic_round_shrub', 'overgrown_bush', 'rose_bush_red', 'rose_bush_pink',
  'rose_bush_white', 'sunflower', 'daisy', 'tulip', 'lily', 'marigold', 'periwinkle_pink', 'periwinkle_white', 'hydrangea', 'bird_of_paradise', 'wild_flowers', 'mandacaru',
  'saguaro', 'xique_xique', 'prickly_pear', 'crown_cactus', 'barrel_cactus', 'small_cactus', 'snake_plant', 'agave', 'aloe_vera', 'echeveria', 'lawn_tuft', 'wild_grass_tall',
  'weeds', 'papyrus', 'fern', 'boston_fern', 'bougainvillea_vine', 'ivy', 'passion_fruit_vine', 'potted_fern', 'potted_snake_plant', 'potted_areca', 'potted_cactus',
  'potted_rose', 'potted_succulents',
]

function budget(archetype: string, id = ''): number {
  if (id === 'papyrus') return 2000
  if (['shrub'].includes(archetype)) return 2500
  if (['flower_plant', 'fern', 'rosette'].includes(archetype)) return 1600
  if (['vine', 'potted'].includes(archetype)) return 2500
  if (archetype === 'grass_tuft') return 300
  if (archetype.endsWith('cactus')) return 2500
  return 6000
}

describe('pack contents', () => {
  it('contains every required species with unique snake_case ids', () => {
    const ids = listIds()
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of REQUIRED) expect(ids, id).toContain(id)
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9_]*$/)
      expect(id).not.toMatch(/-br$|_br$/)
    }
    expect(species.length).toBeGreaterThanOrEqual(70)
  })
  it('has well formed entries', () => {
    for (const s of species) {
      expect(s.tags.length, s.id).toBeGreaterThan(0)
      expect(s.climate.length, s.id).toBeGreaterThan(0)
      expect(['s', 'm', 'l']).toContain(s.size)
      expect(typeof s.solid).toBe('boolean')
    }
  })
  it('finds species by id and tag', () => {
    expect(getSpecies('mandacaru')!.archetype).toBe('columnar_cactus')
    expect(getSpecies('nope')).toBeUndefined()
    expect(byTag('cactus').map((s) => s.id)).toEqual(expect.arrayContaining(['mandacaru', 'saguaro', 'prickly_pear']))
    expect(byTag('hedge').length).toBeGreaterThanOrEqual(3)
    expect(byTag('fruit').length).toBeGreaterThan(5)
  })
  it('solid matches the presence of a collider', () => {
    for (const s of species) {
      const m = generate(toSpec(s), { seed: 1, lod: 2 })
      expect(m.collider !== null, s.id).toBe(s.solid)
    }
  })
})

describe('every species generates', () => {
  it.each(listIds())('%s validates and builds within budget', (id) => {
    const s = getSpecies(id)!
    const spec = toSpec(s)
    expect(validateSpec(spec), id).toEqual([])
    const l0 = generate(spec, { seed: 11, lod: 0, species: id })
    const l1 = generate(spec, { seed: 11, lod: 1 })
    const l2 = generate(spec, { seed: 11, lod: 2 })
    expect(l0.species).toBe(id)
    expect(l0.triangleCount).toBeLessThanOrEqual(budget(s.archetype, id))
    expect(l1.triangleCount).toBeLessThan(l0.triangleCount)
    expect(l2.triangleCount).toBeLessThan(l1.triangleCount)
    for (const part of Object.values(l0.parts)) {
      expect(Number.isFinite(part.positions[0])).toBe(true)
      expect(part.positions.every((v: number) => Number.isFinite(v))).toBe(true)
    }
    for (const condition of ['dry', 'dead', 'overgrown'] as const) expect(generate(spec, { seed: 2, condition }).triangleCount).toBeGreaterThan(0)
  })
})

describe('locales', () => {
  it('have a name and description for every id in pt-BR and en, and nothing extra', () => {
    const ids = listIds().sort()
    for (const loc of ['pt-BR', 'en'] as const) {
      const table = loadLocale(loc)
      expect(Object.keys(table).sort()).toEqual(ids)
      for (const id of ids) {
        expect(table[id].name.length, `${loc}/${id}`).toBeGreaterThan(1)
        expect(table[id].description.length, `${loc}/${id}`).toBeGreaterThan(5)
      }
    }
  })
  it('reads names and falls back to en', () => {
    expect(name('mango_tree', 'pt-BR')).toBe('Mangueira')
    expect(name('mango_tree', 'en')).toBe('Mango tree')
    expect(name('mango_tree', 'xx')).toBe('Mango tree')
    expect(name('unknown_id')).toBe('unknown_id')
    expect(name('snake_plant', 'pt-BR')).toBe('Espada-de-são-jorge')
    expect(description('mandacaru', 'pt-BR')).toContain('Cacto')
  })
})

describe('regions', () => {
  const contexts = ['front_yard', 'backyard', 'sidewalk_tree', 'square', 'vacant_lot', 'indoor', 'semiarid']
  it.each(['br', 'default'] as const)('%s only references known species and covers every context', (key) => {
    const region = regions[key]
    for (const c of contexts) {
      expect(region.contexts[c], `${key}/${c}`).toBeDefined()
      expect(region.contexts[c].length).toBeGreaterThan(2)
      for (const it of region.contexts[c]) {
        expect(getSpecies(it.species), `${key}/${c}/${it.species}`).toBeDefined()
        expect(it.weight).toBeGreaterThan(0)
      }
    }
  })
  it('the Brazilian region favours local species and the generic one is temperate', () => {
    expect(regions.br.contexts.semiarid.map((x) => x.species)).toContain('mandacaru')
    expect(regions.br.contexts.sidewalk_tree.map((x) => x.species)).toContain('yellow_ipe')
    expect(regions.default.contexts.sidewalk_tree.map((x) => x.species)).toContain('oak_like')
    expect(regions.default.contexts.semiarid.map((x) => x.species)).not.toContain('mandacaru')
  })
  it('pickForContext is deterministic and weighted', () => {
    expect(pickForContext(regions.br, 'front_yard', 42)).toBe(pickForContext(regions.br, 'front_yard', 42))
    const counts: Record<string, number> = {}
    for (let i = 0; i < 4000; i++) {
      const id = pickForContext(regions.br, 'sidewalk_tree', 'seed-' + i)
      counts[id] = (counts[id] ?? 0) + 1
    }
    expect(counts.sidewalk_ficus).toBeGreaterThan(counts.oak_like * 3)
    expect(Object.keys(counts).length).toBeGreaterThan(5)
    let n = 0
    const fn = (): number => (n = (n + 0.37) % 1)
    expect(typeof pickForContext(regions.br, 'backyard', fn)).toBe('string')
    expect(() => pickForContext(regions.br, 'moon', 1)).toThrow()
  })
})

describe('toSpec', () => {
  it('turns hex strings into integers', () => {
    const spec = toSpec('mango_tree') as unknown as { leafColor: number[]; fruit: { colors: number[] } }
    expect(spec.leafColor.every((c) => Number.isInteger(c))).toBe(true)
    expect(spec.fruit.colors[0]).toBe(0xe8a02a)
    expect(() => toSpec('nope')).toThrow()
  })
})
