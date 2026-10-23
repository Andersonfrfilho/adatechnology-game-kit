import type { Decisions } from './decisions'
import type { GalleryAmmoRow } from './extract-gallery'

export type CaliberRecord = Readonly<Record<string, unknown>> & { readonly id: string }

const cartridgeOf = (row: GalleryAmmoRow, projectileDiameter: number): Record<string, number> => ({
  caseDiameter: row[1],
  overallLength: row[2],
  caseLength: row[3],
  projectileDiameter,
})

const assertSameDiameter = (id: string, record: Readonly<Record<string, unknown>>, row: GalleryAmmoRow, hasDecision: boolean): void => {
  if (record.caseType === 'shell' || hasDecision || record.diameter === row[4]) return
  throw new Error(`weapons-catalog: calibre ${id} has diameter ${String(record.diameter)} but the Gallery says ${row[4]} (record the deviation in decisions.json)`)
}

/** The calibres in the order of `decisions.calibers`: the frozen SDK ones with noise and cartridge added, and the new ones from the decisions. */
export const buildCalibers = (
  sdkCalibers: readonly CaliberRecord[],
  ammo: readonly GalleryAmmoRow[],
  decisions: Decisions,
): CaliberRecord[] => {
  const sdkById = new Map(sdkCalibers.map((caliber) => [caliber.id, caliber]))
  const ammoByName = new Map(ammo.map((row) => [row[0], row]))
  return Object.entries(decisions.calibers).map(([id, decision]) => {
    const ammoName = decision.ammoRow?.value ?? null
    const ammoRow = ammoName === null ? undefined : ammoByName.get(ammoName)
    if (ammoName !== null && !ammoRow) throw new Error(`weapons-catalog: Gallery has no AMMO row "${ammoName}" for ${id}`)
    const sdk = sdkById.get(id)
    if (!sdk && !decision.base) throw new Error(`weapons-catalog: calibre ${id} is neither in the SDK nor in the decisions`)
    const base = decision.base?.value
    const merged: Record<string, unknown> = sdk
      ? { ...sdk }
      : {
          id,
          label: base?.label,
          diameter: base?.diameter ?? ammoRow?.[4],
          bulletGrams: base?.bulletGrams,
          muzzleSpeed: base?.muzzleSpeed,
          dragPer100m: base?.dragPer100m,
          kind: base?.kind,
        }
    const caseType = decision.caseType?.value
    const record: Record<string, unknown> = { ...merged, noise: decision.noise.value }
    if (caseType) record.caseType = caseType
    if (decision.rim) record.rim = decision.rim.value
    if (ammoRow) {
      assertSameDiameter(id, { ...record, caseType }, ammoRow, decision.diameter !== undefined)
      record.cartridge = cartridgeOf(ammoRow, decision.diameter ? decision.diameter.value : ammoRow[4])
    } else if (decision.cartridge) record.cartridge = decision.cartridge.value
    record.sources = decision.sources.value
    return record as CaliberRecord
  })
}
