import type { AttachmentDef, AttachmentInstall, FittedAttachment, MountDef, MountKind } from './attachment-types'
import type { CaliberDef, WeaponDef } from './types'

export type FitRefusal = 'no_mount' | 'interface' | 'caliber' | 'category' | 'occupied' | 'blocked' | 'rejected'

export type CanFit = { readonly ok: true; readonly mount: MountKind } | { readonly ok: false; readonly reason: FitRefusal }

/** What a game adds to the rule: false keeps the accessory off the weapon whatever the mounts say. */
export type IsCompatible = (def: WeaponDef, attachment: AttachmentDef, fitted: readonly FittedAttachment[]) => boolean

export interface CanFitContext {
  readonly caliber: CaliberDef | null
  readonly catalogue: ReadonlyMap<string, AttachmentDef>
  readonly isCompatible?: IsCompatible
}

const INSTALL_RANK: Readonly<Record<AttachmentInstall, number>> = { field: 0, tool: 1, bench: 2 }

/** Whether what is at hand (`field`: the hands, `tool`: a tool, `bench`: a bench) is enough to put the accessory on or take it off. */
export const canInstallWith = (available: AttachmentInstall, needed: AttachmentInstall): boolean => INSTALL_RANK[available] >= INSTALL_RANK[needed]

const muzzleEnergyOf = (def: WeaponDef, caliber: CaliberDef): number => {
  const speed = def.action.kind === 'firearm' ? def.action.muzzleSpeed ?? caliber.muzzleSpeed * (def.action.barrel ?? 1) : caliber.muzzleSpeed
  return 0.5 * (caliber.bulletGrams / 1000) * speed * speed
}

const caliberRefusal = (def: WeaponDef, attachment: AttachmentDef, caliber: CaliberDef | null): boolean => {
  const limit = attachment.calibers
  if (!limit) return false
  if (!caliber) return true
  if (limit.ids && !limit.ids.includes(caliber.id)) return true
  if (limit.maxDiameter !== undefined && caliber.diameter > limit.maxDiameter) return true
  return limit.maxEnergy !== undefined && muzzleEnergyOf(def, caliber) > limit.maxEnergy
}

const candidatesOf = (def: WeaponDef, attachment: AttachmentDef, mount?: MountKind): MountDef[] =>
  (def.mounts ?? []).filter((place) => attachment.mounts.includes(place.kind) && (mount === undefined || place.kind === mount))

const isBlocked = (place: MountKind, attachment: AttachmentDef, fitted: readonly FittedAttachment[], catalogue: ReadonlyMap<string, AttachmentDef>): boolean => {
  if (fitted.some((part) => catalogue.get(part.id)?.blocks?.includes(place))) return true
  return fitted.some((part) => attachment.blocks?.includes(part.mount))
}

/**
 * Whether the accessory goes on the weapon, and where. Order of the checks: a place of its kind (`no_mount`), an interface the place takes
 * (`interface`), the calibre limits of a suppressor (`caliber`), the weapon categories (`category`), the place being free (`occupied`),
 * something else covering it (`blocked`), then the game's own `isCompatible` (`rejected`).
 */
export const canFit = (def: WeaponDef, attachment: AttachmentDef, fitted: readonly FittedAttachment[], context: CanFitContext, mount?: MountKind): CanFit => {
  const places = candidatesOf(def, attachment, mount)
  if (places.length === 0) return { ok: false, reason: 'no_mount' }
  const matching = places.filter((place) => place.interfaces.some((name) => attachment.interfaces.includes(name)))
  if (matching.length === 0) return { ok: false, reason: 'interface' }
  if (caliberRefusal(def, attachment, context.caliber)) return { ok: false, reason: 'caliber' }
  if (attachment.categories && !attachment.categories.includes(def.category)) return { ok: false, reason: 'category' }
  const free = matching.filter((place) => !fitted.some((part) => part.mount === place.kind))
  if (free.length === 0) return { ok: false, reason: 'occupied' }
  const open = free.filter((place) => !isBlocked(place.kind, attachment, fitted, context.catalogue))
  const place = open[0]
  if (!place) return { ok: false, reason: 'blocked' }
  if (context.isCompatible && !context.isCompatible(def, attachment, fitted)) return { ok: false, reason: 'rejected' }
  return { ok: true, mount: place.kind }
}
