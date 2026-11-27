import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createPieceLift, heaviestMaterialOf, liveMassOf, specMassOf } from '../src/piece-lift'
import { createContentsHand, GRAB_REACH } from '../src/contents-take'

const boxPiece = (size: [number, number, number], mass: number) => {
  const root = new THREE.Group()
  root.add(new THREE.Mesh(new THREE.BoxGeometry(...size)))
  return { root, mass }
}

describe('the hands lift by mass and size', () => {
  const lift = createPieceLift(THREE, 60)

  it('a sofa (45 kg, 2 x 0.85 x 0.9 m) is too bulky to lift; the hands push it instead', () => {
    expect(lift.verdict(boxPiece([2, 0.85, 0.9], 45))).toBe('too_bulky')
    expect(lift.size.map((v) => Math.round(v * 100) / 100)).toEqual([2, 0.85, 0.9])
  })

  it('a gas bottle (16 kg) goes up; so does a book taken by hand off its shelf', () => {
    expect(lift.verdict(boxPiece([0.36, 0.58, 0.36], 16))).toBe('ok')
    expect(lift.verdict(boxPiece([2, 0.85, 0.9], 45), true)).toBe('ok')
  })

  it('the size is measured unrotated: a sofa on its side is the same sofa', () => {
    const sofa = boxPiece([2, 0.85, 0.9], 45)
    sofa.root.rotation.set(0, Math.PI / 2, Math.PI / 2)
    expect(lift.verdict(sofa)).toBe('too_bulky')
    expect(sofa.root.rotation.y).toBeCloseTo(Math.PI / 2)
  })

  it('mass from the material: volume times density; what is broken weighs nothing', () => {
    expect(specMassOf({ parts: [{ id: 'a', material: 'steel', shape: { kind: 'box', size: [1, 1, 0.01] }, position: [0, 0, 0] }] }, () => 7850)).toBeCloseTo(78.5)
    const parts = [
      { status: 'intact', mass: 30, material: 'fabric' },
      { status: 'broken', mass: 50, material: 'wood_hard' },
      { status: 'damaged', mass: 10, material: 'steel' },
    ]
    expect(liveMassOf(parts)).toBe(40)
    expect(heaviestMaterialOf(parts)).toBe('fabric')
  })
})

describe('E on a stack inside an open fridge takes it, not the door', () => {
  const fridge = (): { root: THREE.Group; carton: THREE.Mesh; shelf: THREE.Group } => {
    const root = new THREE.Group()
    const shelf = new THREE.Group()
    root.add(shelf)
    const carton = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.07))
    carton.position.set(0, 1, -0.2)
    carton.userData.contents = { item: 'milk_carton', qty: 1 }
    shelf.add(carton)
    return { root, carton, shelf }
  }

  const handWith = (root: THREE.Object3D, taken: Array<{ name: string; hands: number }>) =>
    createContentsHand({
      THREE,
      aim: () => ({ origin: [0, 1, 1], direction: [0, 0, -1] }),
      aimed: () => ({ objectId: 'fridge_1', root }),
      entryOf: (item) => (item === 'milk_carton' ? { id: 'item_milk_carton', name: 'Leite', physical: { weightKg: 1.05, size: [0.07, 0.2, 0.07] } } : undefined),
      taken: (item) => (taken.push({ name: item.name, hands: item.hands }), true),
    })

  it('the carton the aim lands on leaves the shelf and comes to one hand', () => {
    const { root, carton } = fridge()
    const taken: Array<{ name: string; hands: number }> = []
    expect(handWith(root, taken)()).toBe(true)
    expect(taken).toEqual([{ name: 'Leite', hands: 1 }])
    expect(carton.parent).toBeNull()
  })

  it('behind a shut door (the stack not drawn) there is nothing to take, and E works the door', () => {
    const { root, shelf } = fridge()
    shelf.visible = false
    const taken: Array<{ name: string; hands: number }> = []
    expect(handWith(root, taken)()).toBe(false)
    expect(taken).toEqual([])
  })

  it('out of reach is not taken', () => {
    const { root, carton } = fridge()
    carton.position.z = -GRAB_REACH - 1
    expect(handWith(root, [])()).toBe(false)
  })
})
