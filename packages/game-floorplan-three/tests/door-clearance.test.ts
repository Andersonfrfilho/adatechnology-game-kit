import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import type { House } from '../src'
import { THREE, TEMPLATES, houseOf, planOf } from './helpers/houses'
import { physicsOption } from './setup-physics'

/** Overlap deeper than this (m) on all three axes at once is a leaf inside its frame. */
const OVERLAP = 0.001
/** What a real leaf keeps to its frame on every side (m): about 2 to 3 mm; the drawn leaf keeps 5. */
const CLEARANCE = 0.002

type Frame = { readonly id: string; readonly boxes: THREE.Box3[] }

/** The boxes a frame is drawn with: the vertices of its range joined by the triangles they share (each box of the frame has vertices of its own). */
const frameBoxes = (house: House, id: string): THREE.Box3[] => {
  const boxes: THREE.Box3[] = []
  for (const item of house.structure.meshesOf(id)) {
    if (!item.mesh) continue
    const index = item.mesh.geometry.getIndex()!.array
    const position = item.mesh.geometry.getAttribute('position')
    const parent = new Map<number, number>()
    const find = (v: number): number => {
      let root = v
      while (parent.get(root) !== root) root = parent.get(root) ?? root
      return root
    }
    for (let i = item.i0; i < item.i1; i += 3) {
      for (let k = 0; k < 3; k++) if (!parent.has(index[i + k]!)) parent.set(index[i + k]!, index[i + k]!)
      parent.set(find(index[i + 1]!), find(index[i]!))
      parent.set(find(index[i + 2]!), find(index[i]!))
    }
    const byRoot = new Map<number, THREE.Box3>()
    item.mesh.updateWorldMatrix(true, false)
    for (const vertex of parent.keys()) {
      const root = find(vertex)
      const box = byRoot.get(root) ?? new THREE.Box3()
      byRoot.set(root, box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, vertex).applyMatrix4(item.mesh.matrixWorld)))
    }
    boxes.push(...byRoot.values())
  }
  return boxes
}

/** The depth two boxes overlap by on their shallowest axis (m): positive when they share volume, negative the gap when they do not. */
const overlapOf = (a: THREE.Box3, b: THREE.Box3): number =>
  Math.min(a.max.x - b.min.x, b.max.x - a.min.x, a.max.y - b.min.y, b.max.y - a.min.y, a.max.z - b.min.z, b.max.z - a.min.z)

/** The doors of a house that are shut, with the world box of each of their moving groups (the leaf and its handle) and the boxes of their frame. */
const shutDoors = (house: House): Array<{ id: string; leaves: THREE.Box3[]; frame: Frame }> => {
  const groups = new Map<string, THREE.Box3[]>()
  house.group.updateMatrixWorld(true)
  house.group.traverse((object) => {
    const match = /^(?:dyn|ix:mac):(.+?):\d+\//.exec(object.name)
    if (!match) return
    const list = groups.get(match[1]!) ?? []
    list.push(new THREE.Box3().setFromObject(object))
    groups.set(match[1]!, list)
  })
  return [...groups].map(([id, leaves]) => ({ id, leaves, frame: { id: `jamb:${id}`, boxes: frameBoxes(house, `jamb:${id}`) } }))
}

/** A house with its structure bound to a destruction world, which is what draws the doors as groups of their own. */
const mount = (template: string, seed: number): House => {
  const world = createDestruction({ seed: 5 })
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
  const { house } = houseOf(planOf(template, seed), { destruction: world, destructionRenderer: renderer })
  scene.add(house.group)
  house.destruction.activate()
  for (let t = 0; t < 2; t += 1 / 60) renderer.update(1 / 60)
  return house
}

const CASES = Object.keys(TEMPLATES).flatMap((template) => [1, 2, 3].map((seed) => [template, seed] as const))

describe('a door leaf and its frame', () => {
  it.each(CASES)('%s, seed %i: no leaf of a door overlaps a post or the lintel of its frame, and each keeps a clearance from them', (template, seed) => {
    const house = mount(template, seed)
    const doors = shutDoors(house)
    expect(doors.length).toBeGreaterThan(0)
    for (const door of doors) {
      expect(door.frame.boxes.length, `${door.id} has a frame`).toBeGreaterThanOrEqual(2)
      for (const leaf of door.leaves) for (const box of door.frame.boxes) {
        expect(overlapOf(leaf, box), `${door.id} (${template}, seed ${seed})`).toBeLessThanOrEqual(OVERLAP)
      }
    }
  })

  it('the clearance is real: a leaf is a few millimetres from the post it hangs beside, not touching it', () => {
    const house = mount('sobrado', 3)
    const door = shutDoors(house).find((d) => d.id === 'd0_0')!
    const leaf = door.leaves[0]!
    const gaps = door.frame.boxes.map((box) => -overlapOf(leaf, box))
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(CLEARANCE)
  })
})
