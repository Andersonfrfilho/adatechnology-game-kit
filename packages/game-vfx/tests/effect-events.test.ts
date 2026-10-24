import { describe, expect, it } from 'vitest'

import { createVfx, effectForEvent, EVENT_EFFECTS, GAME_EFFECTS, locales, WORKSHOP_EFFECTS } from '../src'

describe('event effects', () => {
  it('picks the effect of each Phase 2 event', () => {
    expect(effectForEvent({ kind: 'spall', material: 'concrete' })).toBe('impact_concrete')
    expect(effectForEvent({ kind: 'spall' })).toBeUndefined()
    expect(effectForEvent({ kind: 'stage', stage: 1 })).toBe('stage_crack')
    expect(effectForEvent({ kind: 'stage', stage: 2 })).toBe('breach_dust')
    expect(effectForEvent({ kind: 'stage', stage: 3 })).toBe('collapse_dust')
    expect(effectForEvent({ kind: 'expose' })).toBe('rebar_expose')
    expect(effectForEvent({ kind: 'collapse' })).toBe('collapse_dust')
    expect(effectForEvent({ kind: 'explode' })).toBe('explosion')
    expect(effectForEvent({ kind: 'fracture', material: 'glass' })).toBe('glass_burst')
    expect(effectForEvent({ kind: 'fracture', material: 'wood' })).toBeUndefined()
    expect(effectForEvent({ kind: 'nothing' })).toBeUndefined()
  })

  it('has a recipe, or an explosion of the catalogue, for every effect the map names', () => {
    const world = createVfx()
    const names = [...EVENT_EFFECTS.map((effect) => effect.id), 'explosion']
    for (const id of ['impact_concrete', 'impact_metal', 'impact_wood', 'impact_glass', 'impact_flesh', 'impact_water', 'stage_crack', 'breach_dust', 'collapse_dust', 'rebar_expose', 'glass_burst']) {
      expect(names).toContain(id)
      expect(world.effectIds()).toContain(id)
    }
  })

  it('plays each one without throwing and leaves something alive', () => {
    for (const effect of EVENT_EFFECTS) {
      const world = createVfx({ seed: 3 })
      expect(world.play(effect.id, [1, 0, 2], { direction: [0, 0, 1] })).not.toBeNull()
      for (let frame = 0; frame < 30; frame++) world.update(1 / 60)
      const engine = world.workshop()
      expect(engine.add.count + engine.normal.count + engine.debris.count + engine.decals.count + engine.streaks.count, effect.id).toBeGreaterThan(0)
    }
  })

  it('keeps the Workshop recipes apart from the event ones', () => {
    expect(Object.keys(WORKSHOP_EFFECTS)).toHaveLength(36)
    expect(Object.keys(GAME_EFFECTS).length).toBe(36 + EVENT_EFFECTS.length)
  })
})

describe('locale', () => {
  it('has the sheet of every Workshop effect, in both languages', () => {
    for (const [name, strings] of Object.entries(locales)) {
      for (const id of Object.keys(WORKSHOP_EFFECTS)) {
        const texts = strings.effects[id]
        expect(texts, `${name}/${id}`).toBeDefined()
        for (const field of ['name', 'short', 'cost', 'costNote', 'when', 'look', 'budget', 'network'] as const) expect(texts![field], `${name}/${id}/${field}`).toBeTruthy()
        expect(Boolean(texts!.paramLabel), `${name}/${id}/paramLabel`).toBe(Boolean(WORKSHOP_EFFECTS[id]!.params))
      }
      expect(Object.keys(strings.effects).sort()).toEqual(Object.keys(WORKSHOP_EFFECTS).sort())
    }
  })
})
