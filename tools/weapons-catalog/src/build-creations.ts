import { buildFirearm, firearmId } from './build-firearms'
import type { FirearmSpec, WeaponRecord } from './build-firearms'
import type { ModelRecord } from './build-models'
import type { NewWeaponDecision } from './decisions'
import type { GalleryOptions, GalleryWeaponRow } from './extract-gallery'
import { sheetRowOf } from './weapon-context'
import type { WeaponContext } from './weapon-context'

export type CreatedWeapon = { readonly firearm: WeaponRecord; readonly model: ModelRecord }

const DEFAULT_BUILDER = 'rifle'

const rowOf = (name: string, decision: NewWeaponDecision, galleryRows: readonly GalleryWeaponRow[]): GalleryWeaponRow => {
  const base = decision.of === undefined ? undefined : galleryRows.find((row) => row[0] === decision.of)
  if (decision.of !== undefined && !base) throw new Error(`weapons-catalog: creation "${name}" starts from unknown weapon "${decision.of}"`)
  const category = decision.category ?? base?.[1]
  if (category === undefined) throw new Error(`weapons-catalog: creation "${name}" has no category`)
  const options: GalleryOptions = { ...(base?.[8] ?? {}), ...decision.options }
  return [name, category, decision.caliberText, decision.capacity, decision.length, decision.barrel, decision.emptyMass, decision.builder ?? base?.[7] ?? DEFAULT_BUILDER, options]
}

const extrasOf = (decision: NewWeaponDecision): Record<string, unknown> => ({
  ...(decision.spin === undefined ? {} : { spin: decision.spin }),
  ...(decision.rpmRange === undefined ? {} : { rpmRange: decision.rpmRange }),
})

/** The Arsenal speed of the weapon it starts from, when both fire the same calibre and the decision gives none of its own. */
const inheritedSpeed = (decision: NewWeaponDecision, baseRow: GalleryWeaponRow | undefined, context: WeaponContext): number | undefined => {
  if (decision.muzzleSpeed !== undefined || baseRow === undefined) return undefined
  if (context.decisions.galleryCalibers[baseRow[2]]?.value !== decision.caliber) return undefined
  return sheetRowOf(baseRow[0], context)?.muzzleSpeed
}

const spec = (name: string, decision: NewWeaponDecision, row: GalleryWeaponRow, baseId: string | undefined, inherited: number | undefined): FirearmSpec => {
  const sources = [...new Set(Object.values(decision.numbers).map((note) => (note.source === 'owner' ? 'derived' : note.source)))]
  return {
    row,
    id: decision.id,
    name: decision.name,
    caliberId: decision.caliber,
    reloadFrom: decision.reloadFrom,
    skipSheetSpeed: true,
    sources: [...sources, 'sdk'],
    ...(baseId === undefined ? {} : { variantOf: baseId }),
    ...(decision.muzzleSpeed === undefined && inherited === undefined ? {} : { muzzleSpeed: decision.muzzleSpeed ?? inherited }),
    ...(decision.noise === undefined ? {} : { noise: decision.noise }),
    ...(decision.modes === undefined ? {} : { modes: decision.modes }),
    ...(Object.keys(extrasOf(decision)).length === 0 ? {} : { extras: extrasOf(decision) }),
  }
}

/** The weapons of `decisions.creations`: their firearm record and their Gallery-style model entry, in the order of the decisions. */
export const buildCreations = (galleryRows: readonly GalleryWeaponRow[], context: WeaponContext): CreatedWeapon[] =>
  Object.entries(context.decisions.creations).map(([name, { value }]) => {
    const row = rowOf(name, value, galleryRows)
    const baseRow = value.of === undefined ? undefined : galleryRows.find((candidate) => candidate[0] === value.of)
    const baseId = baseRow === undefined ? undefined : firearmId(baseRow, context)
    const firearm = buildFirearm(spec(name, value, row, baseId, inheritedSpeed(value, baseRow, context)), context)
    const model: ModelRecord = { builder: row[7], caliber: row[2], length: row[4], barrel: row[5], options: row[8], ...(baseId === undefined ? {} : { variantOf: baseId }) }
    return { firearm, model }
  })
