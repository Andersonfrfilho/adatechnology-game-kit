import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createArsenal } from '@adatechnology/game-weapons'
import { buildItemWeaponModel, buildThrowableModel, buildWeaponModelById } from '../src'
import { buildToolClips } from '../src/animation/clip-set'
import { holdOfModel } from '../src/fx/hand-hold'

const sizeOf = (object: THREE.Object3D): THREE.Vector3 => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3())

describe('the M32 (Milkor MGL) model', () => {
  const model = buildWeaponModelById(THREE, 'm32_mgl')!

  it('is 778 mm long, with a six-chamber cylinder that swings out, a pistol grip and a front grip', () => {
    expect(sizeOf(model.root).x).toBeCloseTo(0.778, 2)
    expect(model.parts.family).toBe('cylinder')
    expect(model.parts.chambers).toHaveLength(6)
    expect(model.parts.cylinder && model.parts.crane && model.parts.grip && model.parts.foreGrip && model.parts.muzzle && model.parts.hammer).toBeTruthy()
    expect(model.parts.stockMeshes?.length).toBeGreaterThan(0)
  })

  it('has the clips of a revolving weapon: a shot that turns the cylinder, a reload that opens the crane, a feed that puts a round in a chamber', () => {
    const clips = buildToolClips({ parts: model.parts, family: model.parts.family, caseType: 'big', reloadFamily: 'revolver' })
    expect(Object.keys(clips)).toEqual(expect.arrayContaining(['shot', 'reload', 'feed']))
    expect(JSON.stringify(clips.shot)).toContain('cylinder')
    expect(JSON.stringify(clips.reload)).toContain('crane')
  })

  it('puts the support hand on the front grip, ahead of the cylinder, and the shooting hand on the pistol grip behind it', () => {
    const hold = holdOfModel(THREE, model, 1)
    const right = hold.right!.offset
    const left = hold.left!.offset
    expect(right.x).toBeLessThan(0.4)
    expect(left.x).toBeGreaterThan(0.55)
    expect(left.x).toBeLessThan(0.7)
    expect(left.y).toBeLessThan(-0.05)
  })

  it('is a launcher of the arsenal that no other weapon shares the model with', () => {
    expect(createArsenal().weapons.get('m32_mgl')?.category).toBe('launcher')
  })
})

describe('the explosives the kit added', () => {
  it('draws the M18 canister 63 mm across and about 150 mm tall, standing on its base with the green band', () => {
    const model = buildThrowableModel(THREE, { action: { kind: 'throwable', explosive: 'smoke_grenade', energy: 0, radius: 0, fuse: 0, throwSpeed: 15, noise: 0 } })!
    const size = sizeOf(model)
    expect(size.x).toBeGreaterThan(0.06)
    expect(size.x).toBeLessThan(0.075)
    expect(size.y).toBeGreaterThan(0.14)
    expect(size.y).toBeLessThan(0.16)
    expect(model.getObjectByName('handle')).toBeDefined()
  })

  it('draws the Semtex as a block of 0.16 x 0.045 x 0.047 m (500 g at 1.5 g/cm3) with its detonator', () => {
    const model = buildThrowableModel(THREE, { action: { kind: 'throwable', explosive: 'semtex', energy: 0, radius: 0, fuse: 0, throwSpeed: 0, noise: 0 } })!
    const size = sizeOf(model)
    expect(size.x).toBeGreaterThan(0.15)
    expect(size.x).toBeLessThan(0.28)
    expect(size.z).toBeLessThan(0.06)
    expect(model.getObjectByName('handle')).toBeDefined()
  })
})

describe('the melee weapons the kit added: the item models, lent to the weapons', () => {
  const build = (id: string): THREE.Group => buildItemWeaponModel(THREE, { id })!

  it('lies the KA-BAR 302 mm long with the handle mark behind the middle, the same model as the item', () => {
    const model = build('kabar')
    expect(sizeOf(model).x).toBeCloseTo(0.302, 2)
    expect(model.getObjectByName('handle')!.position.x).toBeLessThan(0)
  })

  it('lies the katana 0.98 m long with a mark for each hand along the handle', () => {
    const model = build('katana')
    expect(sizeOf(model).x).toBeCloseTo(0.98, 2)
    const handle = model.getObjectByName('handle')!
    const support = model.getObjectByName('support')!
    expect(support.position.x).toBeLessThan(handle.position.x)
    expect(handle.position.x - support.position.x).toBeCloseTo(0.11, 3)
  })

  it('lies the brass knuckles 12 cm across the ring row', () => {
    const model = build('brass_knuckles')
    const size = sizeOf(model)
    expect(Math.max(size.x, size.z)).toBeCloseTo(0.12, 2)
  })
})
