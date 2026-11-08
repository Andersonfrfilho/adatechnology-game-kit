import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { WEAPONS } from '@adatechnology/game-weapons'
import { buildWeaponModelById, hasWeaponModel } from '../src'

// the bore: what is drawn within this distance of the barrel's axis (the barrel and its muzzle device, not a magazine under it as the Bizon's), and how far the mark may sit from the front of it
const BORE_RADIUS = 0.018
const MAX_AHEAD = 0.02
const MAX_BEHIND = 0.005

/** The front of what is drawn around the barrel's axis through `mark` (x along the barrel, in the model's frame): the muzzle as the eye sees it. */
function boreFront(model: THREE.Object3D, mark: THREE.Vector3): number {
  const vertex = new THREE.Vector3()
  let front = -Infinity
  model.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    for (let node: THREE.Object3D | null = mesh; node && node !== model.parent; node = node.parent) if (!node.visible) return
    const position = mesh.geometry.getAttribute('position')
    for (let index = 0; index < position.count; index++) {
      vertex.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld)
      if (Math.hypot(vertex.y - mark.y, vertex.z - mark.z) <= BORE_RADIUS) front = Math.max(front, vertex.x)
    }
  })
  return front
}

const FIREARMS = WEAPONS.filter((def) => def.action.kind === 'firearm' && hasWeaponModel(def.id)).map((def) => def.id)

describe('every firearm marks the muzzle at the front of its barrel, where the flash, the smoke and the tracer leave', () => {
  it('draws a model for every firearm the arsenal registers', () => {
    expect(FIREARMS.length).toBeGreaterThan(100)
  })

  it.each(FIREARMS)('%s', (weapon) => {
    const model = buildWeaponModelById(THREE, weapon)
    expect(model, 'a firearm with a model builds it').toBeDefined()
    if (!model) return
    model.root.updateMatrixWorld(true)
    const mark = model.parts.muzzle
    expect(mark, 'every firearm has a muzzle mark (parts.muzzle) at the tip of its barrel').toBeDefined()
    if (!mark) return
    // in the model's own frame (the root unscaled): x from the butt to the muzzle
    const toModel = new THREE.Matrix4().copy(model.root.matrixWorld).invert()
    const at = mark.getWorldPosition(new THREE.Vector3()).applyMatrix4(toModel)
    const front = boreFront(model.root, mark.getWorldPosition(new THREE.Vector3())) - model.root.getWorldPosition(new THREE.Vector3()).x
    const scale = model.root.getWorldScale(new THREE.Vector3()).x
    const ahead = at.x - front / scale
    expect(Number.isFinite(ahead), 'something is drawn around the barrel at the mark').toBe(true)
    expect(ahead, `${weapon}: the mark is ${(ahead * 100).toFixed(1)} cm from the front of the barrel`).toBeLessThanOrEqual(MAX_AHEAD)
    expect(ahead, `${weapon}: the mark is ${(-ahead * 100).toFixed(1)} cm behind the front of the barrel`).toBeGreaterThanOrEqual(-MAX_BEHIND)
  })
})
