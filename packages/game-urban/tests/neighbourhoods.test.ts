import { describe, expect, it } from 'vitest'

import { createUrban, DEFAULT_PATTERNS, SAMPLE_CELLS } from '../src'

describe('neighbourhood patterns', () => {
  const kit = createUrban()

  it('ships the ten patterns of the Galeria, each with a composer, a pole that exists and texts in both locales', () => {
    expect(kit.neighbourhoods.ids()).toEqual(['downtown', 'suburb', 'working_class', 'historic_street', 'industrial_port', 'railway_village', 'mountain_resort', 'stilt_village', 'military', 'rural'])
    for (const pattern of DEFAULT_PATTERNS) {
      expect(() => kit.neighbourhoods.get(pattern.id)).not.toThrow()
      if (pattern.pole) expect(kit.poles.ids()).toContain(pattern.pole)
      expect(pattern.text['pt-BR'].title.length).toBeGreaterThan(0)
      expect(pattern.text.en.caption.length).toBeGreaterThan(0)
      expect(SAMPLE_CELLS[pattern.id]).toBeDefined()
    }
  })

  it('the numbers of the table: street widths, pole kinds, spacing and the share of lamps on', () => {
    const table = Object.fromEntries(DEFAULT_PATTERNS.map((p) => [p.id, [p.streetWidth, p.pole, p.spacing, p.lit]]))
    expect(table.downtown).toEqual([14, 'led_double', 25, 1])
    expect(table.suburb).toEqual([7, 'concrete_arm', 35, 0.75])
    expect(table.historic_street).toEqual([5, 'cast_iron', 20, 0.8])
    expect(table.industrial_port).toEqual([40, 'flood_tower', 60, 1])
    expect(table.working_class?.[3]).toBe(0.5)
  })

  it('the same seed composes the same street and another seed another', () => {
    const scene = (seed: number) => {
      const b = kit.builder({ seed })
      kit.neighbourhoods.get('suburb').compose(b, { x: 0, z: 0 })
      return b.scene()
    }
    expect(scene(7)).toEqual(scene(7))
    expect(scene(7).parts).not.toEqual(scene(8).parts)
  })

  it('a street that has to be lit lights every pole without drawing from the random', () => {
    const a = kit.builder({ seed: 7 })
    const plan = kit.neighbourhoods.get('downtown').compose(a, { x: 0, z: 0 })
    expect(plan.poles.every((pole) => pole.on)).toBe(true)
    expect(plan.poles.map((pole) => pole.pole)).toEqual(['led_double', 'led_double', 'led_double'])
  })

  it('a pattern patched to have no lamps lit burns every one out', () => {
    const dark = createUrban({ patch: { neighbourhoods: { suburb: { lit: 0 } } } })
    const plan = dark.neighbourhoods.get('suburb').compose(dark.builder(), { x: 0, z: 0 })
    expect(plan.poles.length).toBeGreaterThan(0)
    expect(plan.poles.some((pole) => pole.on)).toBe(false)
  })

  it('the vehicle provider is asked where the pattern parks a car; without one nothing is drawn', () => {
    const asked: unknown[] = []
    const plan = kit.neighbourhoods.get('downtown').compose(kit.builder(), { x: 10, z: 20 }, { providers: { vehicle: (request) => asked.push(request) } })
    expect(asked).toEqual([{ x: 2, z: 17, ry: 1.57, color: 0x6b6450 }])
    expect(plan.vehicles).toEqual(asked)
  })

  it('a house provider replaces the silhouettes and sees every house the pattern places', () => {
    const seen: string[] = []
    const b = kit.builder()
    const plan = kit.neighbourhoods.get('railway_village').compose(b, { x: 0, z: 0 }, { providers: { house: (typology) => void seen.push(typology) } })
    expect(seen).toHaveLength(12)
    expect(new Set(seen)).toEqual(new Set(['company_house']))
    expect(plan.houses).toHaveLength(12)
    expect(b.parts.some((part) => part.shape === 'prism')).toBe(false)
  })

  it('a plant provider replaces the pines and the trees', () => {
    const seen: string[] = []
    const b = kit.builder()
    kit.neighbourhoods.get('mountain_resort').compose(b, { x: 0, z: 0 }, { providers: { plant: (request) => void seen.push(request.kind) } })
    expect(seen).toHaveLength(10)
    expect(b.parts.some((part) => part.shape === 'cone' && part.radius > 1)).toBe(false)
  })

  it('draws the title and caption of the locale', () => {
    const en = kit.builder()
    kit.neighbourhoods.get('military').compose(en, { x: 0, z: 0 }, { locale: 'en' })
    const label = en.parts.find((part) => part.shape === 'label')
    expect(label && 'lines' in label ? label.lines[0] : '').toBe('MILITARY')
    const pt = kit.builder()
    kit.neighbourhoods.get('military').compose(pt, { x: 0, z: 0 })
    const ptLabel = pt.parts.find((part) => part.shape === 'label')
    expect(ptLabel && 'lines' in ptLabel ? ptLabel.lines[0] : '').toBe('MILITAR')
  })

  it('a pack adds a pattern with its own composer, a patch changes a number, remove takes one out', () => {
    const custom = createUrban({
      packs: { neighbourhoods: [{ ...DEFAULT_PATTERNS[0]!, id: 'plaza', compose: 'plaza', params: { size: 4 } }] },
      composers: { plaza: ({ b, params, x0, z0 }) => b.plane(x0, 0.02, z0, (params as { size: number }).size, 4, 0x888888) },
      patch: { neighbourhoods: { suburb: { streetWidth: 9 } } },
      remove: { neighbourhoods: ['rural'] },
    })
    expect(custom.neighbourhoods.ids()).toEqual(['downtown', 'suburb', 'working_class', 'historic_street', 'industrial_port', 'railway_village', 'mountain_resort', 'stilt_village', 'military', 'plaza'])
    expect(custom.neighbourhoods.get('suburb').pattern.streetWidth).toBe(9)
    const b = custom.builder()
    custom.neighbourhoods.get('plaza').compose(b, { x: 0, z: 0 })
    expect(b.parts.filter((part) => part.shape === 'plane')).toHaveLength(1)
    expect(() => custom.neighbourhoods.get('rural')).toThrow(/Unknown neighbourhood/)
  })

  it('a pattern whose composer nobody registered says so', () => {
    const custom = createUrban({ packs: { neighbourhoods: [{ ...DEFAULT_PATTERNS[0]!, id: 'ghost', compose: 'ghost' }] } })
    expect(() => custom.neighbourhoods.get('ghost')).toThrow(/composer "ghost"/)
  })

  it('the sample sheet can be asked for some patterns only, in cells a game chooses', () => {
    const b = kit.builder()
    const sheet = kit.neighbourhoods.composeSampleSheet(b, { ids: ['rural'], cells: { rural: { x: 5, z: 6 } }, ground: false })
    expect(sheet.plans).toHaveLength(1)
    expect(sheet.plans[0]?.origin).toEqual({ x: 5, z: 6 })
    expect(sheet.markers[0]).toMatchObject({ x: 5, y: 7, z: 6, label: 'Rural' })
  })

  it('the military marker stands at the perimeter, 14 m before the cell', () => {
    const marker = kit.neighbourhoods.get('military').marker({ x: 160, z: 0 })
    expect(marker).toMatchObject({ x: 160, y: 12, z: -14, label: 'Militar' })
  })
})
