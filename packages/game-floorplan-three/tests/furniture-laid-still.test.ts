import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'

import { furnitureSpec } from '../src'
import { fakeDocument } from './helpers/fake-document'
import { physicsOption } from './setup-physics'

const STEP = 1 / 60
/** How far (m) any part of a piece laid on the floor may move in its first seconds: it is laid where it stands, nothing drops into place. */
const STILL = 0.01
const catalog = defaultFurnitureCatalog()
/** The types `furnitureSpec` cannot draw on its own (the flight of stairs is the plan's). */
const WITHOUT_PIECE = new Set(['stairs'])
const types = [...new Set(catalog.map((entry) => entry.type))].filter((type) => !WITHOUT_PIECE.has(type))

/** Every part the drawing of `type` has, where it is in the world after `seconds` of the piece laid on the floor as a loose piece, as the test room lays it. */
function laid(type: string, seconds: number): { moved: Array<[string, number]>; fastest: number } {
  const made = furnitureSpec(THREE, type, { catalog, document: fakeDocument, options: { chairs: false } })
  const scene = new THREE.Scene()
  const world = createDestruction()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
  const id = world.add(made.spec, { id: type })
  const root = made.build(THREE)
  scene.add(root)
  root.updateMatrixWorld(true)
  const meshes = new Map<string, THREE.Object3D>()
  root.traverse((node) => {
    if (typeof node.userData.destructionPart === 'string') meshes.set(node.userData.destructionPart as string, node)
  })
  const at = (node: THREE.Object3D): THREE.Vector3 => node.getWorldPosition(new THREE.Vector3())
  const start = new Map([...meshes].map(([part, node]) => [part, at(node)]))
  renderer.bind(id, root)
  // the room lays the furniture of the plans as loose bodies (`furnitureItems`), but what is fixed (on a wall, in the ground) stays where it is laid
  if (!made.fixed) renderer.makePiece(id)
  let fastest = 0
  for (let t = 0; t < seconds; t += STEP) {
    world.update(STEP)
    renderer.update(STEP)
    for (const piece of renderer.pieces()) fastest = Math.max(fastest, Math.abs(piece.velocity[1]))
  }
  scene.updateMatrixWorld(true)
  // a part's mesh may move to the piece that took it off (`detach`): it is found again by its name under the scene
  const now = new Map<string, THREE.Vector3>()
  scene.traverse((node) => {
    const part = node.userData.destructionPart
    if (typeof part === 'string' && start.has(part)) now.set(part, at(node))
  })
  const moved: Array<[string, number]> = [...start].map(([part, was]) => [part, now.get(part)?.distanceTo(was) ?? Infinity])
  return { moved: moved.filter(([, distance]) => distance > STILL), fastest }
}

describe('furniture laid on the floor stands where it was laid', () => {
  it.each([
    ['gourmet_counter', 'a gourmet counter: its stool stands by it, its range hood and upper cabinet hang on the wall behind it, its hob knobs stay on the hob'],
    ['gourmet_counter_small', 'a small gourmet counter'],
    ['shower', 'a shower box: its shower head and mixer stay on the wall'],
    ['shower_large', 'a large shower box'],
    ['curtain', 'a curtain: the rod stays on the wall, the rings on the rod, the pleats on the rings'],
  ])('%s (%s): nothing drops when it is laid', (type) => {
    const { moved, fastest } = laid(type, 2)
    expect(moved).toEqual([])
    expect(fastest).toBeLessThan(0.1)
  })

  it('every type of the catalogue: no part moves more than 1 cm in the first 2 s', () => {
    const fell = types.flatMap((type) => laid(type, 2).moved.map(([part, distance]) => `${type}/${part} ${distance.toFixed(3)} m`))
    expect(fell).toEqual([])
  })
})
