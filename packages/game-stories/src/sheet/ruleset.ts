/** A text in each language the content ships (`en` and `pt-BR` in `game-characters-people`). */
export type LocalizedText = Readonly<Record<string, string>>

// The schema the core reads. A content pack (`game-characters-people`) provides data of this shape; game-stories imports no content (spec 005, D1).

/** The name pools of one language: first names, surnames, babies' names and the kinship words a newcomer is introduced with. */
export type NamePools = {
  readonly male: readonly string[]
  readonly female: readonly string[]
  readonly surnames: readonly string[]
  readonly babyMale: readonly string[]
  readonly babyFemale: readonly string[]
  readonly kinship: { readonly male: readonly string[]; readonly female: readonly string[] }
}

export type SheetAttributeId = 'strength' | 'vigor' | 'agility' | 'perception' | 'intellect' | 'presence'

export type SheetAttribute = { readonly id: SheetAttributeId; readonly key: string; readonly name: LocalizedText; readonly description: LocalizedText }
export type SheetSkillGroup = { readonly id: string; readonly name: LocalizedText; readonly skills: readonly string[] }
/** A skill with what it unlocks at each milestone level (`SheetRuleset.milestoneLevels`). */
export type SheetSkill = { readonly id: string; readonly group: string; readonly name: LocalizedText; readonly milestones: readonly LocalizedText[] }
/** A profession's sheet rule: its points in the point buy (negative costs, positive gives), the starting skill levels, its bonus and kit. */
export type SheetProfession = { readonly id: string; readonly key: string; readonly points: number; readonly skills: Readonly<Record<string, number>>; readonly bonus: LocalizedText; readonly kit: string }
/** A trait: its cost in the point buy (negative costs points, positive gives them) and the traits it cannot be taken with. */
export type SheetTrait = { readonly id: string; readonly key: string; readonly cost: number; readonly excludes: readonly string[]; readonly name: LocalizedText; readonly effect: LocalizedText }
/** A derived value: `(base + Σ per[attribute]·value + Σ add) · Π mul · scale`, the adds and products of the traits the sheet has, in order. */
export type SheetDerived = {
  readonly id: string
  readonly base: number
  readonly per: Readonly<Partial<Record<SheetAttributeId, number>>>
  readonly traits: readonly { readonly trait: string; readonly add?: number; readonly mul?: number }[]
  readonly scale?: number
  readonly unit?: string
  readonly name: LocalizedText
  readonly source: string
}
export type SheetRuleset = {
  readonly pointBuy: { readonly start: number; readonly pool: number; readonly min: number; readonly max: number }
  readonly milestoneLevels: readonly number[]
  readonly attributes: readonly SheetAttribute[]
  readonly skillGroups: readonly SheetSkillGroup[]
  readonly skills: readonly SheetSkill[]
  readonly professions: readonly SheetProfession[]
  readonly traits: readonly SheetTrait[]
  readonly derived: readonly SheetDerived[]
}
