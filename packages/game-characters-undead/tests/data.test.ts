import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { UNDEAD_AGES, UNDEAD_INFECTION, UNDEAD_LOCALES, UNDEAD_MOMENTS, UNDEAD_OUTFITS, UNDEAD_TYPES, childTypeIds, getUndeadAge, getUndeadOutfit, getUndeadType } from '../src'

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/team-golden/game-spawn.json', import.meta.url)), 'utf8')) as {
  events: { type: string; data: { type?: string; age?: number; outfit?: number; health?: number } }[]
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)

describe('undead types', () => {
  it('has the 13 types of the game with their eyes, gait and perception', () => {
    expect(UNDEAD_TYPES.map((type) => type.id)).toEqual(['walker', 'runner', 'crawler', 'brute', 'sniffer', 'leaper', 'bloater', 'stalker', 'blind', 'screamer', 'charred', 'drowned', 'devourer'])
    for (const type of UNDEAD_TYPES) {
      expect(type.eye.color).toMatch(/^[0-9A-F]{6}$/)
      expect(Object.keys(type.gait).length).toBeGreaterThan(0)
      expect(type.perception.sight).toBeGreaterThanOrEqual(0)
      expect(type.name.en.length).toBeGreaterThan(0)
    }
  })

  it('spawns the drowned with weight 1, only where there is water (design question 4)', () => {
    expect(getUndeadType('drowned')).toMatchObject({ spawnWeight: 1, requires: 'water' })
  })

  it('keeps brute and bloater out of the child pool (design question 2)', () => {
    expect(childTypeIds()).toHaveLength(11)
    expect(childTypeIds()).not.toContain('brute')
    expect(childTypeIds()).not.toContain('bloater')
  })

  it('knows every type the golden spawns draw', () => {
    const spawns = fixture.events.filter((event) => event.type === 'spawn')
    expect(spawns.length).toBe(650)
    for (const { data } of spawns) expect(getUndeadType(data.type ?? '')).toBeDefined()
  })
})

describe('ages and outfits', () => {
  it('has probabilities that sum to 1 and indexes the golden draws', () => {
    expect(sum(UNDEAD_AGES.ages.map((age) => age.probability))).toBeCloseTo(1, 6)
    expect(sum(UNDEAD_OUTFITS.map((outfit) => outfit.probability))).toBeCloseTo(1, 6)
    for (const { data } of fixture.events.filter((event) => event.type === 'spawn')) {
      expect(UNDEAD_AGES.ages[data.age ?? 0]).toBeDefined()
      expect(UNDEAD_OUTFITS[data.outfit ?? 0]).toBeDefined()
    }
  })

  it('has the four ages and four outfits with protection ids for game-items', () => {
    expect(UNDEAD_AGES.ages.map((age) => age.id)).toEqual(['fresh', 'recent', 'old', 'decrepit'])
    expect(getUndeadAge('decrepit')?.blood).toBe(0)
    expect(UNDEAD_OUTFITS.map((outfit) => outfit.id)).toEqual(['civilian', 'police', 'military', 'firefighter'])
    expect(getUndeadOutfit('military')?.protection).toEqual(['vest_military', 'helmet_combat'])
    expect(getUndeadOutfit('police')?.protection).toEqual(['vest_police'])
  })
})

describe('infection and moments', () => {
  it('uses the three wound types of the game (design question 1)', () => {
    expect(UNDEAD_INFECTION.wounds.scratch.infectionChance).toBe(0.06)
    expect(UNDEAD_INFECTION.wounds.laceration.infectionChance).toBe(0.22)
    expect(UNDEAD_INFECTION.wounds.bite.infectionChance).toBe(1)
    expect(UNDEAD_INFECTION.accelerated.deathSeconds).toBeGreaterThan(UNDEAD_INFECTION.accelerated.feverSeconds)
    expect(UNDEAD_INFECTION.stages).toHaveLength(5)
  })

  it('has the speed moments with a night multiplier of 1', () => {
    expect(UNDEAD_MOMENTS).toMatchObject({ scream: 1.2, injured: 0.5, crawlCap: 0.4, night: 1 })
  })
})

describe('locales', () => {
  it('covers every id in en and pt-BR', () => {
    for (const locale of Object.values(UNDEAD_LOCALES)) {
      expect(Object.keys(locale.typeText)).toEqual(UNDEAD_TYPES.map((type) => type.id))
      expect(Object.keys(locale.ages)).toEqual(UNDEAD_AGES.ages.map((age) => age.id))
      expect(Object.keys(locale.outfits)).toEqual(UNDEAD_OUTFITS.map((outfit) => outfit.id))
      expect(locale.stages).toHaveLength(UNDEAD_INFECTION.stages.length)
      expect(Object.keys(locale.wounds)).toEqual(['scratch', 'laceration', 'bite'])
    }
  })

  it('keeps pt-BR equal to the text of the catalog', () => {
    for (const type of UNDEAD_TYPES) expect(UNDEAD_LOCALES['pt-BR'].typeText[type.id]).toEqual(type.text['pt-BR'])
  })
})
