/** Where a person stands in the world. The kit's ids; a game names them in its own words through the text tables. */
export type StateId = 'ok' | 'hurt' | 'bitten' | 'undead' | 'dead' | 'missing' | 'party' | 'hostile' | 'moved' | 'left' | 'unborn'

export type PersonState = { state: StateId; note: string; base: string }
/** Every person's state, by id, in the order they came into the world. */
export type States = Record<string, PersonState>

/**
 * A person of the world: someone the game wrote, someone the casting drew from the name pools, or someone the life simulation brought (a
 * newcomer, a baby). `personality` is courage, empathy, loyalty, greed and stability, 0 to 100 (the Personagens axes).
 */
export type Person = {
  readonly id: string
  readonly name: string
  /** The name the texts use (default: the quoted nickname, else the first name after an honorific). */
  readonly nick?: string
  /** Years; a person without a number counts as `LifeNumbers.unknownAge`. */
  readonly age?: number
  readonly female?: boolean
  readonly personality?: readonly number[]
  /** The base (group) the person lives in. */
  readonly base: string
  /** How the person starts the world (default ok, no note). */
  readonly start?: { readonly state: StateId; readonly note: string }
  /** Not in the pool of people a newcomer is related to (a baby to be born, a group of children). */
  readonly extra?: boolean
  readonly profession?: string
  readonly tags?: readonly string[]
  /** Who the casting or the life simulation made them for, and how. */
  readonly bond?: string
  readonly relation?: string
  readonly baby?: boolean
  readonly mother?: string
  readonly father?: string
  /** The role this person was cast for, when the casting made them. */
  readonly role?: string
  /** True for people made during the world (casting, newcomers, babies). */
  readonly generated?: boolean
}

/** A base: where people live together, with its defence (0 to 1, lowers the daily risk inside) and food in days. */
export type Group = { readonly name: string; readonly defence: number; readonly food: number }

/** A relation the world starts with: the two people, the kind (`LifeNumbers.affinity` keys) and a note. */
export type Relation = readonly [a: string, b: string, kind: string, note?: string]

/** The player's actions so far, by id (an action that was done is truthy). */
export type Actions = Readonly<Record<string, unknown>>
/** The flags the stories raised, by id. */
export type Flags = Record<string, unknown>

/**
 * A test on the world, as data: on the states of the people (through their roles), on the flags the stories raised and on the player's actions.
 * Inside a beat, `value` asks whether a named value is set, `self` whether the person being listed plays that role, and `changed` whether the beat's
 * changes so far name that role. Inside an `each`, the role `self` is the person being listed.
 */
export type Condition =
  | { readonly all: readonly Condition[] }
  | { readonly any: readonly Condition[] }
  | { readonly not: Condition }
  | { readonly action: string }
  | { readonly flag: string }
  | { readonly state: string; readonly is: StateId | readonly StateId[] }
  | { readonly living: string }
  | { readonly base: string; readonly is: string }
  | { readonly value: string }
  | { readonly self: string }
  | { readonly changed: string }
  | { readonly remembers: string; readonly entry: string }

/** A piece of a beat's text: plain text, a conditional piece, a named value, the number of the beat's changes, or a person's short name. */
export type TextPart =
  | string
  | { readonly when: Condition; readonly text: string | readonly TextPart[]; readonly else?: string | readonly TextPart[] }
  | { readonly value: string }
  | { readonly count: 'changes' }
  | { readonly name: string }

/** A change the beat makes: the role, the new state, the note, and optionally the new base (or the base another role is in now). */
export type Change = { readonly role: string; readonly state: StateId; readonly note: string; readonly base?: string | { readonly baseOf: string } }
/** A change, a group of changes under a condition, or one change for each of a list of people that pass a test. */
export type ChangeItem =
  | Change
  | { readonly when: Condition; readonly changes: readonly ChangeItem[] }
  | {
      readonly each: { readonly roles?: readonly string[]; readonly cast?: boolean; readonly where?: Condition; readonly except?: readonly string[] }
      readonly change: { readonly state: StateId; readonly note: string; readonly base?: string }
    }

/** One way a beat can go: the first variant whose `when` holds is taken; `none` means the beat does not happen. */
export type BeatVariant = {
  readonly when?: Condition
  readonly none?: boolean
  readonly text?: readonly TextPart[]
  /** Joins the text parts (default nothing: the parts carry their own spaces). */
  readonly join?: string
  readonly changes?: readonly ChangeItem[]
  readonly flags?: Readonly<Record<string, unknown>>
  /** The other path: the one a player action opened (the team's `alt`). */
  readonly alt?: boolean
  /** The beat happens only if it changes someone. */
  readonly needsChanges?: boolean
}

/** A beat of a story on a day: who it is about, named values, the variants, or a code beat the game registered (`run`). */
export type StoryBeat = {
  readonly id: string
  readonly day: number
  readonly title: string
  /** The roles the beat is about (the team's `who`): they are held out of the life simulation's risks for the week before it. */
  readonly roles: readonly string[]
  readonly values?: Readonly<Record<string, readonly { readonly when?: Condition; readonly value: string }[]>>
  readonly variants?: readonly BeatVariant[]
  readonly run?: string
}

/** A role a story needs: a person the game names (`person`), or one the casting draws, from the people or the name pools. */
export type Role = {
  readonly id: string
  readonly person?: string
  readonly tags?: readonly string[]
  readonly needs?: { readonly age?: readonly [number, number]; readonly sex?: 'f' | 'm'; readonly profession?: readonly string[]; readonly base?: string; readonly tags?: readonly string[] }
  /** Made for someone already cast: their kinship word, the same surname, the same base. */
  readonly bond?: { readonly role: string; readonly relation?: string; readonly sameSurname?: boolean; readonly sameBase?: boolean }
  /** Never drawn from the people: always a new person from the name pools. */
  readonly create?: boolean
}

/** A story: its roles, its beats and the stories it crosses (they share roles and flags). */
export type Story = { readonly id: string; readonly roles: readonly Role[]; readonly beats: readonly StoryBeat[]; readonly crosses?: readonly string[]; readonly example?: boolean }

/** What a code beat sees and gives back: the states, the actions, the flags; null when it does not happen. */
export type CodeBeat = (context: { readonly states: States; readonly actions: Actions; readonly flags: Flags; readonly cast: (role: string) => string }) => BeatOutcome | null
export type BeatOutcome = { readonly text: string; readonly alt?: boolean; readonly changes?: readonly ResolvedChange[]; readonly flags?: Readonly<Record<string, unknown>> }

/** A change on a person (the role already resolved). */
export type ResolvedChange = { readonly id: string; readonly state: StateId; readonly note: string; readonly base?: string }

/** One line of the chronicle: a story beat or a rule of the life simulation, its text and what it changed. */
export type ChronicleEntry = {
  readonly day: number
  readonly kind: 'story' | 'life'
  /** The beat id, or the life rule (`risk`, `bond`, `birth`...). */
  readonly id: string
  readonly title: string
  readonly text: string
  readonly alt?: boolean
  readonly changes: readonly ResolvedChange[]
  /** The people it is about (the beat's cast, or who the rule touched). */
  readonly people: readonly string[]
  /** The life rules mark the base whose news it is (none for comings and goings). */
  readonly base?: string
}
