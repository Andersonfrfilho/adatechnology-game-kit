import { readFileSync } from 'node:fs'

import { SOURCE_PATHS } from './paths'

/** A value read from the prose or tables of the page, with the line it came from and the exact words. */
export type Cited<TValue> = { readonly value: TValue; readonly line: number; readonly quote: string }

export type StorageRow = {
  readonly label: string
  readonly multiplier: number
  readonly note: string
  readonly line: number
  readonly quote: string
}

export type IteHtmlRules = {
  readonly freshnessStale: Cited<number>
  readonly freshnessSpoiled: Cited<number>
  readonly freshnessRotten: Cited<number>
  readonly staleSatietyLoss: Cited<number>
  readonly staleIntoxication: Cited<number>
  readonly spoiledIntoxication: Cited<number>
  readonly spoiledMorale: Cited<number>
  readonly spoiledCookedIntoxication: Cited<number>
  readonly batteryLossPerMonth: Cited<number>
  readonly fuelFaultAfterDays: Cited<number>
  readonly fuelFaultChance: Cited<number>
  readonly protectionCap: Cited<number>
  readonly biteWear: Cited<number>
  readonly scratchWear: Cited<number>
  readonly tornShare: Cited<number>
  readonly repairMargin: Cited<number>
  readonly carryBase: Cited<number>
  readonly carryPerStrength: Cited<number>
  readonly carryFactor: Cited<number>
  readonly encumberedAt: Cited<number>
  readonly overloadedAt: Cited<number>
  readonly encumberedPenalty: Cited<number>
  readonly rarityWeights: Cited<readonly number[]>
  readonly conditionRanges: Cited<Readonly<Record<string, readonly [number, number]>>>
  readonly spawnAgeShare: Cited<number>
  readonly batteryChargeRange: Cited<readonly [number, number]>
  readonly jerrycanFillRange: Cited<readonly [number, number]>
  readonly fixedOnlyRarities: Cited<string>
  readonly flooredItemsPerCell: Cited<number>
  readonly armyDrop: Cited<{ readonly fromDay: number; readonly toDay: number; readonly crates: number; readonly noiseRadius: number }>
  readonly freightTrain: Cited<{ readonly everyDays: readonly [number, number]; readonly whistleSeconds: number }>
  readonly powerSchedule: Cited<{ readonly litHousesShare: number; readonly untilDay: number }>
}

export type IteHtml = { readonly storage: readonly StorageRow[]; readonly rules: IteHtmlRules; readonly lines: readonly string[] }

const toNumber = (text: string | undefined): number => Number((text ?? '').replace(/\./g, '').replace(',', '.').replace('−', '-'))
const percent = (match: RegExpExecArray): number => toNumber(match[1]) / 100
const first = (match: RegExpExecArray): number => toNumber(match[1])

/** The first line that matches; `read` turns the regex match into the value. */
const find = <TValue>(lines: readonly string[], pattern: RegExp, read: (match: RegExpExecArray) => TValue): Cited<TValue> => {
  for (let index = 0; index < lines.length; index++) {
    const match = pattern.exec(lines[index] ?? '')
    if (match) return { value: read(match), line: index + 1, quote: match[0] }
  }
  throw new Error(`items-catalog: "${pattern.source}" not found in the Itens do Vale Cinzento page`)
}

const STORAGE_ROW = /<tr><td>([^<]+)<\/td><td class="n">×([\d,]+)<\/td><td>([^<]*)<\/td><\/tr>/

const readStorage = (lines: readonly string[]): StorageRow[] => {
  const rows: StorageRow[] = []
  lines.forEach((text, index) => {
    const match = STORAGE_ROW.exec(text)
    if (match) rows.push({ label: match[1] ?? '', multiplier: toNumber(match[2]), note: match[3] ?? '', line: index + 1, quote: match[0] })
  })
  return rows
}

const readConditionRanges = (match: RegExpExecArray): Record<string, readonly [number, number]> => ({
  common: [toNumber(match[1]), toNumber(match[2])],
  uncommon: [toNumber(match[3]), toNumber(match[4])],
  rare: [toNumber(match[5]), toNumber(match[6])],
})

const readFreshness = (lines: readonly string[]) => ({
  freshnessStale: find(lines, /0–(50)% do prazo/, percent),
  freshnessSpoiled: find(lines, /50–(100)%<\/span>/, percent),
  freshnessRotten: find(lines, /100–(150)%<\/span>/, percent),
  staleSatietyLoss: find(lines, /Sacia (30)% menos/, percent),
  staleIntoxication: find(lines, /(10)% de intoxicação\./, percent),
  spoiledIntoxication: find(lines, /(50)% de intoxicação, moral/, percent),
  spoiledMorale: find(lines, /moral (−20)\./, first),
  spoiledCookedIntoxication: find(lines, /Cozido, (25)%\./, percent),
  batteryLossPerMonth: find(lines, /pilha perde (10)% da carga por mês/, percent),
  fuelFaultAfterDays: find(lines, /gasolina com mais de (180) dias/, first),
  fuelFaultChance: find(lines, /dias falha (10)% das partidas/, percent),
})

const readProtectionAndCarry = (lines: readonly string[]) => ({
  protectionCap: find(lines, /limite = (90)%/, percent),
  biteWear: find(lines, /mordida −(8) de condição/, first),
  scratchWear: find(lines, /arranhão −(3)\./, first),
  tornShare: find(lines, /protege só (25)% do valor/, percent),
  repairMargin: find(lines, /conserta até o máximo menos (10)/, first),
  carryBase: find(lines, /carga_max_kg = \((8) \+ [\d,]+ × FOR\)/, first),
  carryPerStrength: find(lines, /carga_max_kg = \(8 \+ ([\d,]+) × FOR\)/, first),
  carryFactor: find(lines, /\(Organizado ([\d,]+)\)/, first),
  encumberedAt: find(lines, /Acima de (100)% da carga/, percent),
  overloadedAt: find(lines, /Acima de (150)%, não corre/, percent),
  encumberedPenalty: find(lines, /corrida e fôlego caem (25)%/, percent),
})

const readSpawn = (lines: readonly string[]) => ({
  rarityWeights: find(lines, /Raridade: ([\d,]+) \/ ([\d,]+) \/ ([\d,]+) \/ ([\d,]+) \(comum/, (m) => [1, 2, 3, 4].map((group) => toNumber(m[group]))),
  conditionRanges: find(lines, /comum (\d+)–(\d+), incomum (\d+)–(\d+), raro (\d+)–(\d+)/, readConditionRanges),
  spawnAgeShare: find(lines, /dias desde o surto \+ 0 a (60)% do prazo/, percent),
  batteryChargeRange: find(lines, /Pilhas com carga entre (\d+)% e (\d+)%/, (m): readonly [number, number] => [toNumber(m[1]) / 100, toNumber(m[2]) / 100]),
  jerrycanFillRange: find(lines, /galões com (\d+) a (\d+)%/, (m): readonly [number, number] => [toNumber(m[1]) / 100, toNumber(m[2]) / 100]),
  fixedOnlyRarities: find(lines, /(Lendário e único) nunca são sorteados/, (m) => m[1] ?? ''),
  flooredItemsPerCell: find(lines, /No máximo (\d+) itens soltos por célula/, first),
})

const readEvents = (lines: readonly string[]) => ({
  armyDrop: find(lines, /Lançamento do Exército<\/b> \(dias (\d+) a (\d+), uma vez\): helicóptero solta (\d+) caixas militares\. O rotor atrai zumbis num raio de (\d+) m/, (m) => ({
    fromDay: toNumber(m[1]),
    toDay: toNumber(m[2]),
    crates: toNumber(m[3]),
    noiseRadius: toNumber(m[4]),
  })),
  freightTrain: find(lines, /a cada (\d+) a (\d+) dias, com um vagão de uma só categoria\. O apito chega (\d+) s antes/, (m) => ({
    everyDays: [toNumber(m[1]), toNumber(m[2])] as const,
    whistleSeconds: toNumber(m[3]),
  })),
  powerSchedule: find(lines, /Dias 1 a (\d+): (\d+)% das casas têm luz/, (m) => ({ untilDay: toNumber(m[1]), litHousesShare: toNumber(m[2]) / 100 })),
})

export const extractIteHtml = (): IteHtml => {
  const lines = readFileSync(SOURCE_PATHS.iteHtml, 'utf8').split('\n')
  return {
    storage: readStorage(lines),
    rules: { ...readFreshness(lines), ...readProtectionAndCarry(lines), ...readSpawn(lines), ...readEvents(lines) },
    lines,
  }
}
