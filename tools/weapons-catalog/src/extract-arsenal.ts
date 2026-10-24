import { readFileSync } from 'node:fs'

import { cellText, numberBefore, parseNumber, sectionRows } from './arsenal-html'
import { SOURCE_PATHS } from './paths'

export type ArsenalCatalogRow = {
  readonly name: string
  readonly caliber: string
  readonly capacity: string
  readonly cadence: string
  readonly reload: ArsenalReload
  readonly loadedMass: number
}

export type ArsenalReload = {
  readonly reload?: number
  readonly reloadEmpty?: number
  readonly perRound?: number
  /** `1 a 1`: the weapon also loads round by round. */
  readonly isOneByOne: boolean
}

export type ArsenalSheetRow = {
  readonly name: string
  readonly length?: number
  /** Lowest and highest length when the sheet gives a range. */
  readonly lengthRange?: readonly [number, number]
  readonly lengthCollapsed?: number
  readonly barrel: number
  readonly emptyMass: number
  readonly muzzleSpeed?: number
  readonly moa?: number
  readonly patternCm?: number
}

export type ArsenalNoiseRow = { readonly source: string; readonly radius: number }

export type ArsenalExplosiveRow = {
  readonly name: string
  readonly lethalRadius?: number
  readonly injuryRadius?: number
  readonly destructionLevel: number
  readonly noise: number
}

/** A line of §11 "Modificações e acessórios": the card it is under, the name in bold and the effect after the colon. */
export type ArsenalAccessoryRow = {
  readonly group: string
  readonly name: string
  readonly effect: string
}

export type ArsenalData = {
  readonly accessories: readonly ArsenalAccessoryRow[]
  readonly catalog: readonly ArsenalCatalogRow[]
  readonly sheet: readonly ArsenalSheetRow[]
  readonly noise: readonly ArsenalNoiseRow[]
  readonly explosives: readonly ArsenalExplosiveRow[]
}

const toMetres = (millimetres: number | undefined): number | undefined => (millimetres === undefined ? undefined : millimetres / 1000)

export const parseReload = (text: string): ArsenalReload => {
  const seconds = numberBefore(text, 's')
  if (/por cartucho/.test(text) || /cada$/.test(text)) return { perRound: seconds, isOneByOne: true }
  const empty = /\/\s*(\S+) s vazio/.exec(text)
  if (empty) return { reload: seconds, reloadEmpty: parseNumber(empty[1] ?? ''), isOneByOne: false }
  return { reload: seconds, isOneByOne: /^1 a 1/.test(text) }
}

const catalogRow = (cells: string[]): ArsenalCatalogRow => ({
  name: cells[0] ?? '',
  caliber: cells[1] ?? '',
  capacity: cells[2] ?? '',
  cadence: cells[3] ?? '',
  reload: parseReload(cells[4] ?? ''),
  loadedMass: numberBefore(cells[5] ?? '', 'kg') ?? 0,
})

const sheetRow = (cells: string[]): ArsenalSheetRow => {
  const lengthCell = cells[2] ?? ''
  const isRange = /–/.test(lengthCell)
  const lengths = lengthCell.replace(/mm/g, '').split(/[/–]/).map(parseNumber)
  const precision = cells[6] ?? ''
  return {
    name: cells[0] ?? '',
    length: toMetres(isRange ? undefined : lengths[0]),
    lengthRange: isRange ? [(lengths[0] ?? 0) / 1000, (lengths[1] ?? 0) / 1000] : undefined,
    lengthCollapsed: toMetres(isRange ? undefined : lengths[1]),
    barrel: (numberBefore(cells[3] ?? '', 'mm') ?? 0) / 1000,
    emptyMass: numberBefore(cells[4] ?? '', 'kg') ?? 0,
    muzzleSpeed: numberBefore(cells[5] ?? '', 'm/s'),
    moa: numberBefore(precision, 'MOA'),
    patternCm: numberBefore(precision, 'cm'),
  }
}

const explosiveRow = (cells: string[]): ArsenalExplosiveRow => {
  const level = /nível (\d)/.exec(cells[4] ?? '')
  const lethal = cells[2] ?? ''
  return {
    name: cells[0] ?? '',
    lethalRadius: /^\d+ m$/.test(lethal) ? numberBefore(lethal, 'm') : undefined,
    injuryRadius: /^\d+ m$/.test(cells[3] ?? '') ? numberBefore(cells[3] ?? '', 'm') : undefined,
    destructionLevel: level ? Number(level[1]) : 0,
    noise: numberBefore(cells[5] ?? '', 'm') ?? 0,
  }
}

const isDataRow = (cells: string[], columns: number): boolean => cells.length === columns

/** The `<b>Name</b>: effect` lines of the cards of §11. */
export const parseAccessories = (html: string): ArsenalAccessoryRow[] => {
  const section = /<section id="mods">([\s\S]*?)<\/section>/.exec(html)
  if (!section) throw new Error('weapons-catalog: Arsenal section 11 (mods) not found')
  const rows: ArsenalAccessoryRow[] = []
  for (const card of (section[1] ?? '').matchAll(/<div class="card"><h4>(.*?)<\/h4>([\s\S]*?)<\/div>/g)) {
    for (const line of (card[2] ?? '').matchAll(/<p><b>(.*?)<\/b>[^:<]*:\s*([\s\S]*?)<\/p>/g)) {
      rows.push({ group: cellText(card[1] ?? ''), name: cellText(line[1] ?? ''), effect: cellText(line[2] ?? '') })
    }
  }
  return rows
}

export const extractArsenal = (): ArsenalData => {
  const html = readFileSync(SOURCE_PATHS.arsenal, 'utf8')
  const dataRows = (code: string, columns: number): string[][] =>
    sectionRows(html, code).filter((cells) => isDataRow(cells, columns) && cells[0] !== 'Arma' && cells[0] !== 'Fonte' && cells[0] !== 'Explosivo')
  return {
    accessories: parseAccessories(html),
    catalog: dataRows('06', 8).map(catalogRow),
    sheet: dataRows('07', 7).map(sheetRow),
    noise: dataRows('12', 3).map((cells) => ({ source: cells[0] ?? '', radius: numberBefore(cells[1] ?? '', 'm') ?? 0 })),
    explosives: dataRows('13', 8).map(explosiveRow),
  }
}
