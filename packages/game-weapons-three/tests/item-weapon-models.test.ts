import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { kitOriginOf } from '@adatechnology/game-contracts'
import { buildItemWeaponModel, buildWeaponModel, hasWeaponModel, itemModelOfWeapon, registerWeaponItemModel } from '../src'

// the melee weapons and tools the gallery did not model come from the team's item models (Itens do Vale Cinzento), never from boxes
const FROM_ITEMS = ['baseball_bat', 'axe', 'machete', 'knife', 'hammer', 'sledgehammer', 'crowbar', 'crossbow', 'wrench', 'extinguisher', 'blowtorch']

const size = (object: THREE.Object3D): THREE.Vector3 => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3())

describe('weapons drawn with the item models', () => {
  it('finds the item model of each weapon the gallery did not draw', () => {
    for (const id of FROM_ITEMS) {
      expect(hasWeaponModel(id)).toBe(false)
      expect(itemModelOfWeapon(id)).toBeDefined()
    }
    expect(itemModelOfWeapon('wrench')).toBe('adjustable_wrench')
    expect(itemModelOfWeapon('frag_grenade')).toBeUndefined()
  })

  it('lays the model along x, flat, on the floor, marked as a weapon of the kit, with a handle', () => {
    for (const id of FROM_ITEMS) {
      const model = buildItemWeaponModel(THREE, { id })!
      const s = size(model)
      // the crossbow is turned a quarter: its stock (shorter than the limbs) goes along x
      if (id !== 'crossbow') expect(s.x).toBeGreaterThanOrEqual(s.z - 1e-6)
      expect(s.z).toBeGreaterThanOrEqual(s.y - 1e-6)
      expect(new THREE.Box3().setFromObject(model).min.y).toBeCloseTo(0, 5)
      expect(kitOriginOf(model)).toMatchObject({ owner: 'game-weapons-three', kind: 'weapon', id })
      expect(model.getObjectByName('handle')!.position.x).toBeLessThan(0)
    }
  })

  it('puts the head of a bat at +x, away from the handle', () => {
    const bat = buildItemWeaponModel(THREE, { id: 'baseball_bat' })!
    expect(size(bat).x).toBeCloseTo(0.86, 1)
    const box = new THREE.Box3()
    const point = new THREE.Vector3()
    bat.updateMatrixWorld(true)
    let headWidth = 0
    let gripWidth = 0
    bat.traverse((node) => {
      const mesh = node as THREE.Mesh
      if (!mesh.isMesh) return
      const position = mesh.geometry.getAttribute('position')
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld)
        box.expandByPoint(point)
        if (point.x > 0.3) headWidth = Math.max(headWidth, Math.abs(point.z))
        if (point.x < -0.3) gripWidth = Math.max(gripWidth, Math.abs(point.z))
      }
    })
    expect(headWidth).toBeGreaterThan(gripWidth)
  })

  it('draws the hands and the counters with the item model, and the box prop only when there is none', () => {
    expect(buildWeaponModel(THREE, { id: 'axe', category: 'melee_blade', mass: 1.5 }).getObjectByName('handle')).toBeDefined()
    expect(kitOriginOf(buildWeaponModel(THREE, { id: 'axe', category: 'melee_blade', mass: 1.5 }))?.id).toBe('axe')
    registerWeaponItemModel('axe', null)
    try {
      expect(itemModelOfWeapon('axe')).toBeUndefined()
      expect(buildItemWeaponModel(THREE, { id: 'axe' })).toBeUndefined()
    } finally {
      registerWeaponItemModel('axe', {})
    }
    expect(itemModelOfWeapon('axe')).toBe('axe')
  })
})
