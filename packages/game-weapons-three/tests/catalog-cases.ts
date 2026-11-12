import { createArsenal } from '@adatechnology/game-weapons'
import * as THREE from 'three'
import { ARCHETYPE_MODELS, ATTACHMENT_MODELS, MODEL_ENTRIES, buildProp, buildWeaponModelById, fitAttachmentModels, mountFrame, weaponProp } from '../src'
import { buildCartridge, cartridgeShape } from '../src/models/cartridge'
import { modelKit } from '../src/models/kit'

/** The pieces of the catalog every catalog test walks (exact golden, z-fighting): built from the package's own lists, so a new piece is in them. */
const arsenal = createArsenal({ rules: { faults: false } })
const catalogue = arsenal.attachments
const kit = modelKit(THREE)
const HOSTS = ['colt_m4a1', 'ak_74', 'hk_mp5a3', 'fn_minimi', 'barrett_mrad', 'glock_17', 'remington_870', 'm134', 'steyr_aug_a1']

export type Case = [string, () => THREE.Object3D]
export const cases: Case[] = []
for (const id of [...Object.keys(MODEL_ENTRIES), ...Object.keys(ARCHETYPE_MODELS)]) cases.push([`model/${id}`, () => buildWeaponModelById(THREE, id)!.root])
for (const def of arsenal.weapons.values()) {
  if (!def.fitted?.length || !(def.id in MODEL_ENTRIES)) continue
  cases.push([
    `fitted/${def.id}`,
    () => {
      const model = buildWeaponModelById(THREE, def.id)!
      fitAttachmentModels(model, [...(def.fitted ?? [])], kit, { catalogue })
      return model.root
    },
  ])
}
for (const attachment of Object.keys(ATTACHMENT_MODELS)) {
  const att = catalogue.get(attachment)
  if (!att) continue
  for (const host of HOSTS) {
    const model = buildWeaponModelById(THREE, host)!
    const mount = att.mounts.find((m) => mountFrame(model, m))
    if (!mount) continue
    const drawn = fitAttachmentModels(model, [{ id: attachment, mount }], kit, { catalogue }).drawn
    if (!drawn.includes(attachment)) continue
    cases.push([
      `attachment/${attachment}@${host}:${mount}`,
      () => {
        const fresh = buildWeaponModelById(THREE, host)!
        fitAttachmentModels(fresh, [{ id: attachment, mount }], kit, { catalogue })
        return fresh.root
      },
    ])
    break
  }
}
for (const caliber of arsenal.calibers.values()) {
  if (!caliber.cartridge) continue
  cases.push([`cartridge/${caliber.id}`, () => buildCartridge(kit, caliber.cartridge!, cartridgeShape(caliber, caliber.cartridge!))])
}
for (const def of arsenal.weapons.values()) cases.push([`prop/${def.id}`, () => buildProp(THREE, weaponProp(def))])
