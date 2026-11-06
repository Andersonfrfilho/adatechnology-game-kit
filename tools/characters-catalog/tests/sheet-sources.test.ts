import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { extractLiteral } from '@adatechnology/golden-tool/cut-source'
import { describe, expect, it } from 'vitest'

import { REPO_ROOT, SOURCE_PATHS } from '../src/paths'

/** A text by locale. */
type Text = Record<string, string>
/** What these tests read of `sheet.json` and `names.json`. */
interface Sheet {
  attributes: { key: string; name: Text; description: Text }[]
  skillGroups: { name: Text }[]
  skills: { id: string; name: Text; milestones: Text[] }[]
  professions: { key: string; points: number; skills: Record<string, number>; bonus: Text; kit: unknown }[]
  traits: { id: string; key: string; name: Text; cost: number; effect: Text; excludes: string[] }[]
  pointBuy: unknown
}
type NamePools = Record<string, { male: string[]; female: string[]; surnames: string[]; babyMale: string[]; babyFemale: string[]; kinship: { male: string[]; female: string[] } }>
const data = <T>(file: string): T => JSON.parse(readFileSync(join(REPO_ROOT, 'packages', 'game-characters-people', 'src', 'data', file), 'utf8')) as T
const personagens = readFileSync(SOURCE_PATHS.personagens, 'utf8')
const sheet = data<Sheet>('sheet.json')
const names = data<NamePools>('names.json')

describe('game-characters-people sheet.json is the Personagens ruleset, literally', () => {
  it('has the ATTRS names and texts in order', () => {
    const ATTRS = extractLiteral<{ k: string; n: string; d: string }[]>(personagens, 'ATTRS')
    expect(sheet.attributes.map((a) => [a.key, a.name['pt-BR'], a.description['pt-BR']])).toEqual(ATTRS.map((a) => [a.k, a.n, a.d]))
  })
  it('has the SKILLS groups, names and the three milestones of each', () => {
    const SKILLS = extractLiteral<{ g: string; items: string[][] }[]>(personagens, 'SKILLS')
    expect(sheet.skillGroups.map((g) => g.name['pt-BR'])).toEqual(SKILLS.map((g) => g.g))
    expect(sheet.skills.map((s) => [s.name['pt-BR'], ...s.milestones.map((m) => m['pt-BR'])])).toEqual(SKILLS.flatMap((g) => g.items))
  })
  it('has the PROFS points, starting skills, bonus and kit', () => {
    const PROFS = extractLiteral<{ id: string; pts: number; sk: Record<string, number>; b: string; kit: unknown }[]>(personagens, 'PROFS')
    const skillName = new Map(sheet.skills.map((s) => [s.id, s.name['pt-BR']]))
    expect(sheet.professions.map((p) => [p.key, p.points, Object.fromEntries(Object.entries(p.skills).map(([k, v]) => [skillName.get(k), v])), p.bonus['pt-BR'], p.kit])).toEqual(PROFS.map((p) => [p.id, p.pts, p.sk, p.b, p.kit]))
  })
  it('has the TRAITS costs, exclusions and effects', () => {
    const TRAITS = extractLiteral<{ id: string; n: string; c: number; e: string; x: string[] }[]>(personagens, 'TRAITS')
    const key = new Map(sheet.traits.map((t) => [t.id, t.key]))
    expect(sheet.traits.map((t) => [t.key, t.name['pt-BR'], t.cost, t.effect['pt-BR'], t.excludes.map((x) => key.get(x))])).toEqual(TRAITS.map((t) => [t.id, t.n, t.c, t.e, t.x]))
  })
  it('has the point buy of the creator (14 points, attributes from 3, 1 to 8)', () => {
    expect(personagens).toContain('const BASE_POOL=14,MAXC=8,MINC=1;')
    expect(personagens).toContain('const S={a:{for:3,vig:3,agi:3,per:3,int:3,pre:3}')
    expect(sheet.pointBuy).toEqual({ start: 3, pool: 14, min: 1, max: 8 })
  })
})

describe('game-characters-people names.json is Os Vivos do Vale NM and RELW, literally', () => {
  it('has every pool in order', () => {
    const source = readFileSync(SOURCE_PATHS.livingValley, 'utf8')
    const NM = extractLiteral<Record<string, string[]>>(source, 'NM')
    const RELW = extractLiteral<Record<string, string[]>>(source, 'RELW')
    const pools = names['pt-BR']!
    expect([pools.male, pools.female, pools.surnames, pools.babyMale, pools.babyFemale]).toEqual([NM.m, NM.f, NM.s, NM.bm, NM.bf])
    expect([pools.kinship.male, pools.kinship.female]).toEqual([RELW.m, RELW.f])
  })
})
