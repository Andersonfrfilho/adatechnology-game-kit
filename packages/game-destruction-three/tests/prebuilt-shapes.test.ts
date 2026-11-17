import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { JoltWorld } from '@adatechnology/game-physics-jolt'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { IS_JOLT, physicsOption } from './setup-physics'

const PART_IDS = ['sheet', 'plate', 'post', 'gable', 'beam', 'ridge'] as const
const FRAME = 1 / 60
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

/** A house-like object on Jolt, its parts ranges of one merged mesh, bound and fitted ahead; `prebuildShapes` as given; at the origin unturned, or `placed` away and turned. */
const house = (prebuildShapes: boolean, placed: boolean) => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const physics = physicsOption()
  const renderer = createDestructionRenderer(THREE, { physics, scene, world: world.asWorld(), eventBudgetMs: Infinity, fitBoxesAhead: true, prebuildShapes })
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

/** Both runs blown apart and stepped 1.5 s; the part boxes the plain run built, and the other made ahead, in the frame that makes the pieces' bodies. */
const blowBoth = (placed: boolean) => {
  const plain = house(false, placed)
  const ahead = house(true, placed)
  explode(plain)
  explode(ahead)
  const before = { plain: plain.engine.ready.builtAtAssembly, ahead: ahead.engine.ready.builtAtAssembly }
  plain.renderer.update(FRAME)
  ahead.renderer.update(FRAME)
  const atSplit = { plain: plain.engine.ready.builtAtAssembly - before.plain, ahead: ahead.engine.ready.builtAtAssembly - before.ahead }
  for (let frame = 0; frame < 90; frame++) {
    plain.renderer.update(FRAME)
    ahead.renderer.update(FRAME)
  }
  return { plain, ahead, atSplit }
}

describe.skipIf(!IS_JOLT)('the shapes of a house\'s part boxes made ahead of the blow (spec 008 B6)', () => {
  it('where the split reads the very boxes fitted ahead, the frame that makes the pieces builds no part box, and the run is the same to the bit', () => {
    const { plain, ahead, atSplit } = blowBoth(false)
    expect(plain.engine.ready.made).toBe(0)
    expect(ahead.engine.ready.made).toBe(PART_BOXES)
    expect(ahead.renderer.pieces().length).toBe(2)
    expect(atSplit.plain).toBeGreaterThan(0)
    // every part box the plain run built in that frame the other took made ahead: it built none
    expect(ahead.engine.ready.taken).toBe(atSplit.plain)
    expect(atSplit.ahead).toBe(0)
    expect(poses(ahead)).toEqual(poses(plain))
    expect(hashOf(ahead.engine.saveState())).toBe(hashOf(plain.engine.saveState()))
  })

  it('placed away and turned, the split measures the boxes again in the piece\'s own frame (other last bits): nothing made ahead fits, and the run is still the same to the bit', () => {
    const { plain, ahead, atSplit } = blowBoth(true)
    expect(ahead.engine.ready.made).toBe(PART_BOXES)
    expect(atSplit.plain).toBeGreaterThan(0)
    // the known gap (spec 008 B6): the halves at the split differ from the fitted ones in the last bits, so the exact key misses; a split that reads them frame-free turns this into hits
    expect(ahead.engine.ready.taken).toBe(0)
    expect(atSplit.ahead).toBe(atSplit.plain)
    expect(poses(ahead)).toEqual(poses(plain))
    expect(hashOf(ahead.engine.saveState())).toBe(hashOf(plain.engine.saveState()))
  })

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
