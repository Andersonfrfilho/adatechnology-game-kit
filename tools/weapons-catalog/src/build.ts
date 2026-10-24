import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { buildAttachments } from './build-attachments'
import { buildCalibers } from './build-calibers'
import { buildCreations } from './build-creations'
import type { CaliberRecord } from './build-calibers'
import { buildExplosives } from './build-explosives'
import { buildFirearm, caliberOf, firearmId } from './build-firearms'
import type { WeaponRecord } from './build-firearms'
import { buildFlamethrower, buildGrenadeLauncher, buildRocketLauncher, buildUnderbarrelLauncher } from './build-launchers'
import { buildMounts } from './build-mounts'
import { buildModels } from './build-models'
import { loadDecisions } from './decisions'
import type { Decisions } from './decisions'
import type { ModelRecord } from './build-models'
import { extractArsenal } from './extract-arsenal'
import { extractGallery } from './extract-gallery'
import { extractGame } from './extract-game'
import { extractLab } from './extract-lab'
import { ARCHETYPES_PATH, OUTPUT_PATHS, SDK_CALIBERS_PATH } from './paths'
import type { ArchetypeRecord, WeaponContext } from './weapon-context'

/** Generated files by absolute path, each with its exact content. */
export type CatalogFiles = Readonly<Record<string, string>>

const serialize = (data: unknown): string => `${JSON.stringify(data, null, 2)}\n`

const readJson = <TValue>(path: string): TValue => JSON.parse(readFileSync(path, 'utf8')) as TValue

const assertUniqueIds = (records: readonly { readonly id: string }[]): void => {
  const seen = new Set<string>()
  for (const { id } of records) {
    if (seen.has(id)) throw new Error(`weapons-catalog: duplicate weapon id "${id}"`)
    seen.add(id)
  }
}

type Dimensions = Readonly<Record<string, unknown>>

/** The firearm with its places, what it carries, its stock and, when the Arsenal sheet has none, the length with the stock in. A weapon with no Gallery model (the M79) has none. */
const withMounts = (firearm: WeaponRecord, models: Readonly<Record<string, ModelRecord>>, decisions: Decisions): WeaponRecord => {
  const model = models[firearm.id]
  if (!model) return firearm
  const { mounts, fitted, stock, lengthCollapsed } = buildMounts(firearm, model, decisions)
  const dimensions = firearm.dimensions as Dimensions | undefined
  const hasCollapsed = dimensions?.lengthCollapsed !== undefined
  return {
    ...firearm,
    ...(lengthCollapsed === undefined || hasCollapsed || !dimensions ? {} : { dimensions: { ...dimensions, lengthCollapsed } }),
    mounts,
    fitted,
    ...(stock ? { stock } : {}),
  }
}

export const buildCatalog = (): CatalogFiles => {
  const decisions = loadDecisions()
  const gallery = extractGallery()
  const arsenal = extractArsenal()
  const lab = extractLab()
  const game = extractGame()
  const calibers = buildCalibers(readJson<CaliberRecord[]>(SDK_CALIBERS_PATH), gallery.ammo, decisions)
  const explosives = buildExplosives({ arsenal: arsenal.explosives, lab, game: game.explosives, decisions })
  const archetypes = readJson<ArchetypeRecord[]>(ARCHETYPES_PATH)
  const context: WeaponContext = {
    arsenal,
    calibers: new Map(calibers.map((caliber) => [caliber.id, caliber])),
    archetypes: new Map(archetypes.map((archetype) => [archetype.id, archetype])),
    decisions,
    drawSeconds: game.drawSeconds,
  }
  const firearmRows = gallery.weapons.filter((row) => row[7] !== 'launcher')
  const launcherRows = gallery.weapons.filter((row) => row[7] === 'launcher')
  const firearms: WeaponRecord[] = firearmRows.map((row) =>
    buildFirearm({ row, id: firearmId(row, context), name: decisions.englishNames[row[0]]?.value ?? row[0], caliberId: caliberOf(row, context).id }, context),
  )
  const variants = Object.entries(decisions.variants).map(([key, decision]) => {
    const row = firearmRows.find((candidate) => candidate[0] === decision.value.of)
    if (!row) throw new Error(`weapons-catalog: variant "${key}" is of unknown weapon "${decision.value.of}"`)
    return buildFirearm(
      { row, id: decision.value.id, name: decision.value.name, caliberId: decision.value.caliber, timingKey: key, variantOf: firearmId(row, context), skipSheetSpeed: true, magazineCount: decision.value.capacity },
      context,
    )
  })
  const launchers = launcherRows.map((row) => (row[8].lt === 'flame' || row[8].lt === 'flameDIY' ? buildFlamethrower(row, context) : buildRocketLauncher(row, context)))
  const creations = buildCreations(gallery.weapons, context)
  const allFirearms = [...firearms, ...variants, buildGrenadeLauncher(context), ...creations.map((created) => created.firearm)]
  const underbarrel = Object.values(decisions.underbarrelLaunchers).map((decision) => buildUnderbarrelLauncher(decision.value, context))
  assertUniqueIds([...archetypes, ...allFirearms, ...launchers, ...underbarrel])
  const variantNames = new Map(Object.values(decisions.variants).map((decision) => [decision.value.id, decision.value.of]))
  const models = {
    ...buildModels({ rows: gallery.weapons, variantIds: variantNames, firearms: allFirearms }, context),
    ...Object.fromEntries(creations.map((created) => [created.firearm.id, created.model])),
  }
  const mountedFirearms = allFirearms.map((firearm) => withMounts(firearm, models, decisions))
  return {
    [OUTPUT_PATHS.calibers]: serialize(calibers),
    [OUTPUT_PATHS.firearms]: serialize(mountedFirearms),
    [OUTPUT_PATHS.launchers]: serialize([...launchers, ...underbarrel]),
    [OUTPUT_PATHS.explosives]: serialize(explosives),
    [OUTPUT_PATHS.models]: serialize(models),
    [OUTPUT_PATHS.attachments]: serialize(buildAttachments(arsenal.accessories, decisions)),
  }
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
