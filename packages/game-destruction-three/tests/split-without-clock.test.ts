import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const GROUPS = [['base'], ['pole'], ['mailbox'], ['door', 'hinge']]

/** An object `o1` with one standing group and three loose ones, and a `detach` waiting; the queue is run once with the injected clock and deadline (no `workBudget`). */
function splitsAfterOneRun(deadline: number, clock: () => number): string[][] {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld() })
  const ids = GROUPS.flat()
  world.addObject('o1', ids.map((id) => partState(id, 'wood')), GROUPS.map((group) => [...group]))
  const root = new THREE.Group()
  const meshes: Record<string, THREE.Mesh> = {}
  ids.forEach((id, index) => {
    meshes[id] = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial())
    meshes[id]!.position.set(index, 0.1, 0)
    root.add(meshes[id]!)
  })
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('o1', root, { parts: meshes })
  world.emit({ type: 'detach', object: 'o1', part: 'door', by: 'force' })
  renderer.deferredQueue().run(deadline, clock)
  return world.splits.map((split) => world.state(split.newId)?.parts.map((part) => part.id) ?? [])
}

describe('the loose groups of an object come off whatever the clock says (spec 017, T1.2; rule 15: nothing that changes the simulation depends on a clock)', () => {
  it('with the deadline already past or far away, one run of the event queue splits the same groups', () => {
    const roomy = splitsAfterOneRun(Infinity, () => 0)
    const late = splitsAfterOneRun(0, () => 1)
    expect(roomy).toEqual([['pole'], ['mailbox'], ['door', 'hinge']])
    expect(late).toEqual(roomy)
  })
})
