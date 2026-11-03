import { createRng } from '@adatechnology/game-characters'
import { getNamePools, SHEET_RULESET } from '@adatechnology/game-characters-people'
import { castStories } from './casting'
import type { Casting } from './casting'
import { createChronicle } from './chronicle'
import type { Chronicle } from './chronicle'
import lifeNumbers from './data/life.json'
import lifeText from './data/life-text.json'
import { createLifeWorld, fillWorld, lifeDay } from './life/life'
import type { LifeNumbers, LifeOptions, LifeText, LifeWorld } from './life/types'
import type { NamePools, SheetRuleset } from './sheet/ruleset'
import { drawSheet } from './sheet/sheet'
import type { CharacterSheet } from './sheet/sheet'
import { applyChanges } from './story/apply'
import { runBeat } from './story/beat'
import { shortName } from './text'
import type { Actions, CodeBeat, Flags, Person, StateId, States, Story, StoryBeat } from './types'

export type StoryWorldOptions = {
  readonly stories?: readonly Story[]
  /** The people the game wrote, in order (named people first; `extra` ones are left out of the newcomers' bonds). */
  readonly people?: readonly Person[]
  /** The name pools of the language (`getNamePools` of `game-characters-people`, or `defaultStoryContent(locale).names` of `game-kit-defaults`). Default `getNamePools(locale)`; the default is deprecated and removed in the next major. */
  readonly names?: NamePools
  /** The character sheet ruleset (`SHEET_RULESET` of `game-characters-people`, or `defaultStoryContent().ruleset`). Default `SHEET_RULESET`; the default is deprecated and removed in the next major. */
  readonly ruleset?: SheetRuleset
  /** The seed of the world's stream (default 1). The life simulation draws from it as the team's page draws from `rng(seed)`. */
  readonly seed?: number
  /** The life simulation's own stream, instead of `createRng(seed)` (a game with one stream for everything passes it). */
  readonly random?: () => number
  /** The life simulation; without it only the stories happen (the team's page without "vale vivo"). */
  readonly life?: LifeOptions
  /** Fills the world with ordinary people up to this many living ones (the team's `fill`). Needs `life`. */
  readonly fill?: number
  /** Code beats the game registers, by id (a beat with `run`). */
  readonly codeBeats?: Readonly<Record<string, CodeBeat>>
  /** The base of the people who join the player (default the life simulation's `playerBase`, else 'player'). */
  readonly playerBase?: string
  /** The player's actions at the start (more come through `act`). */
  readonly actions?: Actions
  readonly locale?: string
}

export type StoryWorld = {
  readonly states: States
  readonly flags: Flags
  readonly actions: Actions
  readonly casting: Casting
  readonly chronicle: Chronicle
  /** The life simulation's world (food, affinities, partners, the people it made), or null without `life`. */
  readonly life: LifeWorld | null
  /** The last day run (0 before the first). */
  readonly day: number
  /** The person, given, cast or made by the life simulation. */
  person(id: string): Person | undefined
  /** Everyone, in the order they came into the world. */
  people(): readonly Person[]
  /** The short name the texts use. */
  nameOf(id: string): string
  /** The person who plays a role. */
  cast(role: string): string
  /** A player action: from now on the stories see it. */
  act(id: string): void
  /** Runs the next day: that day's beats of every story, in order, then a day of the life simulation. */
  advance(): void
  /** Runs days up to `day`. */
  runTo(day: number): void
  /** The person's sheet (drawn on first ask from the person's own stream: the same world, the same sheet). */
  sheet(id: string): CharacterSheet
}

const hashId = (text: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  return hash >>> 0
}

/** The text table of a locale with a game's patch over it. */
export const lifeTextOf = (locale: string, patch?: LifeOptions['text']): LifeText => {
  const table = (lifeText as unknown as Record<string, LifeText>)[locale] ?? lifeText['pt-BR']
  if (!patch) return table
  const out: Record<string, unknown> = { ...table }
  for (const [key, value] of Object.entries(patch)) out[key] = Array.isArray(value) ? value : { ...(table as Record<string, object>)[key], ...value }
  return out as LifeText
}

const mergeNumbers = (base: Record<string, unknown>, patch: Record<string, unknown> | undefined): Record<string, unknown> => {
  if (!patch) return base
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    out[key] = value !== null && typeof value === 'object' && !Array.isArray(value) ? mergeNumbers(base[key] as Record<string, unknown>, value as Record<string, unknown>) : value
  }
  return out
}

/** The life numbers with a game's patch over them. */
export const lifeNumbersOf = (patch?: LifeOptions['numbers']): LifeNumbers => {
  const { sources: _sources, ...defaults } = lifeNumbers
  void _sources
  return mergeNumbers(defaults, patch as Record<string, unknown> | undefined) as unknown as LifeNumbers
}

/**
 * A world of stories (Os Vivos do Vale `simulate`, lines 744-756, made generic): the stories cast at creation, then day by day every story's beats of
 * that day in order (each beat's changes applied, its flags raised, its line in the chronicle) and a day of the life simulation. What each person
 * lived goes into their sheet, so the next stories can read it.
 */
export function createStoryWorld(options: StoryWorldOptions = {}): StoryWorld {
  const seed = options.seed ?? 1
  const locale = options.locale ?? 'pt-BR'
  const names = options.names ?? getNamePools(locale)
  const ruleset = options.ruleset ?? SHEET_RULESET
  const stories = options.stories ?? []
  const castRandom = createRng((seed ^ 0x9e3779b9) >>> 0)
  const casting = castStories({ stories, ...(options.people ? { people: options.people } : {}), names, random: castRandom, ...(options.life?.nomadBase ? { defaultBase: options.life.nomadBase } : {}) })
  const given = Object.fromEntries(casting.people.map((person) => [person.id, person]))
  const numbers = lifeNumbersOf(options.life?.numbers)
  const text = lifeTextOf(locale, options.life?.text)
  const states: States = {}
  for (const person of casting.people) states[person.id] = { state: person.start?.state ?? 'ok', note: person.start?.note ?? '', base: person.base }
  const flags: Flags = {}
  const actions: Record<string, unknown> = { ...options.actions }
  const chronicle = createChronicle()
  const cast = (role: string): string => casting.roles[role] ?? role
  const beats: StoryBeat[] = stories.flatMap((story) => story.beats).map((beat, order) => ({ beat, order })).sort((a, b) => a.beat.day - b.beat.day || a.order - b.order).map(({ beat }) => beat)
  const beatDays = new Map<string, number[]>()
  for (const beat of beats) for (const role of beat.roles) (beatDays.get(cast(role)) ?? beatDays.set(cast(role), []).get(cast(role))!).push(beat.day)
  const random = options.random ?? createRng(seed)
  const life = options.life ? createLifeWorld(options.life, numbers) : null
  const sheets = new Map<string, CharacterSheet>()
  const castList = casting.people.filter((person) => !person.extra).map((person) => person.id)
  const person = (id: string): Person | undefined => given[id] ?? life?.made[id]
  const nameOf = (id: string): string => {
    const p = person(id)
    return p ? (p.nick ?? shortName(p.name, text.honorifics)) : id
  }
  const sheet = (id: string): CharacterSheet => {
    let made = sheets.get(id)
    if (!made) {
      const p = person(id)
      made = drawSheet(createRng((seed ^ hashId(id)) >>> 0), { ruleset, ...(p?.profession ? { profession: p.profession } : {}), ...(p?.personality ? { personality: p.personality } : {}) })
      sheets.set(id, made)
    }
    return made
  }
  const living = numbers.livingStates as readonly StateId[]
  const playerBase = options.playerBase ?? options.life?.playerBase ?? 'player'
  let day = 0
  let next = 0

  if (life && options.fill) fillWorld(life, { states, random, names, numbers, options: options.life! }, options.fill)

  const log = (entry: Parameters<Chronicle['add']>[0]): void => {
    chronicle.add(entry)
    for (const id of entry.people) if (person(id)) sheet(id).record({ kind: entry.kind === 'story' ? 'story' : 'event', id: entry.id, day: entry.day })
  }

  const world: StoryWorld = {
    states,
    flags,
    actions,
    casting,
    chronicle,
    life,
    get day() {
      return day
    },
    person,
    people: () => [...casting.people, ...Object.values(life?.made ?? {})],
    nameOf,
    cast,
    act(id) {
      actions[id] = 1
    },
    advance() {
      day += 1
      const d = day
      while (next < beats.length && beats[next]!.day === d) {
        const beat = beats[next++]!
        const outcome = runBeat(beat, { states, flags, actions, cast, living, castList, nameOf, remembers: (id, entry) => sheet(id).remembers(entry), ...(options.codeBeats ? { codeBeats: options.codeBeats } : {}) })
        if (!outcome) continue
        applyChanges(states, outcome.changes, playerBase)
        Object.assign(flags, outcome.flags ?? {})
        log({ day: d, kind: 'story', id: beat.id, title: beat.title, text: outcome.text, ...(outcome.alt ? { alt: true } : {}), changes: outcome.changes ?? [], people: beat.roles.map(cast) })
      }
      while (next < beats.length && beats[next]!.day < d) next++
      if (life) lifeDay(d, life, { states, flags, actions, people: given, beatDays: (id) => beatDays.get(id) ?? [], random, names, numbers, text, options: options.life!, log })
    },
    runTo(target) {
      while (day < target) world.advance()
    },
    sheet,
  }
  return world
}

/** Runs a world `days` days (the team's `simulate(day, A, O)`). */
export function simulateStories(days: number, options: StoryWorldOptions = {}): StoryWorld {
  const world = createStoryWorld(options)
  world.runTo(days)
  return world
}
