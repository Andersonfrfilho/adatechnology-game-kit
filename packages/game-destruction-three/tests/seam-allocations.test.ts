import { Session } from 'node:inspector/promises'

import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

/** The files of the seam between the kit's pieces and the engine: what an update makes in them is what the collector then pauses for. */
const SEAM = ['pieces.ts', 'engine-pieces.ts', 'engine-statics.ts', 'piece-contacts.ts', 'friction.ts', 'contacts.ts', 'world.ts']

interface ProfileNode {
  readonly callFrame: { readonly url: string }
  readonly selfSize: number
  readonly children?: readonly ProfileNode[]
}

/** Bytes sampled in the seam's files, a builtin (an iterator's `next`, `push`) counted to the file that called it. */
const seamBytes = (node: ProfileNode, owner: string): number => {
  const file = node.callFrame.url.split('/').pop() ?? ''
  const me = file === '' ? owner : file
  let bytes = SEAM.includes(me) ? node.selfSize : 0
  for (const child of node.children ?? []) bytes += seamBytes(child, me)
  return bytes
}

/** The debris bench's scene (`bench-pieces.test.ts`): 160 pieces at rest on the floor and 40 in a heap kicked about so they never settle. */
const debris = (): { update: () => void; kick: () => void } => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld() })
  let seed = 7
  const rnd = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647
  const ids: string[] = []
  for (let i = 0; i < 200; i++) {
    const id = `p${i}`
    const size: [number, number, number] = [0.1 + rnd() * 0.3, 0.05 + rnd() * 0.15, 0.1 + rnd() * 0.3]
    world.addObject(id, [partState('body', 'concrete', { mass: size[0] * size[1] * size[2] * 2400 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
    const root = new THREE.Group()
    root.add(mesh)
    if (i < 160) root.position.set((i % 16) * 0.8 - 6, size[1] / 2 + 0.001, Math.floor(i / 16) * 0.8 - 4)
    else root.position.set(8 + rnd(), 0.2 + (i - 160) * 0.25, rnd())
    root.rotation.set(0, rnd() * 3, 0)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: { body: mesh } })
    renderer.makePiece(id)
    ids.push(id)
  }
  return {
    update: () => renderer.update(1 / 60),
    kick: () => {
      for (let k = 160; k < 200; k++) renderer.impulse(ids[k]!, [(rnd() - 0.5) * 20, 10 + rnd() * 10, (rnd() - 0.5) * 20])
    },
  }
}

/** Most the seam may make per update with 200 pieces, 40 of them awake (bytes): the collector's pauses were the worst frames of gate 0 B5. */
const SEAM_BYTES_PER_UPDATE = 400_000
const UPDATES = 120

describe('what the seam makes per update', () => {
  it(`200 pieces, 40 awake: under ${SEAM_BYTES_PER_UPDATE / 1000} kB per update in the seam's files, garbage included`, { timeout: 120000 }, async () => {
    const scene = debris()
    for (let i = 0; i < 180; i++) scene.update()
    const session = new Session()
    session.connect()
    // every allocation sampled, including what the collector already took back (the garbage is the point)
    await session.post('HeapProfiler.startSampling', { samplingInterval: 1024, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true })
    for (let i = 0; i < UPDATES; i++) {
      if (i % 20 === 0) scene.kick()
      scene.update()
    }
    const { profile } = await session.post('HeapProfiler.stopSampling')
    session.disconnect()
    const perUpdate = seamBytes(profile.head as unknown as ProfileNode, '') / UPDATES
    console.log(JSON.stringify({ name: 'seam-allocations', bytesPerUpdate: Math.round(perUpdate) }))
    expect(perUpdate).toBeLessThan(SEAM_BYTES_PER_UPDATE)
  })
})
