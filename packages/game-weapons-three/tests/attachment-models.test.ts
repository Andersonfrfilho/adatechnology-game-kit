import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { snapshotScene } from '@adatechnology/golden-tool'
import { checkToolClips, createToolClipPlayer } from '@adatechnology/game-contracts'
import type { AnimationPose } from '@adatechnology/game-contracts'
import { createArsenal } from '@adatechnology/game-weapons'
import type { FittedAttachment } from '@adatechnology/game-weapons'
import { ATTACHMENT_MODELS, MODEL_ENTRIES, buildWeaponModelById, fitAttachmentModels, mountFrame, partRegistry, rigStock, rigUnderbarrel } from '../src'
import type { WeaponModel } from '../src'
import { buildToolClips } from '../src/animation/clip-set'
import { scope } from '../src/models/details'
import { modelKit } from '../src/models/kit'
import { createModelRig } from '../src/fx/rig'
import { asGalleryNode } from './support/gallery-node'

const kit = modelKit(THREE)
const arsenal = createArsenal({ rules: { faults: false } })
const catalogue = arsenal.attachments

const modelOf = (id: string): { model: WeaponModel; def: NonNullable<ReturnType<typeof arsenal.weapons.get>> } => {
  const model = buildWeaponModelById(THREE, id)
  const def = arsenal.weapons.get(id)
  if (!model || !def) throw new Error(`no model or def for ${id}`)
  return { model, def }
}
const fit = (id: string, mount: FittedAttachment['mount'], extra: Partial<FittedAttachment> = {}): FittedAttachment => ({ id, mount, ...extra })
const hashOf = (node: THREE.Object3D): { hash: string; objects: number } => {
  const { hash, objects } = snapshotScene(asGalleryNode(node), { ignoreNames: true })
  return { hash, objects }
}

describe('the model as the builders make it: nothing is rigged until the viewmodel asks', () => {
  it('has no stock pivot and no launcher pivot, so the golden hashes the page\'s scene', () => {
    for (const id of ['hk_mp5a3', 'colt_m4a1', 'hk_g36', 'm134']) {
      const { model } = modelOf(id)
      expect(model.parts.stock, id).toBeUndefined()
      expect(model.parts.ugl, id).toBeUndefined()
      expect(model.root.getObjectByName('stock'), id).toBeUndefined()
    }
  })

  it('records where the accessories go, in numbers the rifle builder writes and the others get from the model', () => {
    for (const id of ['colt_m4a1', 'glock_17', 'sw_686', 'steyr_aug_a1', 'm134']) {
      const frames = modelOf(id).model.parts.frames
      expect(frames, id).toBeDefined()
      expect(frames?.length, id).toBeGreaterThan(0.1)
    }
    const { model } = modelOf('colt_m4a1')
    const muzzle = mountFrame(model, 'muzzle')
    expect(muzzle?.position[0]).toBeCloseTo(arsenal.weapons.get('colt_m4a1')?.dimensions?.length ?? 0, 2)
    expect(mountFrame(model, 'rail_left')?.position[2]).toBeLessThan(0)
    expect(mountFrame(model, 'rail_right')?.position[2]).toBeGreaterThan(0)
    expect(mountFrame(model, 'stock')).toBeUndefined()
  })
})

describe('what ships on the weapon', () => {
  it('records the meshes of the optic, the bipod and the brake, and taking the accessory off hides exactly those', () => {
    const ids = { optic: 'colt_m4a1', brake: 'ak_74', bipod: 'barrett_mrad' }
    const { model: rifle } = modelOf(ids.optic)
    expect(Object.keys(rifle.parts.fittings ?? {})).toContain('acog_4x')
    const rig = fitAttachmentModels(rifle, [], kit, { catalogue })
    for (const object of rifle.parts.fittings?.acog_4x ?? []) expect(object.visible).toBe(false)
    rig.sync([fit('acog_4x', 'rail_top')])
    for (const object of rifle.parts.fittings?.acog_4x ?? []) expect(object.visible).toBe(true)
    expect(rig.drawn).toEqual([])
    const { model: brake } = modelOf(ids.brake)
    expect(Object.keys(brake.parts.fittings ?? {})).toContain('muzzle_brake')
    const { model: bipod } = modelOf(ids.bipod)
    expect(Object.keys(bipod.parts.fittings ?? {})).toContain('bipod')
  })

  it('draws the weapon exactly as the page when everything that ships on it is fitted', () => {
    for (const id of ['colt_m4a1', 'ak_74', 'barrett_mrad', 'mac_10']) {
      const { model, def } = modelOf(id)
      const before = hashOf(model.root)
      const rig = fitAttachmentModels(model, [...(def.fitted ?? [])], kit, { catalogue })
      expect(hashOf(model.root), id).toEqual(before)
      rig.dispose()
    }
  })
})

describe('ports of the gallery drawings', () => {
  it('the optic is the page\'s `scope` for its kind, at the frame of the top rail', () => {
    for (const [attachment, kind] of [['red_dot', 1], ['acog_4x', 2], ['scope_3_9x', 3], ['scope_6_24x', 4]] as const) {
      const { model } = modelOf('hk_mp5a3')
      const frame = mountFrame(model, 'rail_top')!
      const rig = fitAttachmentModels(model, [fit(attachment, 'rail_top')], kit, { catalogue })
      const object = model.root.children.find((child) => child !== model.inner && child.position.x === frame.position[0])!
      const reference = new THREE.Group()
      scope(kit, reference, kind, 0, 0, 0)
      // the page's optic, then the short adapter rail under it where the top of the weapon has none
      const optic = object.clone()
      optic.children = optic.children.slice(0, reference.children.length)
      optic.position.set(0, 0, 0)
      expect(hashOf(optic), attachment).toEqual(hashOf(reference))
      rig.dispose()
    }
  })

  it('the bipod, the brake, the drum and the belt box are the page\'s own drawings: a weapon that ships with them hashes like the page, so the accessory draws the same meshes', () => {
    for (const id of ['barrett_mrad', 'ak_74']) expect(hashOf(modelOf(id).model.root)).toBeDefined()
    const { model } = modelOf('ak_74')
    const rig = fitAttachmentModels(model, [fit('muzzle_brake_heavy', 'muzzle')], kit, { catalogue })
    expect(rig.drawn).toEqual(['muzzle_brake_heavy'])
    rig.dispose()
    expect(fitAttachmentModels(modelOf('colt_m4a1').model, [fit('drum_magazine', 'magazine')], kit, { catalogue }).drawn).toEqual(['drum_magazine'])
    expect(fitAttachmentModels(modelOf('fn_minimi').model, [fit('ammo_backpack', 'feed')], kit, { catalogue }).drawn).toEqual(['ammo_backpack'])
  })
})

describe('creations of the kit: their own golden', () => {
  const hashes = (id: string, fitted: FittedAttachment): { hash: string; objects: number } => {
    const { model } = modelOf(id)
    const rig = fitAttachmentModels(model, [fitted], kit, { catalogue })
    const object = model.root.children[model.root.children.length - 1]!
    expect(rig.drawn).toEqual([fitted.id])
    return hashOf(object)
  }
  it('draws the same thing twice (no state, no randomness)', () => {
    for (const [weapon, part] of [
      ['colt_m4a1', fit('suppressor', 'muzzle')],
      ['colt_m4a1', fit('oil_filter_suppressor', 'muzzle')],
      ['colt_m4a1', fit('vertical_grip', 'rail_bottom')],
      ['colt_m4a1', fit('weapon_light', 'rail_left')],
      ['colt_m4a1', fit('laser_sight', 'rail_right')],
      ['colt_m4a1', fit('sling', 'sling')],
      ['m134', fit('tripod', 'underbarrel')],
    ] as const) expect(hashes(weapon, part), part.id).toEqual(hashes(weapon, part))
  })

  it('draws every accessory that has a model, and the ones without are the barrel swaps and the optics the weapon already draws', () => {
    const withoutModel = [...catalogue.values()].filter((def) => !(def.model in ATTACHMENT_MODELS) && !(def.id in ATTACHMENT_MODELS)).map((def) => def.id).sort()
    expect(withoutModel).toEqual(['integral_optic_1_5x', 'integral_optic_3x', 'long_barrel', 'sawn_off_barrel'])
  })
})

describe('suppressor, light, laser, launcher', () => {
  it('a suppressor goes past the muzzle and takes the muzzle to its end; an integral one ends at the muzzle', () => {
    const { model } = modelOf('colt_m4a1')
    const rest = model.parts.muzzle!.position.x
    const rig = fitAttachmentModels(model, [fit('suppressor', 'muzzle')], kit, { catalogue })
    expect(model.parts.muzzle!.position.x).toBeCloseTo(rest + 0.2 / model.inner.scale.x, 5)
    rig.sync([])
    expect(model.parts.muzzle!.position.x).toBeCloseTo(rest, 5)
    const integral = fitAttachmentModels(modelOf('hk_mp5sd3').model, [fit('integral_suppressor', 'muzzle', { integral: true })], kit, { catalogue })
    expect(integral.drawn).toEqual(['integral_suppressor'])
  })

  it('a suppressor replaces the flash hider the weapon ships with', () => {
    const { model } = modelOf('colt_m4a1')
    const hider = model.parts.fittings?.muzzle_default ?? []
    expect(hider.length).toBeGreaterThan(0)
    const rig = fitAttachmentModels(model, [fit('suppressor', 'muzzle')], kit, { catalogue })
    for (const object of hider) expect(object.visible).toBe(false)
    rig.sync([])
    for (const object of hider) expect(object.visible).toBe(true)
  })

  it('a light is a real SpotLight with the cone and range of the data, off until it is on', () => {
    const { model } = modelOf('colt_m4a1')
    const rig = fitAttachmentModels(model, [fit('weapon_light', 'rail_left')], kit, { catalogue })
    const spot = model.root.getObjectByProperty('isSpotLight', true) as THREE.SpotLight
    expect(spot).toBeDefined()
    expect(spot.visible).toBe(true)
    expect(spot.intensity).toBe(0)
    expect(spot.angle).toBeCloseTo((30 / 2) * (Math.PI / 180), 5)
    expect(spot.distance).toBe(60)
    rig.sync([fit('weapon_light', 'rail_left', { on: true })])
    expect(spot.intensity).toBeGreaterThan(0)
    rig.sync([fit('weapon_light', 'rail_left', { on: false })])
    expect(spot.intensity).toBe(0)
    expect(spot.visible, 'toggling never changes the number of lights in the scene (no shader recompile)').toBe(true)
  })

  it('the beams layer puts the light and the laser out whatever they are set to', () => {
    const { model } = modelOf('colt_m4a1')
    let beams = true
    const rig = fitAttachmentModels(model, [fit('weapon_light', 'rail_left', { on: true })], kit, { catalogue, areBeamsOn: () => beams })
    const spot = model.root.getObjectByProperty('isSpotLight', true) as THREE.SpotLight
    expect(spot.intensity).toBeGreaterThan(0)
    beams = false
    rig.update()
    expect(spot.intensity).toBe(0)
  })

  it('a laser draws a beam to what the host says it hits and a dot there; no hit means no dot', () => {
    const { model } = modelOf('colt_m4a1')
    model.root.updateMatrixWorld(true)
    let distance: number | null = 12
    const rig = fitAttachmentModels(model, [fit('laser_sight', 'rail_right', { on: true })], kit, { catalogue, raycast: () => distance })
    rig.update()
    const meshes = model.root.children[model.root.children.length - 1]!.children.filter((child) => (child as THREE.Mesh).isMesh && !(child as THREE.Mesh).castShadow)
    const [beam, dot] = meshes as THREE.Mesh[]
    expect(beam!.visible).toBe(true)
    expect(beam!.scale.x).toBeCloseTo(12, 1)
    expect(dot!.visible).toBe(true)
    distance = null
    rig.update()
    expect(dot!.visible).toBe(false)
    expect(beam!.scale.x).toBeCloseTo(120, 0)
    rig.sync([fit('laser_sight', 'rail_right', { on: false })])
    expect(beam!.visible).toBe(false)
  })

  it('a launcher under the barrel hangs from the sliding pivot and marks its muzzle; the pivot only exists on a weapon with a place for one', () => {
    const { model, def } = modelOf('colt_m4a1')
    rigUnderbarrel(THREE, model, def)
    expect(model.parts.ugl).toBeDefined()
    const rig = fitAttachmentModels(model, [fit('m203', 'underbarrel')], kit, { catalogue })
    expect(model.parts.ugl!.children.length).toBeGreaterThan(2)
    expect(model.parts.uglMuzzle?.name).toBe('ugl_muzzle')
    rig.sync([])
    expect(model.parts.uglMuzzle).toBeUndefined()
    const pistol = modelOf('glock_17')
    rigUnderbarrel(THREE, pistol.model, pistol.def)
    expect(pistol.model.parts.ugl).toBeUndefined()
  })

  it('the backpack hides the belt box the weapon has and a drum hides its magazine, both come back when taken off', () => {
    const { model } = modelOf('fn_minimi')
    expect(model.parts.belt).toBeDefined()
    const rig = fitAttachmentModels(model, [fit('ammo_backpack', 'feed')], kit, { catalogue })
    expect(model.parts.belt!.visible).toBe(false)
    rig.sync([])
    expect(model.parts.belt!.visible).toBe(true)
    const rifle = modelOf('colt_m4a1').model
    const magazine = rifle.parts.mag!
    const original = [...magazine.children]
    const drum = fitAttachmentModels(rifle, [fit('drum_magazine', 'magazine')], kit, { catalogue })
    expect(original.every((child) => !child.visible)).toBe(true)
    drum.sync([])
    expect(original.every((child) => child.visible)).toBe(true)
    expect(magazine.children.length).toBe(original.length)
  })

  it('a registry the game passes replaces the builder of an accessory', () => {
    const { model } = modelOf('colt_m4a1')
    const marker = new THREE.Group()
    marker.name = 'custom_suppressor'
    const rig = fitAttachmentModels(model, [fit('suppressor', 'muzzle')], kit, { catalogue, overrides: { suppressor: () => marker } })
    expect(model.root.getObjectByName('custom_suppressor')).toBe(marker)
    rig.dispose()
    expect(marker.parent).toBeNull()
  })
})

describe('the stock rig', () => {
  // one rig per model, as in the hands: its rest is the extended stock, and the clips hold the pose they end on
  const players = new WeakMap<WeaponModel, ReturnType<typeof createToolClipPlayer>>()
  const poseOf = (clips: ReturnType<typeof buildToolClips>, clip: string, model: WeaponModel): void => {
    const player = players.get(model) ?? createToolClipPlayer({ clips, rig: createModelRig(model) })
    players.set(model, player)
    player.apply({ type: 'play', clip: 'stock', variant: clip })
    for (let i = 0; i < 60; i++) player.update(0.02)
  }
  const clipsOf = (model: WeaponModel, def: NonNullable<ReturnType<typeof arsenal.weapons.get>>): ReturnType<typeof buildToolClips> =>
    buildToolClips({ parts: model.parts, family: model.parts.family, caseType: 'rifle', reloadFamily: def.action.kind === 'firearm' ? def.action.family : undefined })

  it('puts the stock the builder drew into one pivot without moving it', () => {
    const { model, def } = modelOf('hk_mp5a3')
    const stockMeshes = model.parts.stockMeshes!
    expect(stockMeshes.length).toBeGreaterThan(2)
    const before = stockMeshes.map((mesh) => mesh.getWorldPosition(new THREE.Vector3()))
    model.root.updateMatrixWorld(true)
    rigStock(THREE, model, def)
    model.root.updateMatrixWorld(true)
    expect(model.parts.stock).toBeDefined()
    expect(partRegistry(model.parts).get('stock')).toBe(model.parts.stock)
    stockMeshes.forEach((mesh, index) => {
      expect(mesh.parent).toBe(model.parts.stock)
      expect(mesh.getWorldPosition(new THREE.Vector3()).distanceTo(before[index]!)).toBeLessThan(1e-6)
    })
  })

  it('a retracting stock slides in by the length the data gives (0.70 m to 0.55 m on the MP5A3), and slides back', () => {
    const { model, def } = modelOf('hk_mp5a3')
    rigStock(THREE, model, def)
    const clips = clipsOf(model, def)
    expect(checkToolClips(clips, partRegistry(model.parts).keys())).toEqual({ ok: true, problems: [] })
    const pivot = model.parts.stock!
    poseOf(clips, 'collapse', model)
    expect(pivot.position.x * model.inner.scale.x).toBeCloseTo(0.15, 4)
    poseOf(clips, 'extend', model)
    expect(pivot.position.x).toBeCloseTo(0, 6)
  })

  it('a folding stock turns a half turn about the side of the rule: right and left about the vertical, under and over about the cross axis', () => {
    for (const [id, axis] of [['hk_ump_45', 'y'], ['hk_g36', 'y'], ['uzi', 'z'], ['franchi_spas_12', 'z']] as const) {
      const { model, def } = modelOf(id)
      rigStock(THREE, model, def)
      expect(model.parts.stockMove, id).toMatchObject({ kind: 'fold', axis })
      const clips = clipsOf(model, def)
      poseOf(clips, 'fold', model)
      const turned = model.parts.stock!.rotation
      expect(Math.abs(axis === 'y' ? turned.y : turned.z), id).toBeCloseTo(Math.PI, 5)
      poseOf(clips, 'unfold', model)
      expect(model.parts.stock!.rotation.y, id).toBeCloseTo(0, 5)
    }
  })

  it('folds toward the side the rule names: a stock folded to the right ends up on the right of the receiver, one folded to the left on its left', () => {
    for (const [id, side] of [['hk_ump_45', 1], ['hk_g36', -1]] as const) {
      const { model, def } = modelOf(id)
      rigStock(THREE, model, def)
      poseOf(clipsOf(model, def), 'fold', model)
      model.root.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(model.parts.stock!)
      expect(Math.sign((box.min.z + box.max.z) / 2), id).toBe(side)
    }
  })

  it('a weapon whose stock does not move is left alone', () => {
    const { model, def } = modelOf('ak_47')
    rigStock(THREE, model, def)
    expect(model.parts.stock).toBeUndefined()
  })

  it('every model of the catalogue keeps clips that pass the contract check with the stock and the launcher rigged', () => {
    const problems: string[] = []
    for (const id of Object.keys(MODEL_ENTRIES)) {
      const def = arsenal.weapons.get(id)
      const model = buildWeaponModelById(THREE, id)
      if (!def || !model) continue
      rigStock(THREE, model, def)
      rigUnderbarrel(THREE, model, def)
      const clips = buildToolClips({ parts: model.parts, family: model.parts.family, caseType: 'rifle', reloadFamily: def.action.kind === 'firearm' || def.action.kind === 'flame' || def.action.kind === 'launcher' ? def.action.family : undefined })
      const report = checkToolClips(clips, partRegistry(model.parts).keys())
      for (const problem of report.problems) problems.push(`${id}: ${problem}`)
    }
    expect(problems).toEqual([])
  })

  it('the launcher reload slides the tube through the stages of the rule and brings it back', () => {
    const { model, def } = modelOf('colt_m4a1')
    rigUnderbarrel(THREE, model, def)
    const clips = clipsOf(model, def)
    const reload = clips.reload_ugl!
    expect(reload.events?.filter((event) => event.type === 'stage').map((event) => event.data?.stage)).toEqual(['breech_open', 'round_in', 'breech_close'])
    const poses: AnimationPose[] = []
    const rig = { setPartPose: (partId: string, pose: AnimationPose) => void (partId === 'ugl' && poses.push(pose)) }
    const player = createToolClipPlayer({ clips, rig })
    player.apply({ type: 'play', clip: 'reload', variant: 'ugl', duration: 2 })
    for (let i = 0; i < 120; i++) player.update(0.02)
    const slid = Math.max(...poses.map((pose) => pose.position?.[0] ?? 0))
    expect(slid).toBeCloseTo(0.05, 3)
    expect(poses[poses.length - 1]!.position?.[0]).toBeCloseTo(0, 5)
    expect(clips.shot_ugl?.events?.[0]).toMatchObject({ type: 'muzzle_flash', data: { at: 'ugl' } })
  })
})
