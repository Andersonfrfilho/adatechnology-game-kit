import { extractLiteral } from '@adatechnology/golden-tool/cut-source'

import { SOURCE_PATHS } from './paths'
import { readSource } from './read-source'

export type AccessoryRow = { readonly id: string; readonly slot: 'hair' | 'hat' | 'face' | 'worn' | 'hand' }

export type Extra = readonly [string, number?]

/** A body as the portraits page builds it: the professions and the named people share the shape. */
export type PortraitBody = {
  readonly skin: number
  readonly hair: { readonly s: string; readonly c: number }
  readonly hat?: { readonly k: string; readonly c: number }
  readonly face?: readonly string[]
  readonly top: { readonly c: number; readonly sl: string; readonly plaid?: number }
  readonly pants: { readonly c: number }
  readonly shoes: number
  readonly ex?: readonly Extra[]
  readonly hand?: string | null
  readonly lhand?: string
  readonly h?: number
  readonly bulk?: number
  readonly hunch?: number
}

export type PeopleBody = { readonly years: number | undefined; readonly isChild: boolean; readonly body: PortraitBody }

const HAIR = ['  // hair\n', '  // face\n'] as const
const FACE = ['  // face\n', '  // hats\n'] as const
const HATS = ['  // hats\n', '  // extras\n'] as const
const WORN = ['  // extras\n', '  // hand items\n'] as const
const HAND = ['  // hand items\n', '  // zombie blood'] as const

const block = (source: string, [from, to]: readonly [string, string]): string => {
  const start = source.indexOf(from)
  const end = source.indexOf(to, start)
  if (start < 0 || end < 0) throw new Error(`characters-catalog: portraits block "${from.trim()}" not found`)
  return source.slice(start, end)
}

const unique = (values: readonly string[]): string[] => [...new Set(values)]
const matches = (text: string, pattern: RegExp): string[] => unique([...text.matchAll(pattern)].map((match) => match[1] ?? ''))

/** Every accessory the portraits builder knows: hair styles, hats, face features, worn extras and hand items, in the order of the code. */
export const extractAccessories = (): readonly AccessoryRow[] => {
  const source = readSource(SOURCE_PATHS.portraits)
  const rows: AccessoryRow[] = [
    ...matches(block(source, HAIR), /hs==='([a-z_]+)'/g).map((id) => ({ id, slot: 'hair' as const })),
    ...matches(block(source, FACE), /f\.includes\('([a-z_]+)'\)/g).map((id) => ({ id, slot: 'face' as const })),
    ...matches(block(source, HATS), /k==='([a-z_]+)'/g).map((id) => ({ id, slot: 'hat' as const })),
    ...matches(block(source, WORN), /case'([a-z_A-Z0-9]+)'/g).map((id) => ({ id, slot: 'worn' as const })),
    ...matches(block(source, HAND), /case'([a-z_A-Z0-9]+)'/g).map((id) => ({ id, slot: 'hand' as const })),
  ]
  return rows
}

type RawPerson = { readonly a: string; readonly kid?: number; readonly b?: PortraitBody; readonly kids?: readonly PortraitBody[] }

/** The bodies of the 44 named people (the children's group carries three), with the age the page prints first in `a`. */
export const extractPeopleBodies = (): readonly PeopleBody[] => {
  const people = extractLiteral<readonly RawPerson[]>(readSource(SOURCE_PATHS.portraits), 'PEOPLE', { PM: { c: 0x5d6e7a, sl: 'long' } })
  return people.flatMap((person) => {
    const years = Number.parseInt(person.a, 10)
    const bodies = person.kids ?? (person.b ? [person.b] : [])
    return bodies.map((body) => ({ years: Number.isNaN(years) ? undefined : years, isChild: person.kid === 1 || person.kids !== undefined, body }))
  })
}
