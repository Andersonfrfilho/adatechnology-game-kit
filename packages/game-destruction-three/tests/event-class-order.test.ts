import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const FRAME = 1 / 60

type Strike = readonly ('hole' | 'detach')[]

/** One object `o1` with a base and a loose group `b`; the events of one strike are emitted in the given order, then one frame applies them. Returns the sound keys in the order they played. */
function strikeSounds(order: Strike): string[] {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const sounds: string[] = []
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), onSound: (key) => sounds.push(key) })
  world.addObject('o1', [partState('base', 'glass'), partState('b', 'glass')], [['base'], ['b']])
  const root = new THREE.Group()
  const meshes: Record<string, THREE.Mesh> = {}
  for (const [index, id] of ['base', 'b'].entries()) {
    meshes[id] = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial())
    meshes[id]!.position.set(index, 0.1, 0)
    root.add(meshes[id]!)
  }
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('o1', root, { parts: meshes })
  for (const type of order) {
    if (type === 'hole') world.emit({ type: 'hole', object: 'o1', part: 'b', hole: { normal: [0, 1, 0], diameter: 0.01, through: false }, worldPoint: [1, 0.2, 0], blow: undefined })
    else world.emit({ type: 'detach', object: 'o1', part: 'b', by: 'force' })
  }
  renderer.update(FRAME)
  renderer.dispose?.()
  return sounds.filter((key) => key === 'detach' || key.startsWith('shot_'))
}

describe('the visual event of a part applies before the structural event of the same part in one strike (spec 017, design-tiques 3, "Ordem")', () => {
  it('a hole emitted before the detach that takes its part away is drawn: the mark and its sound exist', () => {
    const sounds = strikeSounds(['hole', 'detach'])
    expect(sounds.filter((key) => key.startsWith('shot_'))).toHaveLength(1)
    expect(sounds.at(-1)).toBe('detach')
  })

  // Expected failure, closed by T2.2: events apply in emission order today, and after the `detach` the part belongs to a new object, so the hole finds no part and is lost.
  // T2.2 sends the visual events to a deadline queue and must apply the ones of a part that has a structural event in the same strike first.
  it.fails('a hole emitted after the detach is still applied before it', () => {
    const sounds = strikeSounds(['detach', 'hole'])
    expect(sounds.filter((key) => key.startsWith('shot_'))).toHaveLength(1)
    expect(sounds.indexOf('detach')).toBeGreaterThan(sounds.findIndex((key) => key.startsWith('shot_')))
  })
})
