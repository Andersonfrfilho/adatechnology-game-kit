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
