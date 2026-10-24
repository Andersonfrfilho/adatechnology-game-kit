export type LocaleId = 'en' | 'pt-BR'

export type ForceId = 'army' | 'military_police' | 'civil_police' | 'highway_police' | 'prison_police' | 'special_forces' | 'tactical_unit'

export type Force = {
  readonly id: ForceId
  /** Where the content is from: the real names are Brazilian (`br`). */
  readonly region: string
  readonly name: Readonly<Record<LocaleId, string>>
  readonly color: string
  /** Id of the rank ladder the force uses. */
  readonly ranks: string
}

export type Rank = { readonly id: string; readonly name: Readonly<Record<LocaleId, string>>; readonly order: number }

export type RankRule = {
  readonly commander: { readonly choose: 'highest-rank-alive'; readonly minimumCourageAndLoyalty: number }
  readonly disobeyBelowOpinion: number
  readonly onDisobey: readonly string[]
  readonly text: Readonly<Partial<Record<LocaleId, string>>>
}

export type RankData = { readonly ladders: Readonly<Record<string, readonly Rank[]>>; readonly rule: RankRule }

export type Loadout = {
  readonly force: ForceId
  readonly name: Readonly<Record<LocaleId, string>>
  /** Weapon ids of `game-weapons`. */
  readonly weapons: readonly string[]
  /** `one`: the trooper carries one of the weapons; `all`: every one. */
  readonly weaponChoice: 'one' | 'all'
  readonly magazines?: number
  /** Item ids (protection ids of `game-characters` and ids of `game-items`). */
  readonly items: readonly string[]
  readonly radioPerPair?: boolean
  readonly suppressed?: boolean
}

export type LootCategory = 'weapon' | 'protection' | 'equipment' | 'consumable' | 'key' | 'document' | 'trade'

export type LootEntry = {
  readonly itemId: string
  readonly kind: 'weapon' | 'item'
  readonly name: Readonly<Record<LocaleId, string>>
  readonly category: LootCategory
  readonly rarity: string
  /** Chance of being among the finds of one draw, 0..1. */
  readonly chance: number
}

/** The shape of the `FindsQuery` of `game-items` and of the floorplan, so a provider plugs in without importing either. */
export type FindsQuery = {
  readonly place: string
  readonly container: string
  readonly state: string
  readonly rng: () => number
  /** The force id when it differs from `container`. */
  readonly key?: string
}

export type FindStack = { readonly itemId: string; readonly count: number }

export type FindsProvider = { findsFor(query: FindsQuery): readonly FindStack[] }

export type UniformedLocale = {
  readonly categories: Readonly<Record<LootCategory, string>>
  readonly rarities: Readonly<Record<string, string>>
  readonly rule: string
}
