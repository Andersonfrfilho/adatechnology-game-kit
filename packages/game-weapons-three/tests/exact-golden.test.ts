import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createArsenal } from '@adatechnology/game-weapons'
import { exactSnapshot, installPortableMath } from '@adatechnology/golden-tool'
import * as THREE from 'three'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ARCHETYPE_MODELS, ATTACHMENT_MODELS, MODEL_ENTRIES, buildProp, buildWeaponModelById, fitAttachmentModels, mountFrame, weaponProp } from '../src'
import { buildCartridge, cartridgeShape } from '../src/models/cartridge'
import { modelKit } from '../src/models/kit'

/**
 * Every bit of the gallery models (the brand weapons and the archetypes they lend a model to), of each weapon with what ships on it, of
 * each accessory on a weapon that takes it, of the cartridges and of the simple props: recorded on the old path (three's own geometry
 * constructors) before the move to game-shapes, so the move cannot change a byte. `UPDATE_EXACT=1` rewrites it.
 */
// happy-dom: import.meta.url is not a file, the fixture is found from the package folder
const FIXTURE = join(process.cwd(), 'tests/fixtures/exact-weapons.json')
// Math.pow changed its last bit between Node 22 and 24: the hashes here use the portable one, so both give the same bytes
let restoreMath: () => void = () => undefined
beforeAll(() => {
  restoreMath = installPortableMath()
})
afterAll(() => restoreMath())

const arsenal = createArsenal({ rules: { faults: false } })
const catalogue = arsenal.attachments
const kit = modelKit(THREE)
const HOSTS = ['colt_m4a1', 'ak_74', 'hk_mp5a3', 'fn_minimi', 'barrett_mrad', 'glock_17', 'remington_870', 'm134', 'steyr_aug_a1']

type Case = [string, () => THREE.Object3D]
const cases: Case[] = []
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

const recorded: Record<string, { hash: string; objects: number }> = (() => {
  try {
    return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  } catch {
    return {}
  }
})()

describe('the weapon models, bit for bit', () => {
  if (process.env.UPDATE_EXACT) {
    it('records the fixture', () => {
      // the hash and the object count only: a weapon has hundreds of meshes, a hash per object would make the fixture half a megabyte
      const out: Record<string, { hash: string; objects: number }> = {}
      for (const [id, build] of cases) {
        const { hash, nodes } = exactSnapshot(build())
        out[id] = { hash, objects: nodes.length }
      }
      writeFileSync(FIXTURE, JSON.stringify(out).replace(/},"/g, '},\n"') + '\n')
    }, 300000)
    return
  }
  it('has a recording of every case', () => {
    expect(Object.keys(recorded).sort()).toEqual(cases.map(([id]) => id).sort())
  })
  it.each(cases)('%s', (id, build) => {
    const snapshot = exactSnapshot(build())
    expect({ hash: snapshot.hash, objects: snapshot.nodes.length }).toEqual(recorded[id])
  })
})
