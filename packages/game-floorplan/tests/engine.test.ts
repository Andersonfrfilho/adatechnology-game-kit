import { describe, expect, it } from 'vitest'
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
