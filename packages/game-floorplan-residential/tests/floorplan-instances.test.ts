import { createFloorplan, defaultFloorplan, engine } from '@adatechnology/game-floorplan'
import type { FloorplanEngine } from '@adatechnology/game-floorplan'
import { describe, expect, it } from 'vitest'

import { register } from '../src'

const TEMPLATE_ID = 'single_storey_a'
const withResidential = (target: FloorplanEngine): void => register(target, { region: 'br' })

describe('floorplan engines by instance', () => {
  register(engine, { region: 'br' })

  it('the global engine is the default engine, and an engine made with the same pack gives the same plan', () => {
    expect(defaultFloorplan()).toBe(engine)
    const made = createFloorplan({ packs: [withResidential] })
    const options = { seed: 11, locale: 'en' }
    expect(JSON.stringify(made.generate(TEMPLATE_ID, options))).toBe(JSON.stringify(engine.generate(TEMPLATE_ID, options)))
    expect(made.listTemplates().map((template) => template.id)).toEqual(engine.listTemplates().map((template) => template.id))
    expect(Object.keys(made.catalog)).toEqual(Object.keys(engine.catalog))
  })

  it('two engines on the same page with different packs do not leak into each other', () => {
    const full = createFloorplan({ packs: [withResidential] })
    const trimmed = createFloorplan({ packs: [withResidential], remove: { templates: [TEMPLATE_ID], items: ['sofa_l'] }, patch: { items: { coffee_table: { w: 9 } } } })
    const empty = createFloorplan()
    expect(full.templates[TEMPLATE_ID]).toBeDefined()
    expect(trimmed.templates[TEMPLATE_ID]).toBeUndefined()
    expect(empty.templates[TEMPLATE_ID]).toBeUndefined()
    expect(full.catalog.sofa_l).toBeDefined()
    expect(trimmed.catalog.sofa_l).toBeUndefined()
    expect(trimmed.catalog.coffee_table?.w).toBe(9)
    expect(full.catalog.coffee_table?.w).not.toBe(9)
    expect(engine.templates[TEMPLATE_ID]).toBeDefined()
    expect(() => trimmed.generate(TEMPLATE_ID, { seed: 1 })).toThrow('Unknown template')
    expect(() => full.generate(TEMPLATE_ID, { seed: 1 })).not.toThrow()
    full.registerLocale('en', { reasons: { only_in_full: 'full' } })
    full.defineZone({ id: 'only_in_full' } as never)
    expect(full.translate('reasons', 'only_in_full')).toBe('full')
    expect(trimmed.translate('reasons', 'only_in_full')).toBe('only_in_full')
    expect(engine.translate('reasons', 'only_in_full')).toBe('only_in_full')
    expect(full.getZone('only_in_full')).toBeDefined()
    expect(trimmed.getZone('only_in_full')).toBeUndefined()
    expect(engine.getZone('only_in_full')).toBeUndefined()
  })
})
