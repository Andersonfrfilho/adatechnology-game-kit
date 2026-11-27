import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import type { SeamWorld } from '@adatechnology/game-physics'
import { describe, expect, it } from 'vitest'

import { THREE, houseOf, planOf } from './helpers/houses'
import { physicsOption } from './setup-physics'

// every drawn fixed thing of a house is a body of the engine: a mode of the engine only (the kit's own solver lands pieces on what it measures itself)
const engineOnly = describe

type Solid = { center: number[]; half: number[]; rotation: number[]; mesh?: { vertices: Float32Array } }
type Statics = { bodies: Map<string, { held: Map<string, { solid: Solid }>; waiting: number }> }
type DrawnMesh = { mesh: THREE.Mesh; range: [number, number] | null; hidden: boolean; loose: boolean }
type Bounds = Map<string, { parts: Map<string, { id: string; gone: string; meshes: DrawnMesh[] }> }>

/** Smaller than this (m) on every side is a part the house collapsed to a point: not drawn. */
const COLLAPSED = 0.002
/** What the spec asks of a body against its mesh (m). */
const WITHIN = 0.011

const mount = (template: string) => {
  const world = createDestruction({ seed: 5 })
  const scene = new THREE.Scene()
  const physics = physicsOption() as SeamWorld
  const renderer = createDestructionRenderer(THREE, { physics, scene, world })
  const { house } = houseOf(planOf(template, 3), { destruction: world, destructionRenderer: renderer })
  scene.add(house.group)
  house.destruction.activate()
  const internals = renderer as unknown as { bounds: Bounds; pieceSys: { engine: { statics: Statics } } }
  const run = (seconds: number): void => {
    for (let t = 0; t < seconds; t += 1 / 60) renderer.update(1 / 60)
  }
  return { world, scene, physics, renderer, house, internals, run }
}

type Mounted = ReturnType<typeof mount>

/** The box around what a mesh draws of a part (its vertex range in world space), or null when the part is collapsed to a point. */
const drawnBounds = (m: DrawnMesh): THREE.Box3 | null => {
  m.mesh.updateWorldMatrix(true, false)
  const array = m.mesh.geometry.getAttribute('position').array as Float32Array
  const from = m.range ? m.range[0] : 0
  const to = m.range ? m.range[1] : array.length / 3
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  for (let i = from; i < to; i++) box.expandByPoint(v.set(array[i * 3]!, array[i * 3 + 1]!, array[i * 3 + 2]!).applyMatrix4(m.mesh.matrixWorld))
  const size = box.getSize(new THREE.Vector3())
  return Math.max(size.x, size.y, size.z) < COLLAPSED ? null : box
}

/** The box around a body's solid: its eight corners turned, or the triangles. */
const solidBounds = (s: Solid): THREE.Box3 => {
  const box = new THREE.Box3()
  if (s.mesh) {
    for (let i = 0; i < s.mesh.vertices.length; i += 3) box.expandByPoint(new THREE.Vector3(s.mesh.vertices[i], s.mesh.vertices[i + 1], s.mesh.vertices[i + 2]))
    return box
  }
  const q = new THREE.Quaternion(s.rotation[0], s.rotation[1], s.rotation[2], s.rotation[3])
  for (let k = 0; k < 8; k++) box.expandByPoint(new THREE.Vector3((k & 1 ? 1 : -1) * s.half[0]!, (k & 2 ? 1 : -1) * s.half[1]!, (k & 4 ? 1 : -1) * s.half[2]!).applyQuaternion(q).add(new THREE.Vector3(s.center[0], s.center[1], s.center[2])))
  return box
}

const closeTo = (a: THREE.Box3, b: THREE.Box3): boolean => ['x', 'y', 'z'].every((axis) => Math.abs(a.min[axis as 'x'] - b.min[axis as 'x']) < WITHIN && Math.abs(a.max[axis as 'x'] - b.max[axis as 'x']) < WITHIN)

/** The first thing the engine has under (x, z), looking down from above the house. */
const topUnder = (m: Mounted, x: number, z: number, from = 30): number => {
  const hit = m.physics.rayFirst([x, from, z], [0, -1, 0], 100)
  return hit ? from - hit.distance : -Infinity
}

/** One mesh of a part of the house by its key (`part:index`). */
const meshOf = (m: Mounted, key: string): DrawnMesh => {
  const [part, index] = key.split(':') as [string, string]
  for (const b of m.internals.bounds.values()) for (const pv of b.parts.values()) if (pv.id === part) return pv.meshes[Number(index)]!
  throw new Error(`no mesh ${key}`)
}

/** A block the size of a brick, a piece of its own, held up at `at`. */
const drop = (m: Mounted, id: string, at: [number, number, number], half = 0.05) => {
  m.world.add({ parts: [{ id: 'body', material: 'wood_hard', shape: { kind: 'box', size: [half * 2, half * 2, half * 2] }, position: [0, 0, 0] }] }, { id })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(half * 2, half * 2, half * 2))
  const root = new THREE.Group()
  root.add(mesh)
  root.position.set(...at)
  m.scene.add(root)
  root.updateMatrixWorld(true)
  m.renderer.bind(id, root, { parts: { body: mesh } })
  const piece = m.renderer.makePiece(id, { mass: 1 })
  return { root, piece, bottom: (): number => root.position.y - half }
}

engineOnly('every fixed thing a house draws collides in the engine', () => {
  it.each(['sobrado', 'casaA'])('%s: each mesh it draws has a body, within 1 cm of the mesh, and the bodies are the meshes and nothing more', (template) => {
    const m = mount(template)
    // the meshes fill in over a few updates (a budget of vertices and triangles each)
    m.run(2)
    const [id, bound] = [...m.internals.bounds.entries()][0]!
    const fixed = m.internals.pieceSys.engine.statics.bodies.get(id)!
    expect(fixed.waiting).toBe(0)
    const expected = new Map<string, THREE.Box3>()
    for (const pv of bound.parts.values()) {
      if (pv.gone !== 'none') continue
      pv.meshes.forEach((mesh, k) => {
        const box = mesh.hidden || mesh.loose ? null : drawnBounds(mesh)
        if (box) expected.set(`${pv.id}:${k}`, box)
      })
    }
    expect(expected.size).toBeGreaterThan(300)
    expect([...fixed.held.keys()].sort()).toEqual([...expected.keys()].sort())
    const off = [...expected].filter(([key, box]) => !closeTo(box, solidBounds(fixed.held.get(key)!.solid))).map(([key]) => key)
    expect(off).toEqual([])
    // the world holds one body per solid, and nothing else is fixed here but the ground tiles of the pieces
    expect(m.physics.bodyCount).toBe(fixed.held.size)
  })

  it('a block dropped on a floor slab of the upper storey lands on its drawn top, and one dropped on the tiles of the roof stays on them', () => {
    const m = mount('sobrado')
    m.run(2)
    // the slab: the topmost layer of the floor of the upper storey, drawn 2.80 m up
    const slab = drawnBounds(meshOf(m, 'slab_1_p0:0'))!
    const centre = slab.getCenter(new THREE.Vector3())
    expect(slab.max.y).toBeGreaterThan(2.7)
    const onSlab = drop(m, 'on_slab', [centre.x, slab.max.y + 0.5, centre.z])
    // the roof: over a tile of the roof, a block above the surface the engine has there
    const tiles = drawnBounds(meshOf(m, 'roof_a_1:1'))!
    const middle = tiles.getCenter(new THREE.Vector3())
    const surface = topUnder(m, middle.x, middle.z, 12)
    expect(surface).toBeGreaterThan(5)
    const onRoof = drop(m, 'on_roof', [middle.x, surface + 0.3, middle.z])
    m.run(0.6)
    expect(onSlab.bottom()).toBeGreaterThan(slab.max.y - 0.02)
    expect(onSlab.bottom()).toBeLessThan(slab.max.y + 0.05)
    expect(onRoof.bottom()).toBeGreaterThan(surface - 0.1)
    expect(onRoof.bottom()).toBeGreaterThan(5)
  })
})
