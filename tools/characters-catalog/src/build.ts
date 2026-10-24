import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { buildAppearance, buildBody, buildGait, buildPhysical, buildSegments, buildTeamGame } from './build-characters'
import { buildAccessories, buildAgePresets, buildAppearance as buildPeopleAppearance, buildProfessions } from './build-people'
import type { PeopleInputs } from './build-people'
import { buildSlice } from './build-slice'
import { buildAges, buildInfection, buildMoments, buildOutfits, buildTypes } from './build-undead'
import type { CatalogInputs } from './build-undead'
import { loadDecisions } from './decisions'
import { extractArsenalBody } from './extract-arsenal-body'
import { extractBench } from './extract-bench'
import { extractBestiary } from './extract-bestiary'
import { extractElenco } from './extract-elenco'
import { extractGame } from './extract-game'
import { extractLiving, extractPortraits } from './extract-living'
import { extractAccessories, extractPeopleBodies } from './extract-people'
import { GAME_SLICE_DIR, OUTPUT_PATHS } from './paths'

/** Generated files by absolute path, each with its exact content. */
export type CatalogFiles = Readonly<Record<string, string>>

const serialize = (data: unknown): string => `${JSON.stringify(data, null, 2)}\n`

export const buildInputs = (): CatalogInputs => ({
  game: extractGame(),
  bestiary: extractBestiary(),
  elenco: extractElenco(),
  bench: extractBench(),
  decisions: loadDecisions(),
})

export const buildPeopleInputs = (inputs: CatalogInputs): PeopleInputs => ({
  elenco: inputs.elenco,
  bodies: extractPeopleBodies(),
  accessories: extractAccessories(),
  decisions: inputs.decisions,
})

export const buildCatalog = (): CatalogFiles => {
  const inputs = buildInputs()
  const people = buildPeopleInputs(inputs)
  const arsenal = extractArsenalBody()
  return {
    [OUTPUT_PATHS.undeadTypes]: serialize(buildTypes(inputs)),
    [OUTPUT_PATHS.undeadAges]: serialize(buildAges(inputs)),
    [OUTPUT_PATHS.undeadOutfits]: serialize(buildOutfits(inputs)),
    [OUTPUT_PATHS.undeadInfection]: serialize(buildInfection(inputs)),
    [OUTPUT_PATHS.undeadMoments]: serialize(buildMoments(inputs)),
    [OUTPUT_PATHS.peopleProfessions]: serialize(buildProfessions(people)),
    [OUTPUT_PATHS.peopleAges]: serialize(buildAgePresets(people)),
    [OUTPUT_PATHS.peopleAppearance]: serialize(buildPeopleAppearance(people)),
    [OUTPUT_PATHS.peopleAccessories]: serialize(buildAccessories(people)),
    [OUTPUT_PATHS.presetTeamGame]: serialize(buildTeamGame(inputs)),
    [OUTPUT_PATHS.presetPhysical]: serialize(buildPhysical(inputs)),
    [OUTPUT_PATHS.body]: serialize(buildBody(inputs)),
    [OUTPUT_PATHS.segments]: serialize(buildSegments(inputs, arsenal)),
    [OUTPUT_PATHS.gait]: serialize(buildGait(inputs)),
    [OUTPUT_PATHS.appearance]: serialize(buildAppearance(inputs)),
  }
}

export const buildGameSlice = (): CatalogFiles => {
  const inputs = buildInputs()
  const files = buildSlice({ game: inputs.game, living: extractLiving(), portraits: extractPortraits(), arsenal: extractArsenalBody(), decisions: inputs.decisions })
  return Object.fromEntries(Object.entries(files).map(([name, content]) => [join(GAME_SLICE_DIR, name), content]))
}

export const writeFiles = (files: CatalogFiles): void => {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
}

/** Paths whose file on disk differs from what the sources generate now. */
export const staleFiles = (files: CatalogFiles): string[] =>
  Object.entries(files)
    .filter(([path, content]) => {
      try {
        return readFileSync(path, 'utf8') !== content
      } catch {
        return true
      }
    })
    .map(([path]) => path)
