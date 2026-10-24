import { cutBetween, cutDeclaration, evaluateSlice } from '@adatechnology/golden-tool/cut-source'
import { createEventRecorder, createGoldenRecord, createSeededRandom, hashText } from '@adatechnology/golden-tool'
import type { EventValue, GoldenRecord } from '@adatechnology/golden-tool'

import { SOURCE_PATHS } from '../paths'
import { readSource } from '../read-source'

const DATA_START = 'const GROUPS={'
const DATA_END = '/* ---------- fardados'
const LIFE_START = 'function rng(seed){let a=seed>>>0;'
const LIFE_END = '/* ---------- render ---------- */'

type PersonState = { st: string; nt: string; b: string }
type LogEntry = { d: number; t: string; txt: string; alt?: number; ch: (readonly string[])[] }
type LifeWorld = { st: Record<string, number>; food: Record<string, number>; n: number; part: Record<string, string>; gen: Record<string, Record<string, unknown>>; aff: Record<string, number> }
type Simulation = { S: Record<string, PersonState>; F: Record<string, unknown>; log: LogEntry[]; W: LifeWorld | null }
type SheetState = { a: Record<string, number>; prof: string; traits: Set<string> }
export type LivingContext = {
  readonly simulate: (day: number, actions: Record<string, number>, options?: { vivo?: number; seed?: number; fill?: number }) => Simulation
  readonly ACTS: readonly { readonly id: string }[]
}
export type SheetContext = {
  readonly S: SheetState
  readonly derived: () => Record<string, number>
  readonly pool: () => number
  readonly PROFS: readonly { readonly id: string }[]
  readonly TRAITS: readonly { readonly id: string; readonly x: readonly string[] }[]
}

/** The Os Vivos do Vale tables, events and life simulation (`world`, `life`, `apply`, `simulate`) in a context of their own. */
export const createLivingHarness = (): LivingContext => {
  const source = readSource(SOURCE_PATHS.livingValley)
  const data = cutBetween(source, DATA_START, DATA_END)
  const life = cutBetween(source, LIFE_START, LIFE_END)
  const byId = cutDeclaration(source, 'byId')
  return evaluateSlice<LivingContext>(`${data}\n${life}\n${byId}`, ['simulate', 'ACTS'], { performance: { now: () => 0 } })
}

/** The Personagens character creator's rule (`S`, `pool`, `derived`) without its page. */
export const createSheetHarness = (): SheetContext => {
  const source = readSource(SOURCE_PATHS.personagens)
  const code = ['ATTRS', 'SKILLS', 'PROFS', 'TRAITS', 'S'].map((name) => cutDeclaration(source, name)).join('\n')
  const rule = cutBetween(source, 'const BASE_POOL=14', 'const $=s=>')
  const fns = cutBetween(source, 'function prof(){', 'function renderAttrs(){')
  const derived = cutBetween(source, 'function derived(){', 'function update(){')
  return evaluateSlice<SheetContext>(`${code}\n${rule}\n${fns}\n${derived}`, ['S', 'derived', 'pool', 'PROFS', 'TRAITS'])
}

/** A life run: the days, the seed of the valley's stream, the player's actions and the extra people the page's "fill" adds. */
export type LifeRun = { readonly id: string; readonly days: number; readonly seed: number; readonly actions: readonly string[]; readonly fill?: number }

const ALL_BUT_DIESEL = ['helena', 'vinicius', 'insulina', 'otavio', 'arnaldo', 'radio', 'penit', 'kauan', 'italo', 'sato', 'dito', 'ponte']
export const LIFE_RUNS: readonly LifeRun[] = [
  { id: 'seed7_no_actions', days: 90, seed: 7, actions: [] },
  { id: 'seed1_no_actions', days: 90, seed: 1, actions: [] },
  { id: 'seed2026_no_actions', days: 90, seed: 2026, actions: [] },
  { id: 'seed7_all_but_diesel', days: 90, seed: 7, actions: ALL_BUT_DIESEL },
  { id: 'seed3_diesel_ponte_dito', days: 90, seed: 3, actions: ['diesel', 'ponte', 'dito', 'italo'] },
  { id: 'seed11_fill_80', days: 90, seed: 11, actions: ['sato', 'kauan'], fill: 80 },
  { id: 'seed42_day_60', days: 60, seed: 42, actions: ['helena', 'radio'] },
]

/** Many more lives, kept short (texts and states as hashes): seeds from 100, the page's fill of 100 people, so the rare rules (rivalry, adoption, coming back) are taken. */
export const MANY_LIVES = { firstSeed: 100, count: 40, fill: 100, days: 90 } as const

/** Event-only runs (no life simulation): every action subset drawn from this stream, so each branch of the 47 events is taken. */
export const EVENT_RUNS = { seed: 20261024, count: 96 } as const

/** Character sheets drawn from this stream: a profession, the six attributes in 1..8 and up to four traits that do not exclude each other. */
export const SHEET_CASES = { seed: 13, count: 48 } as const

const stateRow = (id: string, s: PersonState): EventValue => [id, s.st, s.nt, s.b ?? '']
const changeRows = (ch: readonly (readonly string[])[] | undefined): EventValue => (ch ?? []).map((row) => row.map((cell) => cell ?? ''))

/** Event-only action subsets, drawn as the recorder does (each action on with chance one half). */
export const eventRunActions = (ids: readonly string[]): string[][] => {
  const random = createSeededRandom(EVENT_RUNS.seed)
  return Array.from({ length: EVENT_RUNS.count }, () => ids.filter(() => random() < 0.5))
}

/** The drawn sheets: profession, attributes and traits, as the recorder and the SDK test both build them. */
export const sheetCases = (professions: readonly string[], traits: readonly { readonly id: string; readonly x: readonly string[] }[]) => {
  const random = createSeededRandom(SHEET_CASES.seed)
  const keys = ['for', 'vig', 'agi', 'per', 'int', 'pre']
  return Array.from({ length: SHEET_CASES.count }, () => {
    const profession = professions[Math.floor(random() * professions.length)]!
    const attributes = Object.fromEntries(keys.map((key) => [key, 1 + Math.floor(random() * 8)]))
    const chosen: string[] = []
    const tries = Math.floor(random() * 5)
    for (let k = 0; k < tries; k++) {
      const trait = traits[Math.floor(random() * traits.length)]!
      if (chosen.includes(trait.id) || trait.x.some((x) => chosen.includes(x))) continue
      chosen.push(trait.id)
    }
    return { profession, attributes, traits: chosen }
  })
}

/** G-stories-life: the Os Vivos do Vale simulation (events and the drawn life) and the Personagens sheet rule. */
export const recordStoriesGolden = (): GoldenRecord => {
  const living = createLivingHarness()
  const recorder = createEventRecorder()
  const actionIds = living.ACTS.map((act) => act.id)
  for (const run of LIFE_RUNS) {
    const actions = Object.fromEntries(run.actions.map((id) => [id, 1]))
    const result = living.simulate(run.days, actions, { vivo: 1, seed: run.seed, ...(run.fill ? { fill: run.fill } : {}) })
    recorder.record('run', { id: run.id, days: run.days, seed: run.seed, actions: [...run.actions], fill: run.fill ?? 0 })
    for (const entry of result.log) recorder.record('log', { run: run.id, d: entry.d, t: entry.t, txt: entry.txt, alt: entry.alt ?? 0, ch: changeRows(entry.ch) })
    const W = result.W!
    recorder.record('final', {
      run: run.id,
      S: Object.entries(result.S).map(([id, s]) => stateRow(id, s)),
      flags: Object.keys(result.F).sort(),
      stats: Object.entries(W.st).map(([key, value]) => [key, value]),
      food: Object.entries(W.food).map(([key, value]) => [key, value]),
      partners: Object.entries(W.part).map(([a, b]) => [a, b]),
      generated: Object.entries(W.gen).map(([id, person]) => [id, String(person.n), Number(person.i), String(person.g), person.f ? 1 : 0, JSON.stringify(person.p ?? null), String(person.bond ?? ''), String(person.rel ?? '')]),
      affinity: Object.entries(W.aff).map(([key, value]) => [key, value]),
    })
  }
  for (let k = 0; k < MANY_LIVES.count; k++) {
    const seed = MANY_LIVES.firstSeed + k
    const result = living.simulate(MANY_LIVES.days, {}, { vivo: 1, seed, fill: MANY_LIVES.fill })
    recorder.record('life', {
      seed,
      log: result.log.map((entry) => [entry.d, entry.t, entry.alt ?? 0, hashText(entry.txt), JSON.stringify(entry.ch)]),
      S: hashText(JSON.stringify(Object.entries(result.S).map(([id, s]) => stateRow(id, s)))),
      stats: Object.entries(result.W!.st).map(([key, value]) => [key, value]),
    })
  }
  eventRunActions(actionIds).forEach((on, index) => {
    const actions = Object.fromEntries(on.map((id) => [id, 1]))
    const result = living.simulate(90, actions)
    recorder.record('events', {
      run: index,
      actions: on,
      log: result.log.map((entry) => [entry.d, entry.t, entry.alt ?? 0, hashText(entry.txt), JSON.stringify(entry.ch)]),
      S: hashText(JSON.stringify(Object.entries(result.S).map(([id, s]) => stateRow(id, s)))),
      flags: Object.keys(result.F).sort(),
    })
  })
  const sheet = createSheetHarness()
  for (const item of sheetCases(sheet.PROFS.map((p) => p.id), sheet.TRAITS)) {
    sheet.S.prof = item.profession
    sheet.S.a = { ...item.attributes }
    sheet.S.traits = new Set(item.traits)
    const derived = sheet.derived()
    recorder.record('sheet', { profession: item.profession, attributes: Object.values(item.attributes), traits: item.traits, pool: sheet.pool(), derived: Object.entries(derived).map(([key, value]) => [key, value]) })
  }
  return createGoldenRecord({ name: 'game-stories-life', seed: LIFE_RUNS[0]!.seed, events: recorder.events() })
}
