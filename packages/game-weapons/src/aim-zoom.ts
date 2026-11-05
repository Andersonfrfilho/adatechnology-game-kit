import type { Arsenal, AttachmentId, WeaponId } from './types'

/**
 * How much the view closes in while a weapon aims: the magnification of the optic fitted on it (the lowest of a variable one, the AUG's integral 1.5x), else the iron-sight zoom
 * of its category (`rules.aim.ironSightZoom`); 1 for a weapon that does not aim (a knife, a grenade).
 */
export function aimZoomOf(arsenal: Arsenal, weaponId: WeaponId, attachments: readonly AttachmentId[] = arsenal.weapons.get(weaponId)?.fitted?.map((part) => part.id) ?? []): number {
  const def = arsenal.weapons.get(weaponId)
  if (!def) return 1
  const optic = attachments.map((id) => arsenal.attachments.get(id)?.optic).find((entry) => entry !== undefined)
  if (optic) return optic.zoom[0]
  return arsenal.rules.aim.ironSightZoom[def.category] ?? 1
}
