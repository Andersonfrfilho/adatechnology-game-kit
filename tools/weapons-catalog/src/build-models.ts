import type { WeaponRecord } from './build-firearms'
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

type ModelInputs = {
  readonly rows: readonly GalleryWeaponRow[]
  readonly variantIds: ReadonlyMap<string, string>
  readonly firearms: readonly WeaponRecord[]
}

type MagazineAction = { readonly magazine?: number; readonly chamber?: number }

/** A revolver draws as many chambers as the weapon holds (owner decision); the default count stays out of the options. */
const optionsOf = (row: GalleryWeaponRow, id: string, inputs: ModelInputs, context: WeaponContext): Readonly<Record<string, unknown>> => {
  if (row[7] !== 'revolver') return row[8]
  const action = inputs.firearms.find((firearm) => firearm.id === id)?.action as MagazineAction | undefined
  const capacity = (action?.magazine ?? 0) + (action?.chamber ?? 0)
  return capacity > 0 && capacity !== context.decisions.modelChambers.value.default ? { ...row[8], chambers: capacity } : row[8]
}

/** What the Gallery needs to model a weapon: the builder and its options, verbatim (plus the chamber count of a revolver), keyed by weapon id. */
export const buildModels = (inputs: ModelInputs, context: WeaponContext): Record<string, ModelRecord> => {
  const { rows, variantIds } = inputs
  const models: Record<string, ModelRecord> = {}
  const idOf = (row: GalleryWeaponRow): string => context.decisions.weaponIds[row[0]]?.value ?? slugOf(row[0])
  for (const row of rows) {
    models[idOf(row)] = { builder: row[7], caliber: row[2], length: row[4], barrel: row[5], options: optionsOf(row, idOf(row), inputs, context) }
  }
  for (const [variantId, baseName] of variantIds) {
    const base = rows.find((row) => row[0] === baseName)
    if (base) models[variantId] = { builder: base[7], caliber: base[2], length: base[4], barrel: base[5], options: optionsOf(base, idOf(base), inputs, context), variantOf: idOf(base) }
  }
  return models
}
