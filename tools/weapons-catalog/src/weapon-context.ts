import type { Decisions } from './decisions'
import type { ArsenalCatalogRow, ArsenalData, ArsenalReload, ArsenalSheetRow } from './extract-arsenal'
import type { CaliberRecord } from './build-calibers'

export type ArchetypeRecord = {
  readonly id: string
  readonly mass: number
  readonly action: Readonly<Record<string, unknown>>
} & Readonly<Record<string, unknown>>

export type WeaponContext = {
  readonly arsenal: ArsenalData
  readonly calibers: ReadonlyMap<string, CaliberRecord>
  readonly archetypes: ReadonlyMap<string, ArchetypeRecord>
  readonly decisions: Decisions
  readonly drawSeconds: number
}

export const catalogRowOf = (name: string, context: WeaponContext): ArsenalCatalogRow | undefined => {
  const arsenalName = context.decisions.arsenalCatalogNames[name]?.value ?? name
  return context.arsenal.catalog.find((row) => row.name === arsenalName)
}

export const sheetRowOf = (name: string, context: WeaponContext): ArsenalSheetRow | undefined => {
  const arsenalName = context.decisions.arsenalSheetNames[name]?.value ?? name
  return context.arsenal.sheet.find((row) => row.name === arsenalName)
}

export type ReloadResolution = { readonly reload: ArsenalReload; readonly isDerived: boolean }

/** Reload times of a weapon: its Arsenal row, or the row of the sibling named in the decisions (Q5). */
export const reloadOf = (timingKey: string, context: WeaponContext): ReloadResolution => {
  const direct = catalogRowOf(timingKey, context)
  if (direct) return { reload: direct.reload, isDerived: false }
  const sibling = context.decisions.siblingTimings[timingKey]?.value.siblingOf
  const siblingRow = sibling === undefined ? undefined : catalogRowOf(sibling, context)
  if (!siblingRow) throw new Error(`weapons-catalog: no reload time for "${timingKey}" (Arsenal row or sibling in decisions.json)`)
  return { reload: siblingRow.reload, isDerived: true }
}

const ROUNDING = 100
const round = (value: number): number => Math.round(value * ROUNDING) / ROUNDING

type MuzzleEnergyInput = { readonly caliberId: string; readonly speed?: number; readonly barrelFactor?: number }

const energyOf = ({ caliberId, speed, barrelFactor }: MuzzleEnergyInput, context: WeaponContext): number => {
  const caliber = context.calibers.get(caliberId)
  if (!caliber) throw new Error(`weapons-catalog: unknown calibre ${caliberId}`)
  const pellets = typeof caliber.pellets === 'number' ? caliber.pellets : 1
  const velocity = speed ?? Number(caliber.muzzleSpeed) * (barrelFactor ?? 1)
  return pellets * 0.5 * (Number(caliber.bulletGrams) / 1000) * velocity * velocity
}

export type RecoilInput = { readonly archetype: ArchetypeRecord; readonly caliberId: string; readonly speed?: number; readonly mass: number }

/** Arsenal §08: recoil follows the calibre energy over the weapon mass, scaled from the archetype's recoil. */
export const recoilOf = ({ archetype, caliberId, speed, mass }: RecoilInput, context: WeaponContext): [number, number] => {
  const base = archetype.action.recoil as [number, number]
  const archetypeCaliber = String(archetype.action.caliber)
  const archetypeEnergy = energyOf({ caliberId: archetypeCaliber, barrelFactor: Number(archetype.action.barrel ?? 1) }, context)
  const ratio = energyOf({ caliberId, speed }, context) / mass / (archetypeEnergy / archetype.mass)
  return [round(base[0] * ratio), round(base[1] * ratio)]
}
