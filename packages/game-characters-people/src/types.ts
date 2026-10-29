export type LocaleId = 'en' | 'pt-BR'

export type ProfessionLook = {
  readonly skin: string
  readonly hair: { readonly style: string; readonly color: string }
  readonly hat?: { readonly kind: string; readonly color: string }
  readonly face?: readonly string[]
  readonly top: { readonly color: string; readonly sleeve: string; readonly plaid?: string }
  readonly pants: { readonly color: string }
  readonly shoes: string
}

export type AccessoryRef = { readonly id: string; readonly color?: string }

export type Profession = {
  readonly id: string
  readonly name: Readonly<Record<LocaleId, string>>
  readonly female?: boolean
  /** Points the portraits page prints for the profession in character creation. */
  readonly points: number
  /** Protection item ids of `game-items` the profession wears. */
  readonly protection: readonly string[]
  readonly look: ProfessionLook
  readonly accessories: readonly AccessoryRef[]
  readonly hand?: string
  readonly leftHand?: string
  readonly carries: Readonly<Record<LocaleId, string>>
}

export type AgeGroupId = 'child' | 'young' | 'adult' | 'elder'

/** Ranges read from the named people of the portraits page; height and build are relative to the adult body. */
export type AgePreset = {
  readonly id: AgeGroupId
  readonly count: number
  readonly height: readonly [number, number]
  readonly build: readonly [number, number]
  readonly hunch: readonly [number, number]
}

export type AppearancePools = {
  readonly skinTones: readonly string[]
  readonly hairStyles: readonly string[]
  readonly hairColors: readonly string[]
  readonly hatKinds: readonly string[]
  readonly hatColors: readonly string[]
  readonly faceFeatures: readonly string[]
  readonly sleeves: readonly string[]
  readonly topColors: readonly string[]
  readonly pantsColors: readonly string[]
  readonly shoeColors: readonly string[]
}

export type AccessorySlot = 'hair' | 'hat' | 'face' | 'worn' | 'hand'

export type Accessory = { readonly id: string; readonly slot: AccessorySlot; readonly slotName: string }

export type PeopleLocale = {
  readonly ages: Readonly<Record<AgeGroupId, string>>
  readonly slots: Readonly<Record<AccessorySlot, string>>
}

export type Localized = Readonly<Record<LocaleId, string>>

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

export type SheetAttribute = { readonly id: SheetAttributeId; readonly key: string; readonly name: Localized; readonly description: Localized }
export type SheetSkillGroup = { readonly id: string; readonly name: Localized; readonly skills: readonly string[] }
/** A skill with what it unlocks at each milestone level (`SheetRuleset.milestoneLevels`). */
export type SheetSkill = { readonly id: string; readonly group: string; readonly name: Localized; readonly milestones: readonly Localized[] }
/** A profession's sheet rule: its points in the point buy (negative costs, positive gives), the starting skill levels, its bonus and kit. */
export type SheetProfession = { readonly id: string; readonly key: string; readonly points: number; readonly skills: Readonly<Record<string, number>>; readonly bonus: Localized; readonly kit: string }
/** A trait: its cost in the point buy (negative costs points, positive gives them) and the traits it cannot be taken with. */
export type SheetTrait = { readonly id: string; readonly key: string; readonly cost: number; readonly excludes: readonly string[]; readonly name: Localized; readonly effect: Localized }
/** A derived value: `(base + Σ per[attribute]·value + Σ add) · Π mul · scale`, the adds and products of the traits the sheet has, in order. */
export type SheetDerived = {
  readonly id: string
  readonly base: number
  readonly per: Readonly<Partial<Record<SheetAttributeId, number>>>
  readonly traits: readonly { readonly trait: string; readonly add?: number; readonly mul?: number }[]
  readonly scale?: number
  readonly unit?: string
  readonly name: Localized
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
