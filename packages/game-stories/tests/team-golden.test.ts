import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createEventRecorder, hashText } from '@adatechnology/golden-tool'
import type { EventValue, GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { createSheet } from '../src/sheet/sheet'
import type { LifeOptions } from '../src/life/types'
import type { ChronicleEntry, Person, Story } from '../src/types'
import { createStoryWorld } from '../src/world'
import { contentOf } from './content'

const SLICE = join(__dirname, '../../../specs/001-migracao-entregas-dos-times/game-slice/stories')
const slice = <T>(file: string): T => JSON.parse(readFileSync(join(SLICE, file), 'utf8')) as T
const golden = JSON.parse(readFileSync(join(__dirname, 'fixtures/team-golden/game-stories-life.json'), 'utf8')) as GoldenRecord
const cast = slice<Person[]>('cast.json')
const stories = slice<Story[]>('stories.json')
const life = slice<LifeOptions>('life.json')
const of = (type: string) => golden.events.filter((e) => e.type === type).map((e) => e.data as Record<string, any>)

/** The team's state words (the kit keeps its own ids; the valley's are the team's). */
const TEAM_STATE: Record<string, string> = { ok: 'ok', hurt: 'ferido', bitten: 'mordido', undead: 'zumbi', dead: 'morto', missing: 'sumido', party: 'grupo', hostile: 'hostil', moved: 'mudou', left: 'partiu', unborn: 'nao' }
const TEAM_STAT: Record<string, string> = { births: 'nasc', arrivals: 'cheg', deaths: 'mort', couples: 'casais', fights: 'brigas', betrayals: 'trai', caravans: 'carav', raids: 'ataques', pregnancies: 'gravidez' }

const rows = (entry: ChronicleEntry) => entry.changes.map((c) => [c.id, TEAM_STATE[c.state]!, c.note, ...(c.base ? [c.base] : [])])
const world = (days: number, seed: number | undefined, actions: readonly string[], fill?: number) => {
  const made = createStoryWorld({ ...contentOf(), people: cast, stories, playerBase: life.playerBase!, ...(seed === undefined ? {} : { life, seed }), actions: Object.fromEntries(actions.map((id) => [id, 1])), ...(fill ? { fill } : {}) })
  made.runTo(days)
  return made
}
const stateRows = (made: ReturnType<typeof world>) => Object.entries(made.states).map(([id, s]) => [id, TEAM_STATE[s.state]!, s.note, s.base ?? ''])
const round = (type: string, data: Record<string, EventValue>) => {
  const recorder = createEventRecorder()
  recorder.record(type, data)
  return recorder.events()[0]!.data!
}

describe('the Os Vivos do Vale golden (game-stories-life.json)', () => {
  for (const run of of('run')) {
    it(`replays ${run.id}: the same log, line by line, and the same valley at the end`, () => {
      const made = world(run.days, run.seed, run.actions, run.fill || undefined)
      const expected = of('log').filter((e) => e.run === run.id)
      const actual = made.chronicle.entries.map((e) => round('log', { run: run.id, d: e.day, t: e.title, txt: e.text, alt: e.alt ? 1 : 0, ch: rows(e) }))
      for (let i = 0; i < Math.max(expected.length, actual.length); i++) expect(actual[i], `line ${i}`).toEqual(expected[i])
      const final = of('final').find((e) => e.run === run.id)!
      const W = made.life!
      const mine = round('final', {
        run: run.id,
        S: stateRows(made),
        flags: Object.keys(made.flags).sort(),
        stats: Object.entries(W.stats).map(([key, value]) => [TEAM_STAT[key]!, value]),
        food: Object.entries(W.food).map(([key, value]) => [key, value]),
        partners: Object.entries(W.partner).map(([a, b]) => [a, b]),
        generated: Object.entries(W.made).map(([id, p]) => [id, p.name, p.age!, p.base, p.female ? 1 : 0, JSON.stringify(p.personality ?? null), p.bond ?? '', p.relation ?? '']),
        affinity: Object.entries(W.affinity).map(([key, value]) => [key, value]),
      })
      expect(mine.S).toEqual(final.S)
      expect(mine.flags).toEqual(final.flags)
      expect(mine.food).toEqual(final.food)
      expect(mine.partners).toEqual(final.partners)
      expect(mine.generated).toEqual(final.generated)
      expect(mine.affinity).toEqual(final.affinity)
      const statsOrder = (list: EventValue) => [...(list as [string, number][])].sort((a, b) => a[0].localeCompare(b[0]))
      expect(statsOrder(mine.stats!)).toEqual(statsOrder(final.stats))
    })
  }

  it('replays 40 more lives with the page fill of 100 people (texts and states as hashes)', () => {
    for (const lived of of('life')) {
      const made = world(90, lived.seed, [], 100)
      const log = made.chronicle.entries.map((e) => [e.day, e.title, e.alt ? 1 : 0, hashText(e.text), JSON.stringify(rows(e))])
      expect(log, `seed ${lived.seed}`).toEqual(lived.log)
      expect(hashText(JSON.stringify(stateRows(made))), `seed ${lived.seed}`).toBe(lived.S)
    }
  })

  it('replays the 47 events alone on 96 drawn sets of player actions', () => {
    for (const run of of('events')) {
      const made = world(90, undefined, run.actions)
      const log = made.chronicle.entries.map((e) => [e.day, e.title, e.alt ? 1 : 0, hashText(e.text), JSON.stringify(rows(e))])
      expect(log, `actions ${run.actions.join(',')}`).toEqual(run.log)
      expect(hashText(JSON.stringify(stateRows(made))), `actions ${run.actions.join(',')}`).toBe(run.S)
      expect(Object.keys(made.flags).sort()).toEqual(run.flags)
    }
  })
})

describe('the Personagens golden: point buy and derived values', () => {
  const PROFESSION: Record<string, string> = { enf: 'nurse', pm: 'police_officer', bomb: 'firefighter', mec: 'mechanic', ped: 'builder', coz: 'cook', cac: 'sport_shooter', agr: 'farmer', ele: 'electrician', moto: 'courier', prof: 'teacher', des: 'unemployed' }
  const TRAIT: Record<string, string> = { atleta: 'athlete', olhos: 'eagle_eyes', frio: 'cold_blood', rapido: 'fast_learner', silen: 'light_feet', org: 'organized', touro: 'tough_body', sono: 'light_sleeper', fumante: 'smoker', asma: 'asthmatic', miope: 'short_sighted', desaj: 'clumsy', medroso: 'fearful', sedent: 'sedentary', hemo: 'bleeds_easily', lento: 'slow_learner', pesado: 'heavy_sleeper', glutao: 'big_eater' }
  const DERIVED: Record<string, string> = { vida: 'health', folego: 'stamina', carga: 'carry', corrida: 'run_speed', raio: 'detection', ruido: 'noise', xp: 'learning', comp: 'composure', dano: 'melee' }
  it('gives the creator page pool and the nine derived values on 48 drawn sheets', () => {
    for (const item of of('sheet')) {
      const [strength, vigor, agility, perception, intellect, presence] = item.attributes as number[]
      const sheet = createSheet({ ...contentOf(), profession: PROFESSION[item.profession]!, attributes: { strength, vigor, agility, perception, intellect, presence }, traits: (item.traits as string[]).map((t) => TRAIT[t]!) })
      const derived = sheet.derived()
      const mine = round('sheet', { pool: sheet.pool(), derived: (item.derived as [string, number][]).map(([key]) => [key, derived[DERIVED[key]!]!]) })
      expect(mine).toEqual({ pool: item.pool, derived: item.derived })
    }
  })
})
