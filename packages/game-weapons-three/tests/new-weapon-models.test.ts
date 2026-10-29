import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { snapshotScene } from '@adatechnology/golden-tool'
import { createToolClipPlayer } from '@adatechnology/game-contracts'
import type { AnimationPose } from '@adatechnology/game-contracts'
import { createArsenal } from '@adatechnology/game-weapons'
import { MODEL_ENTRIES, buildWeaponModelById } from '../src/models'
import { buildToolClips } from '../src/animation/clip-set'
import { asGalleryNode } from './support/gallery-node'

// The weapons T1.7.5 added have no team page, so no page golden: this is the kit's own. Each model is built and hashed node by node; a change of a builder shows in the diff
// of the fixture. Meant change: `UPDATE_GOLDEN=1 pnpm --filter @adatechnology/game-weapons-three test`, then read the diff.
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/own-golden/new-weapon-models.json')
const NEW_WEAPONS = [
  'hk_mp5sd3', 'fn_parafal', 'taurus_t4_civil', 'taurus_th380', 'mossberg_500_cruiser', 'hk_mp5k', 'hk_ump9', 'mini_uzi', 'hk_mp7a1', 'hk_g36', 'hk_g36k', 'hk_g36c',
  'fn_m249', 'fn_minimi_para', 'fn_mag', 'rpk', 'sig_mpx', 'mg3', 'pp19_bizon', 'vz61', 'm134',
] as const

type Recorded = Record<string, { hash: string; objects: number }>

const hashOf = (id: string): { hash: string; objects: number } => {
  const model = buildWeaponModelById(THREE, id)
  if (!model) throw new Error(`no model for ${id}`)
  const { hash, objects } = snapshotScene(asGalleryNode(model.root), { ignoreNames: true })
  return { hash, objects }
}

const current: Recorded = Object.fromEntries(NEW_WEAPONS.map((id) => [id, hashOf(id)]))
if (process.env.UPDATE_GOLDEN === '1' || !existsSync(FIXTURE)) {
  mkdirSync(dirname(FIXTURE), { recursive: true })
  writeFileSync(FIXTURE, `${JSON.stringify(current, null, 1)}\n`)
}
const recorded = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Recorded

const arsenal = createArsenal({ rules: { faults: false } })

describe('models of the weapons T1.7.5 added: the kit\'s own golden', () => {
  it('has a model entry for each, built by the builder of its weapon', () => {
    for (const id of NEW_WEAPONS) expect(MODEL_ENTRIES[id], id).toBeDefined()
    expect(MODEL_ENTRIES.m134?.builder).toBe('m134')
    expect(MODEL_ENTRIES.pp19_bizon).toMatchObject({ builder: 'rifle', options: { mag: 'helical' } })
    expect(MODEL_ENTRIES.fn_m249?.variantOf).toBe('fn_minimi')
  })

  for (const id of NEW_WEAPONS) {
    it(`${id} is built as recorded`, () => {
      expect(hashOf(id)).toEqual(recorded[id])
    })
  }

  it('records the 21 models and nothing else', () => {
    expect(Object.keys(recorded)).toEqual([...NEW_WEAPONS])
  })

  it('fits every model to the real length of its weapon', () => {
    for (const id of NEW_WEAPONS) {
      const model = buildWeaponModelById(THREE, id)
      const box = new THREE.Box3().setFromObject(model?.root as THREE.Object3D)
      expect(box.max.x - box.min.x, id).toBeCloseTo((MODEL_ENTRIES[id]?.length ?? 0) / 1000, 3)
    }
  })
})

describe('the M134: six barrels that turn while it fires', () => {
  it('has one pivot with the six barrels and their clamps, on the family of belt-fed guns', () => {
    const model = buildWeaponModelById(THREE, 'm134')
    expect(model?.parts.family).toBe('belt')
    const barrels = model?.parts.barrels
    expect(barrels).toBeDefined()
    let meshes = 0
    barrels?.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes += 1
    })
    expect(meshes).toBeGreaterThanOrEqual(6)
    expect(model?.parts.belt && model.parts.cover && model.parts.muzzle).toBeTruthy()
  })

  it('turns a sixth of a turn with each shot clip, and no other weapon turns anything', () => {
    const turned = (id: string): number => {
      const model = buildWeaponModelById(THREE, id)
      const def = arsenal.weapons.get(id)
      if (!model || def?.action.kind !== 'firearm') throw new Error(`no model or firearm ${id}`)
      const clips = buildToolClips({ parts: model.parts, family: model.parts.family, caseType: arsenal.calibers.get(def.action.caliber)?.caseType ?? 'rifle', reloadFamily: def.action.family })
      const poses: AnimationPose[] = []
      const player = createToolClipPlayer({ clips, rig: { setPartPose: (part, pose) => part === 'barrels' && poses.push(pose) } })
      player.apply({ type: 'play', clip: 'shot', duration: clips.shot?.duration ?? 0.2 })
      for (let frame = 0; frame < 20; frame++) player.update(0.02)
      return poses.at(-1)?.rotation?.[0] ?? 0
    }
    expect(turned('m134')).toBeCloseTo(Math.PI / 3, 5)
    expect(turned('browning_m2')).toBe(0)
    expect(turned('fn_mag')).toBe(0)
  })
})

describe('the Bizon: the helical magazine under the barrel', () => {
  it('sits along the barrel, below it, and is the part that drops on reload', () => {
    const model = buildWeaponModelById(THREE, 'pp19_bizon')
    const magazine = model?.parts.mag
    const muzzle = model?.parts.muzzle
    expect(magazine).toBeDefined()
    expect(magazine?.position.y).toBeLessThan(muzzle?.position.y ?? 0)
    expect(magazine?.position.x).toBeGreaterThan((muzzle?.position.x ?? 0) * 0.3)
    expect(magazine?.position.x).toBeLessThan(muzzle?.position.x ?? 0)
    expect(model?.parts.magDrop).toBeGreaterThan(0)
  })
})
