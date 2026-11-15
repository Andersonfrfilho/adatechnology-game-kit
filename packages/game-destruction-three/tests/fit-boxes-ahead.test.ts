import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import type { PartBox } from '../src/pieces'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

// the fit is counted through the module the renderer imports it from
let fitCalls = 0
vi.mock('@adatechnology/game-shapes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@adatechnology/game-shapes')>()
  return { ...actual, fitOrientedBoxes: (...args: Parameters<typeof actual.fitOrientedBoxes>) => (fitCalls++, actual.fitOrientedBoxes(...args)) }
})

const PART_IDS = ['sheet', 'plate', 'post', 'gable'] as const

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
  const normal: number[] = []
  const index: number[] = []
  let base = 0
  for (const g of geos) {
    const count = g.getAttribute('position').count
    position.push(...Array.from(g.getAttribute('position').array))
    normal.push(...Array.from(g.getAttribute('normal').array))
    for (const i of Array.from(g.getIndex()!.array)) index.push(i + base)
    ranges.push([base, base + count])
    base += count
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3))
  geo.setIndex(index)
  return { geo, ranges }
}

type Scene = { renderer: ReturnType<typeof createDestructionRenderer>; world: FakeWorld; mesh: THREE.Mesh; root: THREE.Group }

/** A house-like object placed away from the origin and turned, its parts ranges of one merged mesh, each its own group. */
const house = (fitBoxesAhead: boolean, groups?: string[][]): Scene => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), eventBudgetMs: Infinity, fitBoxesAhead })
  const { geo, ranges } = merge(catalogGeometries())
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial())
  const root = new THREE.Group()
  root.position.set(12.3, 0.4, -7.1)
  root.rotation.y = 0.37
  root.add(mesh)
  scene.add(root)
  root.updateMatrixWorld(true)
  world.addObject('house', PART_IDS.map((id) => partState(id, 'wood')), groups ?? [[...PART_IDS]])
  const parts = Object.fromEntries(PART_IDS.map((id, i) => [id, { mesh, range: ranges[i]! }]))
  renderer.bind('house', root, { parts })
  return { renderer, world, mesh, root }
}

const partBoxesOf = (renderer: Scene['renderer'], objectId: string): PartBox[] | undefined => (renderer.piece(objectId) as unknown as { partBoxes?: PartBox[] } | null)?.partBoxes

const copy = (a: ArrayLike<number> | undefined): number[] => (a ? Array.from(a) : [])

/** The numbers of every attribute and the index of every mesh under the scene root, by mesh name, to compare two runs bit by bit. */
const drawn = (root: THREE.Object3D): Record<string, number[]> => {
  const out: Record<string, number[]> = {}
  root.parent?.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const key = mesh.name
    for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) out[`${key}:${name}`] = copy(attribute.array as ArrayLike<number>)
    out[`${key}:index`] = copy(mesh.geometry.getIndex()?.array)
  })
  return out
}

describe('the boxes of a part drawn by a range are fitted ahead of the blow that breaks it', () => {
  it('splitting an object takes the boxes that were fitted ahead, and they are the very numbers fitting them when it breaks gives', () => {
    const groups = PART_IDS.map((id) => [id])
    const ahead = house(true, groups.map((g) => [...g]))
    const late = house(false, groups.map((g) => [...g]))
    ahead.renderer.deferredQueue().flush()
    const fittedAhead = fitCalls
    expect(fittedAhead).toBeGreaterThan(0)
    for (const s of [ahead, late]) s.world.emit({ type: 'detach', object: 'house', joint: 'j', parts: [...PART_IDS], by: 'break', groups })
    ahead.renderer.deferredQueue().flush()
    late.renderer.deferredQueue().flush()
    // what fitted ahead is all of what the split of `ahead` needed: only `late` fitted at the split
    const lateFits = fitCalls - fittedAhead
    expect(lateFits).toBeGreaterThan(0)
    const splitIds = ahead.world.splits.map((s) => s.newId)
    expect(splitIds.length).toBe(PART_IDS.length - 1)
    let compared = 0
    for (const id of ['house', ...splitIds]) {
      const a = partBoxesOf(ahead.renderer, id)
      const b = partBoxesOf(late.renderer, id)
      expect(a).toEqual(b)
      if (a) compared++
    }
    expect(compared).toBeGreaterThan(0)
  })

  it('reads them again, fresh, when the points are not the very same numbers', () => {
    const { renderer, mesh } = house(true)
    renderer.deferredQueue().flush()
    const before = fitCalls
    // the whole object made a piece reads the boxes of the parts it has: all from what was fitted ahead
    renderer.makePiece('house')
    expect(fitCalls).toBe(before)
    // a part dented (its vertices moved) is not the drawing that was fitted: it is fitted again
    const drawing = mesh.geometry.getAttribute('position')
    drawing.setY(0, drawing.getY(0) + 0.05)
    renderer.makePiece('house')
    expect(fitCalls).toBeGreaterThan(before)
  })

  it('splitting every group in one go writes the merged mesh and the loose meshes as splitting them one at a time does', () => {
    const groups = PART_IDS.map((id) => [id])
    const together = house(true, groups.map((g) => [...g]))
    together.world.emit({ type: 'detach', object: 'house', joint: 'j', parts: [...PART_IDS], by: 'break', groups })
    together.renderer.deferredQueue().flush()
    expect(together.world.splits.length).toBe(PART_IDS.length - 1)
    // the reference: one group at a time, each split its own batch, the way every split was written before
    const stepwise = house(true)
    const state = stepwise.world.objects.get('house')!
    // the same order as the one-go split reads them: the groups from index 1, each split renumbering the rest
    for (let i = 1; i < PART_IDS.length; i++) {
      state.groups = [PART_IDS.filter((id, at) => at === 0 || at > i), [PART_IDS[i]!]]
      stepwise.world.emit({ type: 'detach', object: 'house', joint: 'j', parts: [...PART_IDS], by: 'break', groups: state.groups.map((g) => [...g]) })
      stepwise.renderer.deferredQueue().flush()
    }
    expect(stepwise.world.splits.length).toBe(PART_IDS.length - 1)
    const a = drawn(together.root)
    expect(Object.keys(a).length).toBeGreaterThan(PART_IDS.length)
    const b = drawn(stepwise.root)
    expect(a).toEqual(b)
  })
})
