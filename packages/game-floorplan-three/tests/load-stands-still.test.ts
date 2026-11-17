import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { TEMPLATES, THREE, houseOf, planOf } from './helpers/houses'
import { physicsOption } from './setup-physics'

const DT = 1 / 30
const SETTLE_SECONDS = 3
/** Metres a part may move in the seconds after the load: nothing the house is made of falls or slides on its own. */
const STILL = 0.01

/** Where every mesh that draws a part of the house is in the world, by mesh. */
function posesOf(root: THREE.Object3D): Map<THREE.Object3D, THREE.Vector3> {
  root.updateMatrixWorld(true)
  const out = new Map<THREE.Object3D, THREE.Vector3>()
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.userData.destructionPart) out.set(o, new THREE.Vector3().setFromMatrixPosition(o.matrixWorld))
  })
  return out
}

// what is attached in the real world is attached in the destruction world: the doors and drawers on their hinges and slides, the gates on their posts, the
// wires on the poles, the lot's walls and the poles on their footings, the gas cylinder resting on the floor
describe('a house just loaded', () => {
  for (const template of Object.keys(TEMPLATES)) for (const seed of [1, 2]) {
    it(`${template}:${seed}: is one group, and ${SETTLE_SECONDS} s later no part of it has moved, broken or come loose`, () => {
      const world = createDestruction({ seed: 1 })
      const scene = new THREE.Scene()
      const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
      const { house } = houseOf(planOf(template, seed), { destruction: world, destructionRenderer: renderer }, { quality: 'game' })
      scene.add(house.group)
      // every piece that says what holds it found it: nothing is set in the ground that does not stand on it
      expect(house.structure.unheld, 'pieces nothing holds').toEqual([])
      house.destruction.activate()
      const id = house.destruction.id as string
      const loose = (world.state(id)?.groups ?? []).slice(1).map((group) => group.join(', '))
      expect(loose, 'loose groups at load').toEqual([])
      const hp = new Map(world.state(id)!.parts.map((part) => [part.id, part.hp]))
      const before = posesOf(house.group)
      for (let t = 0; t < SETTLE_SECONDS; t += DT) {
        world.update(DT)
        renderer.update(DT)
      }
      expect(world.ids()).toEqual([id])
      expect(renderer.stats().pieces).toBe(0)
      const state = world.state(id)!
      expect(state.parts.filter((part) => part.status !== 'intact' || part.hp !== hp.get(part.id)).map((part) => part.id)).toEqual([])
      const after = posesOf(house.group)
      const moved = [...before].filter(([mesh, at]) => !after.has(mesh) || after.get(mesh)!.distanceTo(at) > STILL).map(([mesh]) => mesh.userData.destructionPart as string)
      expect(moved).toEqual([])
      house.dispose()
      renderer.dispose()
    })
  }
})
