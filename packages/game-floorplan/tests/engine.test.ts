import { describe, expect, it } from 'vitest'
import { runResultExtensions } from '../src/extensions'
import { engine, checkLot, createRng, defineZone, getZone, hashString, listStates, listZones, translate } from '../src'

describe('seeded rng', () => {
  it('is deterministic per seed and key, and different across keys', () => {
    const a = createRng(7, 'x')
    const b = createRng(7, 'x')
    const c = createRng(7, 'y')
    const seqA = [a(), a(), a()]
    expect(seqA).toEqual([b(), b(), b()])
    expect(seqA).not.toEqual([c(), c(), c()])
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
  it('hashString is stable', () => {
    expect(hashString('a|b')).toBe(hashString('a|b'))
    expect(hashString('a')).not.toBe(hashString('b'))
  })
})

describe('locale', () => {
  it('translates with interpolation and falls back to en, then to the key', () => {
    expect(translate('reasons', 'no_window', 'en')).toBeTruthy()
    expect(translate('reasons', 'no_window', 'pt-BR')).not.toBe(translate('reasons', 'no_window', 'en'))
    expect(translate('reasons', 'no_window', 'xx-YY')).toBe(translate('reasons', 'no_window', 'en'))
    expect(translate('reasons', 'unknown_key_here', 'en')).toBe('unknown_key_here')
  })
  it('lists the built-in locales', () => {
    expect(engine.listLocales()).toEqual(expect.arrayContaining(['en', 'pt-BR']))
  })
})

describe('state plugins', () => {
  it('the engine itself only knows the normal state', () => {
    expect(listStates()).toEqual(['normal'])
  })
  it('registers a custom state plugin', () => {
    engine.registerState('test_state', { apply: () => [] })
    expect(listStates()).toContain('test_state')
  })
})

describe('zoning (engine layer)', () => {
  const zone = defineZone({
    id: 'unit_test_zone',
    allowedUses: ['residential_single'],
    maxFloors: 2,
    maxHeight: 9,
    setbacks: { front: 5, side: 1.5, back: 3 },
    maxCoverage: 0.5,
    maxFar: 1,
    minLot: 200,
    minFrontage: 10,
    permeableMin: 0,
  })
  const plan = (over: Record<string, unknown> = {}, lotOver: Record<string, unknown> = {}) => ({
    use: 'residential_single',
    w: 8,
    d: 10,
    floors: [{ index: 0, y0: 0, ceiling: 2.8 }],
    rooms: [{ floor: 0, parts: [[0, 0, 8, 10]] }],
    partyWalls: [],
    ...over,
    lot: { rect: [-3, -6, 11, 14], setback: 6, backyard: 4, sideYard: { left: 3, right: 3 }, zones: [], ...lotOver },
  })

  it('defines, gets and lists zones', () => {
    expect(getZone('unit_test_zone')).toBe(zone)
    expect(listZones().map((z) => z.id)).toContain('unit_test_zone')
  })

  it('accepts a compliant plan', () => {
    const p = plan()
    expect(checkLot('unit_test_zone', p.lot, p)).toEqual([])
  })

  it('reports each violated rule with actual and limit', () => {
    const p = plan({ use: 'commercial', floors: [0, 1, 2].map((i) => ({ index: i, y0: i * 3.2, ceiling: 3.2 })) }, { setback: 2, backyard: 1, sideYard: { left: 0.5, right: 3 }, rect: [0, 0, 8, 12] })
    const rules = checkLot('unit_test_zone', p.lot, p).map((v) => v.rule)
    expect(rules).toEqual(expect.arrayContaining(['use', 'floors', 'height', 'setback_front', 'setback_side', 'setback_back', 'min_lot', 'min_frontage']))
  })

  it('party walls are exempt from the side setback', () => {
    const p = plan({ partyWalls: ['left'] }, { sideYard: { left: 0, right: 3 } })
    expect(checkLot('unit_test_zone', p.lot, p).map((v) => v.rule)).not.toContain('setback_side')
  })

  it('rejects an unknown zone id', () => {
    const p = plan()
    expect(() => checkLot('nope', p.lot, p)).toThrow()
  })
})

describe('result extensions and finds', () => {
  it('runs an extension after the ones it names, with its own seeded stream', () => {
    const order: string[] = []
    engine.registerResultExtension('zz_second', ({ rng }) => (order.push('second'), rng()), { after: ['zz_first'], seedKey: 'team_flow' })
    engine.registerResultExtension('zz_first', () => (order.push('first'), 1))
    const result: Record<string, unknown> = {}
    runResultExtensions({} as never, result, 3, {})
    expect(order).toEqual(['first', 'second'])
    expect(result.zz_first).toBe(1)
    expect(result.zz_second).toBe(engine.createRng(3, 'team_flow')())
  })

  it('asks the registered provider what a container holds', () => {
    expect(engine.findsFor({ place: 'house', container: 'fridge', state: 'normal', rng: engine.createRng(1, 'x') })).toEqual([])
    engine.registerFindsProvider({ findsFor: ({ container }) => (container === 'fridge' ? [{ itemId: 'milk', count: 2 }] : null) })
    expect(engine.findsFor({ place: 'house', container: 'fridge', state: 'normal', rng: engine.createRng(1, 'x') })).toEqual([{ itemId: 'milk', count: 2 }])
    // null passes to the next provider or to the default of the pack; an empty array is an answer
    expect(engine.findsAnswer({ place: 'house', container: 'sofa', state: 'normal', rng: engine.createRng(1, 'x') })).toBeNull()
    engine.registerFindsProvider({ findsFor: () => [] })
    expect(engine.findsAnswer({ place: 'house', container: 'sofa', state: 'normal', rng: engine.createRng(1, 'x') })).toEqual([])
  })
})

describe('registries packs read back', () => {
  it('exposes the palette recipes so a pack can build on one', () => {
    const recipe = { facadeColors: [['x', 0, 0, 0.5]] as [string, number, number, number][], early: () => ({}) as never, late: () => ({}) }
    engine.registerPaletteStyle('zz_recipe', recipe)
    expect(engine.paletteStyles.zz_recipe).toBe(recipe)
  })
})

describe('furniture and window rules', () => {
  const window = { y0: 1.0 }
  it('a wall cabinet blocks a window unless it was dropped', () => {
    const cabinet = { window: true, h: 0.95, overhead: true }
    expect(engine.blocksWindow(cabinet, window)).toBe(true)
    expect(engine.blocksWindow(cabinet, window, true)).toBe(false)
  })
  it('a shower enclosure blocks by its glass height, not by its tray', () => {
    expect(engine.blocksWindow({ window: true, h: 0.1, windowHeight: 1.95 }, window)).toBe(true)
    expect(engine.blocksWindow({ window: true, h: 0.1 }, window)).toBe(false)
  })
  it('the player radius is an option that reaches the plan', () => {
    expect(engine.constants.PLAYER_RADIUS).toBe(0.24)
  })
})

describe('viewer layers', () => {
  it('keeps the layers packs register, replacing by id', () => {
    const draw = () => undefined
    engine.registerViewerLayer({ id: 'zz_structure', label: 'Structure', draw })
    engine.registerViewerLayer({ id: 'zz_structure', label: 'Structure 2', draw, defaultOn: true })
    const layers = engine.viewerLayers.filter((layer) => layer.id === 'zz_structure')
    expect(layers).toHaveLength(1)
    expect(layers[0]?.label).toBe('Structure 2')
  })
})
