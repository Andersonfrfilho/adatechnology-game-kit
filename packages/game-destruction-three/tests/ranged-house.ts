import * as THREE from 'three'

import { createDestructionRenderer } from '../src/renderer'
import type { RendererOptions } from '../src/types'
import type { PartBox } from '../src/internal'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

/** What the house's merged meshes draw: pitched sheets, a plate with many vertices, a long post, two slopes of a gable. */
export const catalogGeometries = (): THREE.BufferGeometry[] => [
  new THREE.PlaneGeometry(4, 3, 4, 4).rotateX(-Math.PI / 2).rotateX(Math.PI / 6).translate(0, 2, 0),
  new THREE.PlaneGeometry(2, 2, 12, 12).rotateX(-Math.PI / 2).rotateZ(0.3).translate(5, 1, 0),
  new THREE.CylinderGeometry(0.08, 0.1, 6, 8, 12).rotateZ(0.4).translate(-4, 3, 1),
  new THREE.PlaneGeometry(2, 4, 4, 4).rotateX(-Math.PI / 2).rotateZ(Math.PI / 6).translate(0, 4, 5),
]

export const mergeGeometries = (geos: THREE.BufferGeometry[]): { geo: THREE.BufferGeometry; ranges: Array<[number, number]> } => {
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

export type RangedHouse = { renderer: ReturnType<typeof createDestructionRenderer>; world: FakeWorld; mesh: THREE.Mesh; root: THREE.Group; partIds: string[] }

export interface RangedHouseOptions {
  /** Copies of the catalogue in the merged mesh (default 1: four parts), each shifted along x. */
  readonly copies?: number
  readonly position?: readonly [number, number, number]
  readonly turn?: number
  readonly renderer?: Partial<RendererOptions>
}

/** A house-like object placed away from the origin and turned, its parts ranges of one merged mesh, all in one group (it is built whole). */
export const rangedHouse = (options: RangedHouseOptions = {}): RangedHouse => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), eventBudgetMs: Infinity, ...options.renderer })
  const geos: THREE.BufferGeometry[] = []
  for (let copy = 0; copy < (options.copies ?? 1); copy++) for (const g of catalogGeometries()) geos.push(g.translate(copy * 11, 0, 0))
  const { geo, ranges } = mergeGeometries(geos)
  const partIds = ranges.map((_, i) => `part${i}`)
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial())
  const root = new THREE.Group()
  root.position.set(...(options.position ?? [12.3, 0.4, -7.1]))
  root.rotation.y = options.turn ?? 0.37
  root.add(mesh)
  scene.add(root)
  root.updateMatrixWorld(true)
  world.addObject('house', partIds.map((id) => partState(id, 'wood')), [[...partIds]])
  const parts = Object.fromEntries(partIds.map((id, i) => [id, { mesh, range: ranges[i]! }]))
  renderer.bind('house', root, { parts })
  return { renderer, world, mesh, root, partIds }
}

/** A blow tears every joint of the house: the world's groups change with the detach, one per part. */
export const detachEvery = (house: RangedHouse): void => {
  const groups = house.partIds.map((id) => [id])
  house.world.objects.get('house')!.groups = groups.map((g) => [...g])
  house.world.emit({ type: 'detach', object: 'house', joint: 'j', parts: [...house.partIds], by: 'break', groups: groups.map((g) => [...g]) })
}

export const partBoxesOfPiece = (renderer: RangedHouse['renderer'], objectId: string): PartBox[] | undefined =>
  (renderer.piece(objectId) as unknown as { partBoxes?: PartBox[] } | null)?.partBoxes
