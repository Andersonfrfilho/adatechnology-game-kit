import type { GalleryWeaponRow } from './extract-gallery'
import type { WeaponContext } from './weapon-context'
import { slugOf } from './weapon-rules'

export type ModelRecord = {
  readonly builder: string
  readonly caliber: string
  readonly length: number
  readonly barrel: number
  readonly options: Readonly<Record<string, unknown>>
  readonly variantOf?: string
}

/** What the Gallery needs to model a weapon: the builder and its options, verbatim, keyed by weapon id. */
export const buildModels = (rows: readonly GalleryWeaponRow[], variantIds: ReadonlyMap<string, string>, context: WeaponContext): Record<string, ModelRecord> => {
  const models: Record<string, ModelRecord> = {}
  const idOf = (row: GalleryWeaponRow): string => context.decisions.weaponIds[row[0]]?.value ?? slugOf(row[0])
  for (const row of rows) {
    models[idOf(row)] = { builder: row[7], caliber: row[2], length: row[4], barrel: row[5], options: row[8] }
  }
  for (const [variantId, baseName] of variantIds) {
    const base = rows.find((row) => row[0] === baseName)
    if (base) models[variantId] = { builder: base[7], caliber: base[2], length: base[4], barrel: base[5], options: base[8], variantOf: idOf(base) }
  }
  return models
}
