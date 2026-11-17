import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import type { JoltWorld } from '@adatechnology/game-physics-jolt'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { IS_JOLT, physicsOption } from './setup-physics'

const PART_IDS = ['sheet', 'plate', 'post', 'gable', 'beam', 'ridge'] as const
const FRAME = 1 / 60

// the fit is counted through the module the renderer imports it from
let fitCalls = 0
vi.mock('@adatechnology/game-shapes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@adatechnology/game-shapes')>()
  return { ...actual, fitOrientedBoxes: (...args: Parameters<typeof actual.fitOrientedBoxes>) => (fitCalls++, actual.fitOrientedBoxes(...args)) }
})
/** One fitted box per part of this catalogue. */
const PART_BOXES = 6

/** What a house's merged meshes draw: pitched sheets, a plate of many vertices, a long post, a gable's slope, a beam and a ridge cap, all parts of one merged mesh. */
const catalogGeometries = (): THREE.BufferGeometry[] => [
  new THREE.PlaneGeometry(4, 3, 4, 4).rotateX(-Math.PI / 2).rotateX(Math.PI / 6).translate(0, 2, 0),
  new THREE.PlaneGeometry(2, 2, 12, 12).rotateX(-Math.PI / 2).rotateZ(0.3).translate(5, 1, 0),
  new THREE.CylinderGeometry(0.08, 0.1, 6, 8, 12).rotateZ(0.4).translate(-4, 3, 1),
  new THREE.PlaneGeometry(2, 4, 4, 4).rotateX(-Math.PI / 2).rotateZ(Math.PI / 6).translate(0, 4, 5),
  new THREE.BoxGeometry(3, 0.2, 0.15).rotateY(0.2).translate(1, 2.6, 2),
  new THREE.BoxGeometry(0.3, 0.1, 4).rotateZ(0.5).translate(-1, 3.4, 3),
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
    for (const i of Array.from(g.getIndex()?.array ?? [])) index.push(i + base)
    ranges.push([base, base + count])
    base += count
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3))
  geo.setIndex(index)
  return { geo, ranges }
}

/** A house-like object on Jolt, its parts ranges of one merged mesh; its boxes fitted and their shapes made `ahead` of the blow or not; at the origin unturned, or `placed` away and turned. */
const house = (ahead: boolean, placed: boolean) => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const physics = physicsOption()
  const renderer = createDestructionRenderer(THREE, { physics, scene, world: world.asWorld(), eventBudgetMs: Infinity, fitBoxesAhead: ahead, prebuildShapes: ahead })
  const { geo, ranges } = merge(catalogGeometries())
  const root = new THREE.Group()
  if (placed) {
    root.position.set(12.3, 0.4, -7.1)
    root.rotation.y = 0.37
  }
  root.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial()))
  scene.add(root)
  root.updateMatrixWorld(true)
  world.addObject('house', PART_IDS.map((id) => partState(id, 'wood')), [[...PART_IDS]])
  const mesh = root.children[0] as THREE.Mesh
  renderer.bind('house', root, { parts: Object.fromEntries(PART_IDS.map((id, i) => [id, { mesh, range: ranges[i]! }])) })
  return { renderer, world, engine: physics as unknown as JoltWorld }
}

/** The fitting (and with it the shapes made ahead) done, then a blow that leaves the house in groups of several parts: pieces whose bodies are compounds of part boxes. */
const explode = (s: ReturnType<typeof house>): void => {
  s.renderer.deferredQueue().flush()
  const groups = [['sheet'], ['plate', 'post'], ['gable', 'beam', 'ridge']]
  s.world.objects.get('house')!.groups = groups.map((g) => [...g])
  s.world.emit({ type: 'detach', object: 'house', joint: 'j', parts: [...PART_IDS], by: 'break', groups })
  s.renderer.deferredQueue().flush()
}

const hashOf = (bytes: Uint8Array): string => {
  let hash = 0x811c9dc5
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193)
  return (hash >>> 0).toString(16)
}

/** The pieces' poses, read off their roots: what the game draws. */
const poses = (s: ReturnType<typeof house>): number[] => s.renderer.pieces().flatMap((p) => [...p.root.position.toArray(), ...p.root.quaternion.toArray()])

/** A run without anything made ahead and one with it, both blown apart and stepped 1.5 s; the boxes fitted and the part boxes built in the frame that makes the pieces' bodies. */
const blowBoth = (placed: boolean) => {
  const plain = house(false, placed)
  const ahead = house(true, placed)
  explode(plain)
  explode(ahead)
  const before = { plain: plain.engine.ready.builtAtAssembly, ahead: ahead.engine.ready.builtAtAssembly }
  plain.renderer.update(FRAME)
  ahead.renderer.update(FRAME)
  const built = { plain: plain.engine.ready.builtAtAssembly - before.plain, ahead: ahead.engine.ready.builtAtAssembly - before.ahead }
  for (let frame = 0; frame < 90; frame++) {
    plain.renderer.update(FRAME)
    ahead.renderer.update(FRAME)
  }
  return { plain, ahead, built }
}

/** The split alone of a house prepared ahead (its fitting and shapes all done): the fits it ran. */
const fitsAtSplit = (placed: boolean): number => {
  const s = house(true, placed)
  s.renderer.deferredQueue().flush()
  const before = fitCalls
  const groups = [['sheet'], ['plate', 'post'], ['gable', 'beam', 'ridge']]
  s.world.objects.get('house')!.groups = groups.map((g) => [...g])
  s.world.emit({ type: 'detach', object: 'house', joint: 'j', parts: [...PART_IDS], by: 'break', groups })
  s.renderer.deferredQueue().flush()
  return fitCalls - before
}

describe.skipIf(!IS_JOLT)('the shapes of a house\'s part boxes made ahead of the blow (spec 008 B6)', () => {
  for (const placed of [false, true]) {
    it(`${placed ? 'moved and turned' : 'at the origin'}: the split fits no box and builds no part box, and the run is the one with nothing made ahead, to the bit`, () => {
      const { plain, ahead, built } = blowBoth(placed)
      expect(plain.engine.ready.made).toBe(0)
      expect(ahead.engine.ready.made).toBe(PART_BOXES)
      expect(ahead.renderer.pieces().length).toBe(2)
      expect(built.plain).toBeGreaterThan(0)
      // every part box the plain run built in that frame the other took made ahead: it built none
      expect(ahead.engine.ready.taken).toBe(built.plain)
      expect(built.ahead).toBe(0)
      expect(poses(ahead)).toEqual(poses(plain))
      expect(hashOf(ahead.engine.saveState())).toBe(hashOf(plain.engine.saveState()))
      expect(fitsAtSplit(placed)).toBe(0)
    })
  }

  it('what no piece took goes when the object is unbound, and with the renderer', () => {
    const s = house(true, true)
    s.renderer.deferredQueue().flush()
    expect(s.engine.ready.size).toBe(PART_BOXES)
    s.renderer.unbind('house')
    expect(s.engine.ready.size).toBe(0)
    const again = house(true, true)
    again.renderer.deferredQueue().flush()
    expect(again.engine.ready.size).toBe(PART_BOXES)
    again.renderer.dispose()
    expect(again.engine.ready.size).toBe(0)
  })
})
