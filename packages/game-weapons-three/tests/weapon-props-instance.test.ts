import { itemModels } from '@adatechnology/game-items-three'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { buildItemWeaponModel, buildWeaponModel, createWeaponProps, defaultWeaponProps, itemModelOfWeapon, registerWeaponItemModel } from '../src'

const box = (object: THREE.Object3D): number[] => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).toArray()

describe('weapon props by instance', () => {
  it('a set with the shipped overrides draws exactly what the global functions draw', () => {
    const made = createWeaponProps()
    for (const id of ['knife', 'crossbow', 'wrench', 'extinguisher', 'baseball_bat', 'axe']) {
      expect(made.itemModelOf(id, itemModels)).toBe(itemModelOfWeapon(id, itemModels))
      expect(box(made.buildItemModel(THREE, { id }, itemModels)!)).toEqual(box(buildItemWeaponModel(THREE, { id }, itemModels)!))
    }
    expect(box(made.buildModel(THREE, { id: 'knife', category: 'melee_blade', mass: 0.3 }, itemModels))).toEqual(box(buildWeaponModel(THREE, { id: 'knife', category: 'melee_blade', mass: 0.3 }, itemModels)))
  })

  it('two sets with different packs, patches and removals do not leak into each other or into the global functions', () => {
    const first = createWeaponProps({ packs: [{ axe: { item: 'hammer' }, baseball_bat: null }], patch: { knife: { turn: 1 } }, remove: ['wrench'] })
    const second = createWeaponProps()
    expect(first.itemModelOf('axe', itemModels)).toBe('hammer')
    expect(second.itemModelOf('axe', itemModels)).toBe('axe')
    expect(first.itemModelOf('baseball_bat', itemModels)).toBeUndefined()
    expect(second.itemModelOf('baseball_bat', itemModels)).toBe('baseball_bat')
    expect(first.get('knife')).toEqual({ flip: true, turn: 1 })
    expect(second.get('knife')).toEqual({ flip: true })
    expect(first.itemModelOf('wrench', itemModels)).toBeUndefined()
    expect(second.itemModelOf('wrench', itemModels)).toBe('adjustable_wrench')
    expect(itemModelOfWeapon('axe', itemModels)).toBe('axe')
    first.register('hammer', { turn: 2 })
    expect(second.get('hammer')).toBeUndefined()
    expect(defaultWeaponProps().get('hammer')).toBeUndefined()
    registerWeaponItemModel('compat_only', { turn: 3 })
    expect(first.get('compat_only')).toBeUndefined()
    expect(createWeaponProps().get('compat_only')).toBeUndefined()
  })
})
