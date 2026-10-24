import { SHEET_RULESET } from '@adatechnology/game-characters-people'
import type { SheetAttributeId, SheetRuleset } from '@adatechnology/game-characters-people'

import sheetNumbers from '../data/sheet.json'

export type SheetNumbers = Omit<typeof sheetNumbers, 'sources'>

/** One thing the person lived: a decision, a story beat, an event of the world. Every one is kept (P13). */
export type SheetEntry = { readonly kind: 'decision' | 'story' | 'event'; readonly id: string; readonly day: number; readonly weight?: number; readonly about?: string }
/** A memory (Personagens "Memória e opinião"): what happened, about whom, how much it weighs and when. */
export type Memory = { readonly id: string; readonly about?: string; readonly weight: number; readonly day: number }

export type SheetInput = {
  readonly profession?: string
  readonly attributes?: Partial<Record<SheetAttributeId, number>>
  readonly traits?: readonly string[]
  readonly personality?: readonly number[]
  readonly skills?: Readonly<Record<string, number>>
}

export type CharacterSheet = {
  readonly profession: string
  readonly attributes: Readonly<Record<SheetAttributeId, number>>
  readonly traits: readonly string[]
  /** Skill levels: the profession's start, plus what was given. */
  readonly skills: Readonly<Record<string, number>>
  /** The milestones reached at the current skill levels. */
  milestones(skill: string): readonly number[]
  /** Points left in the point buy (Personagens `pool()`): base + profession + traits − spent. Negative means the sheet is over budget. */
  pool(): number
  /** Whether the sheet follows the point buy (attributes in range, points not over, no excluded traits together). */
  valid(): boolean
  /** Every derived value of the ruleset (`derived()`), by id. */
  derived(): Readonly<Record<string, number>>
  /** Courage, empathy, loyalty, greed, stability, 0..100. */
  readonly personality: readonly number[]
  readonly memories: readonly Memory[]
  /** What this person thinks of others, −100..100. */
  readonly opinions: Readonly<Record<string, number>>
  /** Everything the person lived, in order. */
  readonly history: readonly SheetEntry[]
  /** Keeps an entry; one with a weight is also a memory (the lightest, then the oldest, goes past the limit). */
  record(entry: SheetEntry): void
  /** Whether the person lived this entry id. */
  remembers(id: string): boolean
  /** Moves the opinion of someone by `delta`, inside −100..100. */
  opine(about: string, delta: number): number
  /** The opinions decay towards neutral by `days` (Personagens: "decai devagar para o neutro"). */
  decay(days: number): void
  /** What the opinion means: joins the group at +60, may rob, betray or attack below −60. */
  stance(about: string): 'joins' | 'hostile' | 'neutral'
}

export type SheetOptions = SheetInput & { readonly ruleset?: SheetRuleset; readonly numbers?: Partial<SheetNumbers> }

/** A character sheet on the Personagens ruleset (`game-characters-people` `SHEET_RULESET`), with the memory and opinion rules of the document. */
export function createSheet(options: SheetOptions = {}): CharacterSheet {
  const rules = options.ruleset ?? SHEET_RULESET
  const N = { ...sheetNumbers, ...options.numbers }
  const professionId = options.profession ?? rules.professions[rules.professions.length - 1]!.id
  const profession = rules.professions.find((p) => p.id === professionId)
  if (!profession) throw new Error(`game-stories: unknown profession "${professionId}"`)
  const attributes = Object.fromEntries(rules.attributes.map((a) => [a.id, options.attributes?.[a.id] ?? rules.pointBuy.start])) as Record<SheetAttributeId, number>
  const traits = [...(options.traits ?? [])]
  for (const id of traits) if (!rules.traits.some((t) => t.id === id)) throw new Error(`game-stories: unknown trait "${id}"`)
  const skills: Record<string, number> = { ...profession.skills }
  for (const [id, level] of Object.entries(options.skills ?? {})) skills[id] = (skills[id] ?? 0) + level
  const memories: Memory[] = []
  const opinions: Record<string, number> = {}
  const history: SheetEntry[] = []
  const has = (id: string): boolean => traits.includes(id)
  const traitPoints = (): number => traits.reduce((sum, id) => sum + rules.traits.find((t) => t.id === id)!.cost, 0)
  const spent = (): number => Object.values(attributes).reduce((sum, v) => sum + (v - rules.pointBuy.start), 0)
  const clampOpinion = (v: number): number => Math.max(N.opinion.min, Math.min(N.opinion.max, v))
  return {
    profession: professionId,
    attributes,
    traits,
    skills,
    milestones: (skill) => rules.milestoneLevels.map((level, index) => ((skills[skill] ?? 0) >= level ? index : -1)).filter((index) => index >= 0),
    pool: () => rules.pointBuy.pool + profession.points + traitPoints() - spent(),
    valid() {
      const inRange = Object.values(attributes).every((v) => v >= rules.pointBuy.min && v <= rules.pointBuy.max)
      const excluded = traits.some((id) => rules.traits.find((t) => t.id === id)!.excludes.some(has))
      return inRange && !excluded && this.pool() >= 0
    },
    derived() {
      const out: Record<string, number> = {}
      for (const rule of rules.derived) {
        let value = rule.base
        for (const [attribute, factor] of Object.entries(rule.per)) value += factor! * attributes[attribute as SheetAttributeId]
        for (const t of rule.traits) if (has(t.trait) && t.add !== undefined) value += t.add
        for (const t of rule.traits) if (has(t.trait) && t.mul !== undefined) value *= t.mul
        out[rule.id] = rule.scale === undefined ? value : value * rule.scale
      }
      return out
    },
    personality: options.personality ?? [50, 50, 50, 50, 50],
    memories,
    opinions,
    history,
    record(entry) {
      history.push(entry)
      if (entry.weight === undefined) return
      memories.push({ id: entry.id, weight: entry.weight, day: entry.day, ...(entry.about ? { about: entry.about } : {}) })
      while (memories.length > N.memories.max) {
        let drop = 0
        for (let i = 1; i < memories.length; i++) if (Math.abs(memories[i]!.weight) < Math.abs(memories[drop]!.weight)) drop = i
        memories.splice(drop, 1)
      }
    },
    remembers: (id) => history.some((entry) => entry.id === id),
    opine: (about, delta) => (opinions[about] = clampOpinion((opinions[about] ?? 0) + delta)),
    decay(days) {
      for (const [about, value] of Object.entries(opinions)) {
        const step = N.opinion.decayPerDay * days
        opinions[about] = value > 0 ? Math.max(0, value - step) : Math.min(0, value + step)
      }
    },
    stance(about) {
      const value = opinions[about] ?? 0
      return value >= N.opinion.joins ? 'joins' : value < N.opinion.hostile ? 'hostile' : 'neutral'
    },
  }
}

/**
 * A sheet drawn at a person's creation (P13: drawn on creation): the person's profession or one drawn, the pool spent one point at a time on an
 * attribute drawn among those under the maximum. No traits unless given.
 */
export function drawSheet(random: () => number, input: SheetInput & { readonly ruleset?: SheetRuleset } = {}): CharacterSheet {
  const rules = input.ruleset ?? SHEET_RULESET
  const profession = input.profession && rules.professions.some((p) => p.id === input.profession) ? input.profession : rules.professions[Math.floor(random() * rules.professions.length)]!.id
  const sheet = createSheet({ ...input, profession })
  const attributes = sheet.attributes as Record<SheetAttributeId, number>
  let left = sheet.pool()
  while (left > 0) {
    const open = rules.attributes.filter((a) => attributes[a.id] < rules.pointBuy.max)
    if (open.length === 0) break
    attributes[open[Math.floor(random() * open.length)]!.id] += 1
    left -= 1
  }
  return sheet
}
