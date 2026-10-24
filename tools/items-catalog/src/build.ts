import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { buildAmmoBoxes } from './build-ammo-boxes'
import { buildContainers } from './build-containers'
import { buildGameSlice } from './build-game-slice'
import type { GeneratedFiles } from './build-game-slice'
import { buildHousePools } from './build-house-pools'
import { buildItems } from './build-items'
import { buildLocale } from './build-locale'
import { buildModels } from './build-models'
import { buildCategories, buildDepletion, buildMelee, buildPlaces, buildRarities, buildSpawn, buildStorage } from './build-tables'
import { buildUseEffects } from './build-use-effects'
import { buildIdIndex, resolveReference } from './item-ids'
import { MODELS_OUTPUT_PATH, outputPath } from './paths'
import { parseRecipe } from './parse-recipe'
import { loadSources } from './sources'

export type CatalogFiles = GeneratedFiles

const serialize = (data: unknown): string => `${JSON.stringify(data, null, 2)}\n`

export type BuildOptions = { readonly gameOutput?: string }

export const buildCatalog = ({ gameOutput }: BuildOptions = {}): CatalogFiles => {
  const sources = loadSources()
  const index = buildIdIndex(sources)
  const resolve = (reference: string): string => resolveReference(reference, index).id
  const { items, provenance } = buildItems(sources, resolve)
  const recipeContext = { decisions: sources.decisions, resolveItem: (reference: string) => resolveReference(reference, index) }
  const containers = buildContainers(sources)
  const files: CatalogFiles = {
    [outputPath('items')]: serialize(items),
    [outputPath('categories')]: serialize(buildCategories(sources)),
    [outputPath('places')]: serialize(buildPlaces(sources)),
    [outputPath('rarities')]: serialize(buildRarities(sources)),
    [outputPath('storage')]: serialize(buildStorage(sources)),
    [outputPath('recipes')]: serialize(sources.ite.receitas.map((recipe) => parseRecipe(recipe, recipeContext))),
    [outputPath('containers')]: serialize(containers),
    [outputPath('depletion')]: serialize(buildDepletion(sources)),
    [outputPath('spawn')]: serialize(buildSpawn(sources)),
    [outputPath('house-pools')]: serialize(buildHousePools(sources, resolve)),
    [outputPath('ammo-boxes')]: serialize(buildAmmoBoxes(sources)),
    [outputPath('use-effects')]: serialize(buildUseEffects(sources, resolve)),
    [outputPath('melee')]: serialize(buildMelee(sources, resolve)),
    [outputPath('provenance')]: serialize(provenance),
    [outputPath('locales/pt-BR')]: serialize(buildLocale(items, provenance, containers, sources)),
    [MODELS_OUTPUT_PATH]: serialize(buildModels(sources)),
  }
  return gameOutput ? { ...files, ...buildGameSlice(sources, gameOutput, resolve) } : files
}

export const writeCatalog = (files: CatalogFiles): void => {
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
