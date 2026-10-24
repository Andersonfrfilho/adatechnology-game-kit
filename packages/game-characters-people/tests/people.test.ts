import { createCharacters } from '@adatechnology/game-characters'
import { describe, expect, it } from 'vitest'

import { ACCESSORIES, AGE_PRESETS, APPEARANCE_POOLS, PEOPLE_LOCALES, PROFESSIONS, createPeoplePack, getAgePreset, getProfession } from '../src'

describe('professions', () => {
  it('has the 12 generic professions in English ids with both names', () => {
    expect(PROFESSIONS.map((profession) => profession.id)).toEqual([
      'nurse', 'police_officer', 'firefighter', 'mechanic', 'builder', 'cook', 'sport_shooter', 'farmer', 'electrician', 'courier', 'teacher', 'unemployed',
    ])
    for (const profession of PROFESSIONS) {
      expect(profession.name.en.length).toBeGreaterThan(0)
      expect(profession.name['pt-BR'].length).toBeGreaterThan(0)
      expect(profession.carries.en.length).toBeGreaterThan(0)
      expect(profession.look.skin).toMatch(/^[0-9A-F]{6}$/)
    }
  })

  it('only knows accessories the builder has', () => {
    const known = new Set(ACCESSORIES.map((accessory) => accessory.id))
    for (const profession of PROFESSIONS) {
      for (const accessory of profession.accessories) expect(known.has(accessory.id)).toBe(true)
      if (profession.hand) expect(known.has(profession.hand)).toBe(true)
      if (profession.look.hat) expect(known.has(profession.look.hat.kind)).toBe(true)
      for (const feature of profession.look.face ?? []) expect(known.has(feature)).toBe(true)
      expect(known.has(profession.look.hair.style)).toBe(true)
    }
  })

  it('gives the police officer a vest and the firefighter turnout gear', () => {
    expect(getProfession('police_officer')?.protection).toEqual(['vest_police'])
    expect(getProfession('firefighter')?.protection).toEqual(['turnout_gear'])
    expect(getProfession('nurse')?.female).toBe(true)
  })
})

describe('age presets and pools', () => {
  it('reads the child range from the portraits page (height 0.52 to 0.70, build 0.68 to 0.76)', () => {
    expect(getAgePreset('child')).toMatchObject({ height: [0.52, 0.7], build: [0.68, 0.76] })
    expect(AGE_PRESETS.map((preset) => preset.id)).toEqual(['child', 'young', 'adult', 'elder'])
    expect(AGE_PRESETS.reduce((total, preset) => total + preset.count, 0)).toBeGreaterThanOrEqual(40)
  })

  it('has the appearance pools and about a hundred accessories in five slots', () => {
    expect(APPEARANCE_POOLS.hairStyles).toEqual(expect.arrayContaining(['bun', 'buzz', 'short', 'bald']))
    expect(APPEARANCE_POOLS.skinTones.length).toBeGreaterThan(10)
    expect(ACCESSORIES.length).toBeGreaterThanOrEqual(80)
    expect(new Set(ACCESSORIES.map((accessory) => accessory.slot))).toEqual(new Set(['hair', 'hat', 'face', 'worn', 'hand']))
  })
})

describe('locales', () => {
  it('covers ages and slots in en and pt-BR', () => {
    for (const locale of Object.values(PEOPLE_LOCALES)) {
      expect(Object.keys(locale.ages)).toEqual(AGE_PRESETS.map((preset) => preset.id))
      expect(Object.keys(locale.slots)).toEqual(['hair', 'hat', 'face', 'worn', 'hand'])
    }
  })
})

describe('pack', () => {
  it('turns each profession into a preset of game-characters', () => {
    const kit = createCharacters({ packs: [createPeoplePack()] })
    const officer = kit.create({ seed: 3, kind: 'police_officer' })
    expect(officer.state().body?.alive).toBe(true)
    expect(officer.spec.protection).toEqual(['vest_police'])
    expect(kit.create({ seed: 4, kind: 'nurse' }).spec.sex).toBe('female')
  })
})
