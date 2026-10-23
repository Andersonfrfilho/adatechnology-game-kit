export type EventValue = string | number | boolean | null | readonly EventValue[] | { readonly [key: string]: EventValue }

export type GoldenEvent = {
  readonly type: string
  readonly data?: { readonly [key: string]: EventValue }
}

export type SceneSnapshot = {
  readonly objects: number
  readonly hash: string
  /** The text the hash was computed from, kept so a mismatch can show which node changed. */
  readonly lines: readonly string[]
}

export type GoldenRecord = {
  readonly schema: 1
  readonly name: string
  readonly seed: number
  readonly events: readonly GoldenEvent[]
  readonly scenes: { readonly [label: string]: SceneSnapshot }
}
