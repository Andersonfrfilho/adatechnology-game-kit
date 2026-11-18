import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { fitOrientedBoxes as fitExactly } from '@adatechnology/game-shapes'

import { createDestructionRenderer } from '../src/renderer'
import type { PartBox } from '../src/internal'
import { isRigidPose } from '../src/rigid-pose'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

// the fit is counted through the module the renderer imports it from
let fitCalls = 0
vi.mock('@adatechnology/game-shapes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@adatechnology/game-shapes')>()
  return { ...actual, fitOrientedBoxes: (...args: Parameters<typeof actual.fitOrientedBoxes>) => (fitCalls++, actual.fitOrientedBoxes(...args)) }
})

const PART_IDS = ['sheet', 'plate', 'post', 'gable'] as const
const TOLERANCE = 1e-6

/** What the house's merged meshes draw: pitched sheets, a plate with many vertices, a long post, two slopes of a gable. */
const catalogGeometries = (): THREE.BufferGeometry[] => [
  new THREE.PlaneGeometry(4, 3, 4, 4).rotateX(-Math.PI / 2).rotateX(Math.PI / 6).translate(0, 2, 0),
  new THREE.PlaneGeometry(2, 2, 12, 12).rotateX(-Math.PI / 2).rotateZ(0.3).translate(5, 1, 0),
  new THREE.CylinderGeometry(0.08, 0.1, 6, 8, 12).rotateZ(0.4).translate(-4, 3, 1),
  new THREE.PlaneGeometry(2, 4, 4, 4).rotateX(-Math.PI / 2).rotateZ(Math.PI / 6).translate(0, 4, 5),
]

const merge = (geos: THREE.BufferGeometry[]): { geo: THREE.BufferGeometry; ranges: Array<[number, number]> } => {
  const ranges: Array<[number, number]> = []
  const position: number[] = []
  const index: number[] = []
  let base = 0
  for (const g of geos) {
    const count = g.getAttribute('position').count
    position.push(...Array.from(g.getAttribute('position').array))
    for (const i of Array.from(g.getIndex()!.array)) index.push(i + base)
    ranges.push([base, base + count])
    base += count
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return { geo, ranges }
}

type Scene = { renderer: ReturnType<typeof createDestructionRenderer>; world: FakeWorld; mesh: THREE.Mesh; root: THREE.Group }

/** A house-like object placed away from the origin and turned (and scaled when asked), its parts ranges of one merged mesh. */
const house = (scale = 1): Scene => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), eventBudgetMs: Infinity, fitBoxesAhead: true })
  const { geo, ranges } = merge(catalogGeometries())
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial())
  const root = new THREE.Group()
  root.position.set(12.3, 0.4, -7.1)
  root.rotation.y = 0.37
  root.scale.setScalar(scale)
  root.add(mesh)
  scene.add(root)
  root.updateMatrixWorld(true)
  world.addObject('house', PART_IDS.map((id) => partState(id, 'wood')), [[...PART_IDS]])
  renderer.bind('house', root, { parts: Object.fromEntries(PART_IDS.map((id, i) => [id, { mesh, range: ranges[i]! }])) })
  return { renderer, world, mesh, root }
}

/** A blow tears every joint of the house: one piece per part. Returns the fits it took. */
const splitAll = (s: Scene): number => {
  const groups = PART_IDS.map((id) => [id])
  s.world.objects.get('house')!.groups = groups.map((g) => [...g])
  const before = fitCalls
  s.world.emit({ type: 'detach', object: 'house', joint: 'j', parts: [...PART_IDS], by: 'break', groups })
  s.renderer.deferredQueue().flush()
  return fitCalls - before
}

const pieceOf = (s: Scene, id: string): { root: THREE.Object3D; localCenter: readonly number[]; partBoxes?: PartBox[] } =>
  s.renderer.piece(id) as unknown as { root: THREE.Object3D; localCenter: readonly number[]; partBoxes?: PartBox[] }

/** The eight corners of each box in the world: the piece's frame is its root's pose without scale, from its centre of mass. */
const worldCornersOfPiece = (s: Scene, id: string): number[][][] => {
  const piece = pieceOf(s, id)
  piece.root.updateWorldMatrix(true, false)
  const position = new THREE.Vector3()
  const turn = new THREE.Quaternion()
  piece.root.matrixWorld.decompose(position, turn, new THREE.Vector3())
  const [lx, ly, lz] = piece.localCenter
  return (piece.partBoxes ?? []).map((box) => cornersOf(box.center.map((v, k) => v + [lx!, ly!, lz!][k]!), box.half, box.rotation ?? [0, 0, 0, 1], { position, turn }))
}

const cornersOf = (center: readonly number[], half: readonly number[], rotation: readonly number[], frame: { position: THREE.Vector3; turn: THREE.Quaternion }): number[][] => {
  const q = new THREE.Quaternion(rotation[0], rotation[1], rotation[2], rotation[3])
  const out: number[][] = []
  for (let i = 0; i < 8; i++) {
    const v = new THREE.Vector3(i & 1 ? half[0] : -half[0]!, i & 2 ? half[1] : -half[1]!, i & 4 ? half[2] : -half[2]!).applyQuaternion(q)
    v.add(new THREE.Vector3(center[0], center[1], center[2])).applyQuaternion(frame.turn).add(frame.position)
    out.push([v.x, v.y, v.z])
  }
  return out
}

/** The meshes a piece draws, with their vertices in the world. */
const meshesOf = (s: Scene, id: string): Array<{ mesh: THREE.Mesh; world: number[] }> => {
  const piece = pieceOf(s, id)
  const out: Array<{ mesh: THREE.Mesh; world: number[] }> = []
  piece.root.updateMatrixWorld(true)
  piece.root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const position = mesh.geometry.getAttribute('position')
    const world: number[] = []
    const v = new THREE.Vector3()
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld)
      world.push(v.x, v.y, v.z)
    }
    out.push({ mesh, world })
  })
  return out
}

/** The boxes fitting the vertices in the mesh's own space gives, carried into the world by the mesh's pose, as world corners. */
const worldCornersFitted = (s: Scene, id: string): number[][][] => {
  const out: number[][][] = []
  for (const { mesh } of meshesOf(s, id)) {
    const own = Array.from(mesh.geometry.getAttribute('position').array)
    const position = new THREE.Vector3()
    const turn = new THREE.Quaternion()
    mesh.matrixWorld.decompose(position, turn, new THREE.Vector3())
    for (const box of fitExactly(own, Array.from(mesh.geometry.getIndex()!.array))) out.push(cornersOf(box.center, box.half, box.rotation, { position, turn }))
  }
  return out
}

/** Every drawn vertex of the piece is inside one of its boxes (within `TOLERANCE`): the boxes hold what is drawn. */
const holdsTheDrawing = (s: Scene, id: string): boolean => {
  const piece = pieceOf(s, id)
  const position = new THREE.Vector3()
  const turn = new THREE.Quaternion()
  piece.root.matrixWorld.decompose(position, turn, new THREE.Vector3())
  const back = turn.clone().invert()
  const [lx, ly, lz] = piece.localCenter
  const boxes = piece.partBoxes ?? []
  return meshesOf(s, id).every(({ world }) => {
    for (let i = 0; i < world.length; i += 3) {
      const local = new THREE.Vector3(world[i], world[i + 1], world[i + 2]).sub(position).applyQuaternion(back).sub(new THREE.Vector3(lx, ly, lz))
      const inside = boxes.some((box) => {
        const p = local.clone().sub(new THREE.Vector3(...box.center)).applyQuaternion(new THREE.Quaternion(...(box.rotation ?? [0, 0, 0, 1])).invert())
        return Math.abs(p.x) <= box.half[0] + TOLERANCE && Math.abs(p.y) <= box.half[1] + TOLERANCE && Math.abs(p.z) <= box.half[2] + TOLERANCE
      })
      if (!inside) return false
    }
    return true
  })
}

/** Every box of `a` has a box in `b` with the same eight corners (in any order), within `TOLERANCE`. */
const sameBoxes = (a: number[][][], b: number[][][]): boolean =>
  a.length === b.length &&
  a.every((corners) => b.some((other) => corners.every((p) => other.some((r) => Math.hypot(p[0]! - r[0]!, p[1]! - r[1]!, p[2]! - r[2]!) < TOLERANCE))))

describe('a split carries the boxes fitted ahead into the loose piece instead of fitting them again', () => {
  it('takes no fit on the main thread at the split when every part was fitted ahead', () => {
    const s = house()
    s.renderer.deferredQueue().flush()
    expect(splitAll(s)).toBe(0)
    expect(s.world.splits.length).toBe(PART_IDS.length - 1)
  })

  it('gives each loose piece the boxes fitted to its vertices in the mesh\'s own space, turned and moved as the mesh is: none bigger or smaller, and they hold every drawn vertex', () => {
    const s = house()
    s.renderer.deferredQueue().flush()
    splitAll(s)
    let compared = 0
    for (const id of s.world.splits.map((x) => x.newId)) {
      const carried = worldCornersOfPiece(s, id)
      if (carried.length === 0) continue
      expect(sameBoxes(carried, worldCornersFitted(s, id))).toBe(true)
      expect(holdsTheDrawing(s, id)).toBe(true)
      compared++
    }
    expect(compared).toBeGreaterThan(0)
  })

  it('reads the boxes of an object moved and turned since they were fitted from what was fitted, carried to where it is now', () => {
    const s = house()
    s.renderer.deferredQueue().flush()
    s.root.position.set(-3.2, 1.7, 8.4)
    s.root.rotation.set(0.2, -1.1, 0.05)
    s.root.updateMatrixWorld(true)
    const before = fitCalls
    s.renderer.makePiece('house')
    expect(fitCalls).toBe(before)
    expect(splitAll(s)).toBe(0)
    for (const id of s.world.splits.map((x) => x.newId)) {
      const carried = worldCornersOfPiece(s, id)
      if (carried.length === 0) continue
      expect(sameBoxes(carried, worldCornersFitted(s, id))).toBe(true)
      expect(holdsTheDrawing(s, id)).toBe(true)
    }
  })

  it('fits a chipped part again: its vertices are not the ones that were fitted', () => {
    const s = house()
    s.renderer.deferredQueue().flush()
    const drawing = s.mesh.geometry.getAttribute('position')
    // a vertex of the plate (the second range) dented
    drawing.setY(30, drawing.getY(30) + 0.2)
    drawing.needsUpdate = true
    expect(splitAll(s)).toBe(1)
  })

  it('fits the points where they are when the object is scaled: a scaled box is not the box fitted at scale one', () => {
    const s = house(1.5)
    s.renderer.deferredQueue().flush()
    expect(splitAll(s)).toBeGreaterThan(0)
  })

  it('gives the same boxes, bit for bit, run after run and with the cache cold or full', () => {
    const run = (ahead: boolean): Array<PartBox[] | undefined> => {
      const s = house()
      if (ahead) s.renderer.deferredQueue().flush()
      splitAll(s)
      return s.world.splits.map((x) => pieceOf(s, x.newId).partBoxes)
    }
    const first = run(true)
    expect(run(true)).toEqual(first)
    expect(run(false)).toEqual(first)
  })
})

describe('isRigidPose', () => {
  it('takes a turn and a move, and refuses a scale, a shear and a mirror', () => {
    const turned = new THREE.Matrix4().compose(new THREE.Vector3(3, -2, 9), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 1.2, -0.7)), new THREE.Vector3(1, 1, 1))
    expect(isRigidPose(turned.elements)).toBe(true)
    expect(isRigidPose(new THREE.Matrix4().multiplyMatrices(turned, new THREE.Matrix4().makeScale(1.01, 1.01, 1.01)).elements)).toBe(false)
    expect(isRigidPose(new THREE.Matrix4().makeShear(0.1, 0, 0, 0, 0, 0).elements)).toBe(false)
    expect(isRigidPose(new THREE.Matrix4().makeScale(-1, 1, 1).elements)).toBe(false)
  })
})
