import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { GAME_SLICE_DIR } from '../src/paths'
import { extractLiving, extractPortraits } from '../src/extract-living'

import { inputs } from './helpers'

const living = extractLiving()
const portraits = extractPortraits()
const readSlice = <TValue>(file: string): TValue => JSON.parse(readFileSync(join(GAME_SLICE_DIR, file), 'utf8')) as TValue

describe('the game slice for the zombiada repository', () => {
  it('has the 44 named people, the 18 groups, and every person in a group that exists', () => {
    expect(portraits.people).toHaveLength(44)
    expect(Object.keys(living.groups)).toHaveLength(18)
    expect(living.people).toHaveLength(44)
    expect(new Set(portraits.people.map((person) => person.id)).size).toBe(44)
    for (const person of portraits.people) expect(living.groups[person.g], person.id).toBeDefined()
    expect(readSlice<unknown[]>('people.json')).toHaveLength(44)
  })

  it('has the relations, the 47 events, the 7 factions with 7º BIS, the ranks and the rank rule', () => {
    expect(living.relations.length).toBeGreaterThan(50)
    expect(living.events).toHaveLength(47)
    expect(living.factions).toHaveLength(7)
    expect(JSON.stringify(living.factions)).toContain('7º BIS')
    expect(living.ranks.length).toBeGreaterThan(0)
    expect(living.rankRule).toContain('−20')
    expect(living.loot).toHaveLength(51)
  })

  it('keeps the life simulation source verbatim, with the functions the game calls', () => {
    for (const name of ['function life(', 'function simulate(', 'function world(', 'function apply(']) expect(living.lifeSimulationSource).toContain(name)
  })

  it('has the block characters of the game, with Seu Cícero and Sandra (Phase 8 roles) and the points table', () => {
    const block = readSlice<{ n?: string; nome?: string }[]>('block-characters.json')
    expect(JSON.stringify(block)).toContain('Cícero')
    expect(JSON.stringify(block)).toContain('Sandra')
    const table = readSlice<{ calibers: Record<string, { points: number }> }>('points-table.json')
    expect(table.calibers['9x19']?.points).toBe(35)
  })

  it('has the Elenco professions (12) as the source of the generic profession presets of game-characters-people', () => {
    expect(inputs.elenco.professions).toHaveLength(12)
  })

  it('keeps names of the valley out of the SDK data: no group or place of the valley in the undead pack', () => {
    const types = readFileSync(join(GAME_SLICE_DIR, '..', '..', '..', '..', 'packages', 'game-characters-undead', 'src', 'data', 'types.json'), 'utf8')
    for (const group of Object.values(living.groups)) expect(types).not.toContain(String(group.n))
  })
})
