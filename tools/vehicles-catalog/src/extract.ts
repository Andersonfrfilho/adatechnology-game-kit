import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { extractLiteral } from '@adatechnology/golden-tool/cut-source'

import { GARAGE_ARTIFACT_DIR, GARAGE_ARTIFACT_PAGE, SOURCE_PATHS } from './paths'

/** One entry of the page's `DIMS`: length, width and height of the vehicle in the Frota Leve output frame, in metres. */
export type PageDims = { readonly k: string; readonly L: number; readonly W: number; readonly H: number }
export type PaletteEntry = readonly [string, number]

export type LightFleetData = {
  readonly dims: readonly PageDims[]
  readonly palette: readonly PaletteEntry[]
  readonly militaryPalette: readonly PaletteEntry[]
}

/** The data of the Frota Leve that is not code: `DIMS` (FL 14171), `PALETA` and `PALETA_MIL` (FL 14172-14176). */
export const extractLightFleet = (): LightFleetData => {
  const source = readFileSync(SOURCE_PATHS.lightFleet, 'utf8')
  return {
    dims: extractLiteral<PageDims[]>(source, 'DIMS'),
    palette: extractLiteral<PaletteEntry[]>(source, 'PALETA'),
    militaryPalette: extractLiteral<PaletteEntry[]>(source, 'PALETA_MIL'),
  }
}

/** A design card of the Frota document (`fleet` array, FROTA 8-1806). `s` = speed, acceleration, handling, toughness, load, consumption (0-10). */
export type FleetCard = {
  readonly g: string
  readonly n: string
  readonly c: string
  readonly d: string
  readonly insp: string
  readonly s: readonly number[]
  readonly r: number
  readonly seats: string
  readonly tank: string
  readonly eff: string
  readonly fuel: string
  readonly auto: string
  readonly vmax: number
  readonly tags: readonly string[]
}

export const extractCards = (): FleetCard[] => extractLiteral<FleetCard[]>(readFileSync(SOURCE_PATHS.fleetCards, 'utf8'), 'fleet')

export type PageRegister = { readonly key: string; readonly name: string; readonly file: string }

/** Every `ZG.register({ k, grp, n })` of the Garagem artifact's fleet files: the page key and the display name that ties a card to its vehicle. */
export const extractRegisters = (): PageRegister[] => {
  const dir = join(GARAGE_ARTIFACT_DIR, 'zombiada', 'frota')
  const found: PageRegister[] = []
  for (const file of readdirSync(dir).sort()) {
    const text = readFileSync(join(dir, file), 'utf8')
    for (const match of text.matchAll(/ZG\.register\(\{\s*k:\s*"([^"]+)",\s*grp:\s*(?:"[^"]+"|[A-Za-z_]+),\s*n:\s*"([^"]+)"/g)) {
      found.push({ key: match[1] as string, name: match[2] as string, file })
    }
  }
  return found
}

export type PageScript = { readonly path: string; readonly code: string }

/** The scripts of the Garagem artifact in the order its page loads them (the app, which needs the DOM, is left out). */
export const garageArtifactScripts = (): PageScript[] => {
  const html = readFileSync(GARAGE_ARTIFACT_PAGE, 'utf8')
  const paths = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1] as string).filter((path) => !path.startsWith('http') && !path.endsWith('app.js'))
  return paths.map((path) => ({ path, code: readFileSync(join(GARAGE_ARTIFACT_DIR, path), 'utf8') }))
}

/** The same scripts as the site v4 page carries them (`sources/veiculos__garagem.js`, scripts 2-13; 0 is three, 1 the SDK, 14 the app). */
export const garageSiteScripts = (): PageScript[] => {
  const source = readFileSync(SOURCE_PATHS.garage, 'utf8')
  const parts = source.split(/\n\/\/ ===== script (\d+) \(\d+ KB\)\n/)
  const scripts: PageScript[] = []
  for (let index = 1; index < parts.length; index += 2) {
    const number = Number(parts[index])
    if (number >= 1 && number <= 13) scripts.push({ path: `script ${number}`, code: parts[index + 1] as string })
  }
  return scripts
}
