import { describe, expect, it } from 'vitest'

import { NAME_POOLS, PROFESSIONS, SHEET_RULESET, getNamePools } from '../src'

describe('the character sheet ruleset (Personagens)', () => {
  it('has 6 attributes, 24 skills in 5 groups with three milestones each, 12 professions and 18 traits', () => {
    expect(SHEET_RULESET.attributes.map((a) => a.id)).toEqual(['strength', 'vigor', 'agility', 'perception', 'intellect', 'presence'])
    expect(SHEET_RULESET.skills).toHaveLength(24)
    expect(SHEET_RULESET.skillGroups.map((g) => g.skills.length)).toEqual([6, 6, 6, 4, 2])
    for (const skill of SHEET_RULESET.skills) expect(skill.milestones).toHaveLength(SHEET_RULESET.milestoneLevels.length)
    expect(SHEET_RULESET.traits).toHaveLength(18)
    expect(SHEET_RULESET.pointBuy).toEqual({ start: 3, pool: 14, min: 1, max: 8 })
  })

  it('uses the same 12 professions as the pack, with the same points', () => {
    expect(SHEET_RULESET.professions.map((p) => p.id)).toEqual(PROFESSIONS.map((p) => p.id))
    for (const profession of SHEET_RULESET.professions) expect(profession.points).toBe(PROFESSIONS.find((p) => p.id === profession.id)!.points)
  })

  it('names only skills it has, and traits exclude each other both ways', () => {
    const skills = new Set(SHEET_RULESET.skills.map((s) => s.id))
    for (const profession of SHEET_RULESET.professions) for (const id of Object.keys(profession.skills)) expect(skills.has(id)).toBe(true)
    const traits = new Map(SHEET_RULESET.traits.map((t) => [t.id, t]))
    for (const trait of SHEET_RULESET.traits) for (const other of trait.excludes) expect(traits.get(other)!.excludes).toContain(trait.id)
    for (const derived of SHEET_RULESET.derived) for (const { trait } of derived.traits) expect(traits.has(trait)).toBe(true)
  })
})

describe('name pools (Os Vivos do Vale)', () => {
  it('has 16 first names each, 16 surnames, 6 babies of each sex and 7 kinship words each', () => {
    const pools = getNamePools('pt-BR')
    expect([pools.male.length, pools.female.length, pools.surnames.length, pools.babyMale.length, pools.babyFemale.length]).toEqual([16, 16, 16, 6, 6])
    expect([pools.kinship.male.length, pools.kinship.female.length]).toEqual([7, 7])
    expect(getNamePools('xx')).toBe(NAME_POOLS['pt-BR'])
  })
})
