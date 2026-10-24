import type { CaliberRecord } from './build-calibers'
import type { GalleryWeaponRow } from './extract-gallery'
import { catalogRowOf, recoilOf, reloadOf, sheetRowOf } from './weapon-context'
import type { ArchetypeRecord, WeaponContext } from './weapon-context'
import { GALLERY_CATEGORIES, archetypeOf, isManualAction, magazineOf, makerOf, modesOf, rateOf, reloadFamilyOf, slugOf } from './weapon-rules'

export type WeaponRecord = Readonly<Record<string, unknown>> & { readonly id: string }

export type FirearmSpec = {
  readonly row: GalleryWeaponRow
  readonly id: string
  readonly name: string
  readonly caliberId: string
  /** Key of the Arsenal rows (and of the sibling timing in the decisions) when it differs from the gallery name. */
  readonly timingKey?: string
  readonly variantOf?: string
  /** The Arsenal speed is for another calibre of the same weapon. */
  readonly skipSheetSpeed?: boolean
  /** Rounds in the magazine of this variant (the gallery row describes the base weapon). */
  readonly magazineCount?: number
  /** A weapon with no Arsenal row: the weapon whose reload times it takes, and the numbers the row cannot carry. */
  readonly reloadFrom?: string
  readonly muzzleSpeed?: number
  readonly noise?: number
  readonly modes?: { readonly modes: readonly string[]; readonly burst?: number }
  readonly extras?: Readonly<Record<string, unknown>>
  readonly sources?: readonly string[]
}

const MM_PER_METRE = 1000

const copyFrom = (source: Readonly<Record<string, unknown>>, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]))

type TimingsResult = { readonly timings: Readonly<Record<string, number>>; readonly isPerRound: boolean; readonly isDerived: boolean }

const timingsOf = (spec: FirearmSpec, family: string, context: WeaponContext): TimingsResult => {
  const resolved = reloadOf(spec.reloadFrom ?? spec.timingKey ?? spec.row[0], context)
  const { reload } = resolved
  const isDerived = resolved.isDerived || spec.reloadFrom !== undefined
  const { decisions } = context
  const isRevolver = family === 'revolver'
  const isPerRound = !isRevolver && reload.perRound !== undefined
  const cycle = isManualAction(family) ? decisions.cycleSeconds.value[family] : undefined
  const timings: Record<string, number> = { draw: context.drawSeconds, reload: isPerRound ? (reload.perRound ?? 0) : (reload.reload ?? 0) }
  if (reload.reloadEmpty !== undefined) timings.reloadEmpty = reload.reloadEmpty
  if (isPerRound) timings.perRound = reload.perRound ?? 0
  if (isRevolver) timings.perRound = decisions.timings.oneByOne.value
  if (cycle !== undefined) timings.cycle = cycle
  timings.clear = decisions.timings.clear.value
  return { timings, isPerRound, isDerived }
}

export const buildFirearm = (spec: FirearmSpec, context: WeaponContext): WeaponRecord => {
  const { row, caliberId } = spec
  const { decisions } = context
  const catalog = catalogRowOf(row[0], context)
  const sheet = sheetRowOf(row[0], context)
  const family = reloadFamilyOf(row)
  const category = GALLERY_CATEGORIES[row[1]] ?? ''
  const archetypeId = archetypeOf(category, caliberId, family, decisions)
  const archetype = context.archetypes.get(archetypeId) as ArchetypeRecord
  const magazine = { ...magazineOf(row, catalog?.capacity, decisions), ...(spec.magazineCount === undefined ? {} : { magazine: spec.magazineCount }) }
  const { modes, burst } = spec.modes ?? modesOf(row, family, decisions)
  const { timings, isPerRound, isDerived } = timingsOf(spec, family, context)
  const emptyMass = row[6]
  const mass = catalog?.loadedMass ?? emptyMass
  const speed = spec.muzzleSpeed ?? (spec.skipSheetSpeed ? undefined : sheet?.muzzleSpeed)
  const recoil = recoilOf({ archetype, caliberId, speed, mass }, context)
  const accepts = decisions.acceptsCalibers[row[0]]?.value
  const faultFactor = row[8].rel
  const action: Record<string, unknown> = {
    kind: 'firearm',
    caliber: caliberId,
    rpm: rateOf(row, family, caliberId, category, decisions),
    modes,
    ...(burst === undefined ? {} : { burst }),
    magazine: magazine.magazine,
    ...(magazine.chamber === undefined ? {} : { chamber: magazine.chamber }),
    ...(magazine.magazineOptions === undefined ? {} : { magazineOptions: magazine.magazineOptions }),
    ...(magazine.tubes === undefined ? {} : { tubes: magazine.tubes }),
    reload: timings.reload,
    ...(isPerRound ? { perRound: true } : {}),
    ...(speed === undefined ? {} : { muzzleSpeed: speed }),
    ...(spec.noise === undefined ? {} : { noise: spec.noise }),
    ...(spec.extras ?? {}),
    ...copyFrom(archetype.action, ['spreadDeg', 'bloomDeg', 'recoveryDegPerS', 'pelletSpreadDeg']),
    recoil,
    range: archetype.action.range,
    family,
    timings,
    ...(typeof faultFactor === 'number' ? { faultFactor } : {}),
    ...(sheet?.moa === undefined ? {} : { moa: sheet.moa }),
    ...(sheet?.patternCm === undefined ? {} : { patternCm: sheet.patternCm }),
    ...(accepts === undefined ? {} : { acceptsCalibers: accepts }),
  }
  const maker = makerOf(row[0], decisions)
  const dimensions = { length: row[4] / MM_PER_METRE, barrel: row[5] / MM_PER_METRE, emptyMass, ...(sheet?.lengthCollapsed === undefined ? {} : { lengthCollapsed: sheet.lengthCollapsed }) }
  return {
    id: spec.id,
    name: spec.name,
    ...(maker === undefined ? {} : { maker }),
    category,
    action,
    mass,
    dimensions,
    archetype: archetypeId,
    ...(spec.variantOf === undefined ? {} : { variantOf: spec.variantOf }),
    sources: spec.sources ?? ['gallery', ...(catalog || sheet ? ['arsenal'] : []), 'sdk', ...(isDerived ? ['derived'] : [])],
  }
}

export const firearmId = (row: GalleryWeaponRow, context: WeaponContext): string => context.decisions.weaponIds[row[0]]?.value ?? slugOf(row[0])

export const caliberOf = (row: GalleryWeaponRow, context: WeaponContext): CaliberRecord => {
  const id = context.decisions.galleryCalibers[row[2]]?.value
  const caliber = id === undefined ? undefined : context.calibers.get(id)
  if (!caliber) throw new Error(`weapons-catalog: no calibre for "${row[2]}" (${row[0]})`)
  return caliber
}
