import type { BenchChange, BenchSheet, ModuleControl, ModuleHost, ModuleMetric, ModuleScenario, TestableModule } from '@adatechnology/game-contracts'

import type { LifeOptions } from '../life/types'
import type { NamePools, SheetRuleset } from '../sheet/ruleset'
import { createSheet } from '../sheet/sheet'
import type { Person, StateId, Story } from '../types'
import { createStoryWorld } from '../world'
import type { StoryWorld, StoryWorldOptions } from '../world'
import { STORIES_EXAMPLE } from './example'
import { storiesBenchTextOf } from './locale'

/** What the bench runs: people, stories, the player's actions it offers and the life simulation. */
export type StoriesContent = {
  readonly people?: readonly Person[]
  readonly stories: readonly Story[]
  readonly actions?: readonly { readonly id: string; readonly name: string }[]
  readonly life?: LifeOptions
  readonly fill?: number
  readonly playerBase?: string
  /** How many days the scenarios run (default 90). */
  readonly days?: number
  /** The kit's own example content (not a game's). */
  readonly example?: boolean
}

/** The content packs the bench runs on: the name pools and the sheet ruleset, and how a profession is called (`defaultStoryContent` of `game-kit-defaults` has the kit's own). */
export type StoriesTestModuleOptions = {
  readonly names: NamePools
  readonly ruleset: SheetRuleset
  /** The name of a profession in the language; default its id. */
  readonly professionName?: (professionId: string, locale: string) => string | undefined
  readonly content?: StoriesContent
  readonly locale?: string
  readonly seed?: number
}

export interface StoriesScenarioLike {
  expect(condition: boolean, label: string, data?: Record<string, unknown>): void
}

export type StoriesTestModule = TestableModule<StoriesScenarioLike> & {
  /** The world as the bench left it (seed, day, actions). */
  readonly world: StoryWorld
  /** Swaps the content (a game's stories, the zombiada slice) and starts again. */
  load(content: StoriesContent): void
}

export const STORIES_AREA_ID = 'stories_area'
/** The day slider goes up to a year, whatever the content. */
const MAX_DAYS = 365

const actionControl = (id: string): string => `act_${id.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`

/**
 * The stories area of a test room, against the generic contracts only, with no 3D: the seed and the day slider run a world of stories, the chronicle
 * of the day and one person's character sheet go to the host's sheet panel. The player's actions are switches. The kit ships two tiny example stories
 * (marked `example`); `load` takes a game's own content.
 */
export function createStoriesTestModule(options: StoriesTestModuleOptions): StoriesTestModule {
  const locale = options.locale ?? 'pt-BR'
  const text = storiesBenchTextOf(locale)
  let content: StoriesContent = options.content ?? STORIES_EXAMPLE[locale === 'en' ? 'en' : 'pt-BR']
  const settings = { seed: options.seed ?? 1, day: Math.min(30, content.days ?? 90), life: true, infection: false, person: '' }
  let actions: Record<string, number> = {}
  let host: ModuleHost | null = null

  const worldOptions = (seed: number, withLife: boolean, infection: boolean, acts: Record<string, number>): StoryWorldOptions => {
    const life = withLife && content.life ? { ...content.life, numbers: { ...content.life.numbers, infection } } : undefined
    return {
      names: options.names,
      ruleset: options.ruleset,
      stories: content.stories,
      ...(content.people ? { people: content.people } : {}),
      seed,
      ...(life ? { life } : {}),
      ...(life && content.fill ? { fill: content.fill } : {}),
      ...(content.playerBase ? { playerBase: content.playerBase } : {}),
      actions: acts,
      locale,
    }
  }
  const run = (seed: number, day: number, withLife = settings.life, infection = settings.infection, acts: Record<string, number> = actions): StoryWorld => {
    const made = createStoryWorld(worldOptions(seed, withLife, infection, acts))
    made.runTo(day)
    return made
  }
  let world = run(settings.seed, settings.day)

  const personOptions = () =>
    world
      .people()
      .filter((p) => !p.extra || world.states[p.id]?.state !== 'unborn')
      .map((p) => ({ id: p.id, name: p.name }))
  const groupName = (base: string): string => content.life?.groups[base]?.name ?? base

  const showSheet = (): void => {
    if (!host?.bench?.sheet) return
    const id = settings.person && world.person(settings.person) ? settings.person : (personOptions()[0]?.id ?? '')
    const person = world.person(id)
    if (!person) {
      host.bench.sheet(null)
      return
    }
    const sheet = world.sheet(id)
    const derived = sheet.derived()
    const state = world.states[id]
    const lived = world.chronicle.about(id)
    const card: BenchSheet = {
      kicker: `${text.sheet.kicker} · ${text.sheet.day} ${world.day}`,
      title: person.name,
      ...(state?.note ? { body: state.note } : {}),
      facts: [
        { label: text.sheet.state, value: state ? text.states[state.state as StateId] : '' },
        { label: text.sheet.base, value: state ? groupName(state.base) : '' },
        ...(person.age !== undefined ? [{ label: text.sheet.age, value: String(person.age) }] : []),
        { label: text.sheet.profession, value: options.professionName?.(sheet.profession, locale === 'en' ? 'en' : 'pt-BR') ?? sheet.profession },
        { label: text.sheet.pool, value: String(sheet.pool()) },
        ...Object.entries(derived).map(([key, value]) => ({ label: text.derived[key as keyof typeof text.derived] ?? key, value: String(Math.round(value * 100) / 100) })),
      ],
      steps: lived.length > 0 ? lived.slice(-8).map((entry) => ({ at: `${text.sheet.day} ${entry.day}`, text: `${entry.title}: ${entry.text}` })) : [{ at: '', text: text.sheet.none }],
    }
    host.bench.sheet(card)
  }

  const rebuild = (): void => {
    world = run(settings.seed, settings.day)
    host?.bench?.patch('person', { options: personOptions(), ...(settings.person ? { value: settings.person } : {}) })
    showSheet()
  }

  const onChange = (change: BenchChange): void => {
    if (change.kind === 'action') {
      if (change.id === 'next_day') {
        settings.day = Math.min(MAX_DAYS, settings.day + 1)
        host?.bench?.patch('day', { value: settings.day })
      } else if (change.id === 'reset') actions = {}
      rebuild()
      return
    }
    if (change.kind !== 'control') return
    const { id, value } = change
    if (id === 'seed' && typeof value === 'number') settings.seed = value
    else if (id === 'day' && typeof value === 'number') settings.day = value
    else if (id === 'life' && typeof value === 'boolean') settings.life = value
    else if (id === 'infection' && typeof value === 'boolean') settings.infection = value
    else if (id === 'person' && typeof value === 'string') {
      settings.person = value
      showSheet()
      return
    } else {
      const act = (content.actions ?? []).find((a) => actionControl(a.id) === id)
      if (!act || typeof value !== 'boolean') return
      if (value) actions = { ...actions, [act.id]: 1 }
      else {
        const { [act.id]: _off, ...rest } = actions
        void _off
        actions = rest
      }
    }
    rebuild()
  }

  const controls = (): ModuleControl[] => {
    const people = personOptions()
    return [
      { kind: 'number', id: 'seed', name: text.controls.seed, hint: text.hints.seed, min: 1, max: 9999, step: 1, default: settings.seed },
      { kind: 'number', id: 'day', name: text.controls.day, hint: text.hints.day, min: 0, max: MAX_DAYS, step: 1, default: settings.day },
      { kind: 'boolean', id: 'life', name: text.controls.life, hint: text.hints.life, default: settings.life },
      { kind: 'boolean', id: 'infection', name: text.controls.infection, hint: text.hints.infection, default: settings.infection },
      { kind: 'choice', id: 'person', name: text.controls.person, hint: text.hints.person, options: people.length > 0 ? people : [{ id: '', name: '-' }], default: people[0]?.id ?? '' },
      ...(content.actions ?? []).map((a): ModuleControl => ({ kind: 'boolean', id: actionControl(a.id), name: a.name, hint: text.hints.action, default: false })),
      { kind: 'action', id: 'next_day', name: text.controls.next_day },
      { kind: 'action', id: 'reset', name: text.controls.reset },
    ]
  }

  const count = (states: readonly StateId[]): number => Object.values(world.states).filter((s) => states.includes(s.state)).length
  const metrics = (): ModuleMetric[] => [
    { id: 'current_day', name: text.metrics.day, digits: 0, read: () => world.day },
    { id: 'people', name: text.metrics.people, digits: 0, read: () => world.people().length },
    { id: 'living', name: text.metrics.living, digits: 0, read: () => count(['ok', 'hurt', 'party', 'hostile', 'moved']) },
    { id: 'dead', name: text.metrics.dead, digits: 0, read: () => count(['dead']) },
    { id: 'births', name: text.metrics.births, digits: 0, read: () => world.life?.stats.births ?? 0 },
    { id: 'arrivals', name: text.metrics.arrivals, digits: 0, read: () => world.life?.stats.arrivals ?? 0 },
    { id: 'lines', name: text.metrics.lines, digits: 0, read: () => world.chronicle.entries.length },
    { id: 'last', name: text.metrics.last, read: () => world.chronicle.entries.at(-1)?.title ?? '' },
  ]

  const days = (): number => content.days ?? 90
  const lines = (made: StoryWorld): string => made.chronicle.entries.map((e) => `${e.day}|${e.id}|${e.text}`).join('\n')
  const scenarios = (): Array<ModuleScenario<StoriesScenarioLike>> => [
    {
      id: 'stories_determinism',
      name: text.scenarios.determinism,
      run: ({ expect }) => {
        const a = lines(run(7, days(), true, false, {}))
        expect(a === lines(run(7, days(), true, false, {})) && a.length > 0, 'the same seed gives the same chronicle')
      },
    },
    {
      id: 'stories_casting',
      name: text.scenarios.casting,
      run: ({ expect }) => {
        const names = (seed: number) => run(seed, 0, false, false, {}).people().map((p) => p.name).join(',')
        const drawn = new Set([1, 2, 3, 4, 5].map(names))
        expect(drawn.size > 1, 'five seeds do not all cast the same names', { casts: drawn.size })
      },
    },
    {
      id: 'stories_normal_world',
      name: text.scenarios.normal_world,
      run: ({ expect }) => {
        let bites = 0
        for (let seed = 1; seed <= 10; seed++) bites += run(seed, days(), true, false, {}).chronicle.entries.filter((e) => e.kind === 'life' && e.changes.some((c) => c.state === 'bitten' || c.state === 'undead')).length
        expect(bites === 0, 'ten worlds without the infection layer: no bite, nobody turns', { bites })
      },
    },
    {
      id: 'stories_sheet_keeps',
      name: text.scenarios.sheet_keeps,
      run: ({ expect }) => {
        const made = run(3, days(), false, false, {})
        const entry = made.chronicle.entries.find((e) => e.kind === 'story')
        const id = entry?.people[0]
        expect(Boolean(entry && id && made.sheet(id).remembers(entry.id)), 'whoever a beat is about keeps it in their sheet', { beat: entry?.id, person: id })
      },
    },
    {
      id: 'stories_point_buy',
      name: text.scenarios.point_buy,
      run: ({ expect }) => {
        const nurse = createSheet({ ruleset: options.ruleset, profession: 'nurse' })
        expect(nurse.pool() === 12, 'a nurse starts with 14 − 2 = 12 points', { pool: nurse.pool() })
        const spent = createSheet({ ruleset: options.ruleset, profession: 'nurse', attributes: { agility: 8 }, traits: ['athlete', 'smoker'] })
        expect(spent.pool() === 6 && spent.valid(), 'agility 8 (−5), athlete (−4), smoker (+3): 6 left', { pool: spent.pool() })
        const clash = createSheet({ ruleset: options.ruleset, traits: ['athlete', 'asthmatic'] })
        expect(!clash.valid(), 'athlete and asthmatic exclude each other')
      },
    },
    {
      id: 'stories_crossing',
      name: text.scenarios.crossing,
      run: ({ expect }) => {
        const differ = (content.actions ?? []).some((a) => lines(run(5, days(), false, false, {})) !== lines(run(5, days(), false, false, { [a.id]: 1 })))
        expect(differ, 'some player action changes the chronicle')
      },
    },
  ]

  const module: StoriesTestModule = {
    id: STORIES_AREA_ID,
    name: text.name,
    group: text.group,
    get world() {
      return world
    },
    load(next) {
      content = next
      actions = {}
      settings.person = ''
      rebuild()
    },
    items: () => [],
    controls: () => controls(),
    metrics: () => metrics(),
    scenarios: () => scenarios(),
    attach(lent) {
      host = lent
      const off = lent.bench?.onChange(onChange)
      showSheet()
      return () => {
        off?.()
        host?.bench?.sheet?.(null)
        host = null
      }
    },
  }
  return module
}
