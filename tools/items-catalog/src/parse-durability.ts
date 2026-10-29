import type { Durability, DurabilityKind } from '@adatechnology/game-items'

/** Noun of the source text -> kind. The noun is kept in `per` when it is not the default one of the kind. */
const NOUN_KIND: Readonly<Record<string, DurabilityKind>> = {
  uso: 'uses',
  usos: 'uses',
  acendimentos: 'uses',
  covas: 'uses',
  canteiros: 'uses',
  lances: 'uses',
  iscas: 'uses',
  capturas: 'uses',
  leitura: 'uses',
  leituras: 'uses',
  par: 'uses',
  porção: 'portions',
  porções: 'portions',
  refeições: 'portions',
  unidades: 'portions',
  dose: 'doses',
  doses: 'doses',
  golpes: 'hits',
  cortes: 'cuts',
  disparos: 'shots',
  recargas: 'charges',
  parafusos: 'charges',
  s: 'seconds',
  min: 'seconds',
  h: 'seconds',
  dia: 'days',
  dias: 'days',
  meses: 'days',
  ano: 'days',
}

/** Seconds (for `seconds`) or days (for `days`) in one of the source's time units. */
const TIME_FACTOR: Readonly<Record<string, number>> = { s: 1, min: 60, h: 3600, dia: 1, dias: 1, meses: 30, ano: 365 }

const DEFAULT_NOUN: Readonly<Record<DurabilityKind, readonly [string, string]>> = {
  uses: ['uso', 'usos'],
  portions: ['porção', 'porções'],
  doses: ['dose', 'doses'],
  hits: ['golpe', 'golpes'],
  cuts: ['corte', 'cortes'],
  shots: ['disparo', 'disparos'],
  charges: ['carga', 'cargas'],
  seconds: ['s', 's'],
  days: ['dia', 'dias'],
  condition: ['', ''],
  infinite: ['', ''],
  container: ['', ''],
}

const NUMBER_FIRST = /^(\d{1,3}(?:\.\d{3})+|\d+) ?(.*)$/

const defaultNoun = (kind: DurabilityKind, amount: number): string => DEFAULT_NOUN[kind][amount === 1 ? 0 : 1]

const firstWord = (text: string): string => text.split(' ')[0] ?? ''

/**
 * `dur` of the team's catalog as a typed durability. Free text ("ver Arsenal", "vida 500", "10 m") becomes `condition` with the words in `per`
 * and no amount, so nothing is lost; "—" is no durability.
 */
export const parseDurability = (text: string): Durability | undefined => {
  if (text === '—') return undefined
  if (text === '∞') return { kind: 'infinite' }
  if (text === 'contêiner') return { kind: 'container' }
  const match = NUMBER_FIRST.exec(text)
  if (!match) return { kind: 'condition', per: text }
  const number = Number((match[1] ?? '').replace(/\./g, ''))
  const remainder = match[2] ?? ''
  if (remainder === '') return { kind: 'condition', amount: number }
  const kind = NOUN_KIND[firstWord(remainder)]
  if (!kind) return { kind: 'condition', per: text }
  const factor = kind === 'seconds' || kind === 'days' ? (TIME_FACTOR[firstWord(remainder)] ?? 1) : 1
  const amount = number * factor
  return remainder === defaultNoun(kind, amount) ? { kind, amount } : { kind, amount, per: remainder }
}

const formatNumber = (value: number): string => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** The inverse of `parseDurability`, in the team's pt-BR wording: what the round trip test compares with the source. */
export const formatDurability = (durability: Durability | undefined): string => {
  if (!durability) return '—'
  if (durability.kind === 'infinite') return '∞'
  if (durability.kind === 'container') return 'contêiner'
  if (durability.amount === undefined) return durability.per ?? ''
  const remainder = durability.per ?? defaultNoun(durability.kind, durability.amount)
  const isTime = durability.kind === 'seconds' || durability.kind === 'days'
  const number = isTime ? durability.amount / (TIME_FACTOR[firstWord(remainder)] ?? 1) : durability.amount
  return remainder === '' ? formatNumber(number) : `${formatNumber(number)} ${remainder}`
}
